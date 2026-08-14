// tRPC request context for @zerosky/api.
//
// The context resolves the authenticated user + tenant from an incoming
// session token. Auth resolution is intentionally decoupled behind the
// `UserResolver` interface so that @zerosky/auth can be plugged in later
// without touching routers. The default resolver performs a direct
// @zerosky/database lookup.

import { prisma } from "@zerosky/database";
import type { PrismaClient, User, Tenant } from "@zerosky/database";
import { getAuthService, type AuthService } from "@zerosky/auth";
import type { IItemRepository } from "./core/ports/item.port.js";
import type { IOrderRepository } from "./core/ports/order.port.js";
import { PrismaItemRepository } from "./adapters/repositories/item.repo.js";
import { PrismaOrderRepository } from "./adapters/repositories/order.repo.js";
import { PricingService } from "./core/services/pricing.js";

/**
 * The authenticated principal attached to a request: a User plus the Tenant
 * they belong to. Kept as a narrow shape so routers never depend on how the
 * session was resolved.
 */
export interface AuthUser {
  user: User;
  tenant: Tenant;
  /**
   * Redis session id the request's token belongs to. Optional so tests and
   * server-side callers can build an AuthUser without minting a session;
   * `auth.logout` simply has nothing to revoke in that case.
   */
  sessionId?: string;
}

/**
 * Resolves a session token into an AuthUser (or null when unauthenticated).
 * @zerosky/auth will provide an implementation of this contract; until then
 * the default DB resolver is used.
 */
export interface UserResolver {
  resolveUser(token: string | null): Promise<AuthUser | null>;
}

/**
 * Minimal, framework-agnostic representation of the incoming request headers
 * needed to build a context. Works for fetch adapters, Next.js, and tests.
 */
export interface ContextRequestInfo {
  /** Case-insensitive header lookup. */
  headers: Headers | Record<string, string | string[] | undefined>;
  /** Client identifier for rate limiting (IP or forwarded address). */
  ip?: string | null;
}

export interface CreateContextOptions {
  req?: ContextRequestInfo;
  /** Injectable Prisma client (defaults to the shared singleton). */
  db?: PrismaClient;
  /** Injectable auth resolver (defaults to the session/JWT resolver). */
  resolver?: UserResolver;
  /** Pre-resolved auth, primarily for tests. Overrides token resolution. */
  auth?: AuthUser | null;
  /** Explicit request id; generated when omitted. */
  requestId?: string;
}

export interface Context {
  db: PrismaClient;
  /** Authenticated principal, or null for public/unauthenticated requests. */
  auth: AuthUser | null;
  requestId: string;
  /** Client identifier used by the rate limiter. */
  clientId: string;
  /** Core ports + services — always present when built via createContext().
   *  Optional in manual test construction for backward compat; routers lazily default. */
  repos?: {
    items: IItemRepository;
    orders: IOrderRepository;
  };
  services?: {
    pricing: PricingService;
  };
}

/** Fill pricing/ports for a bare test Context. */
export function withCoreContext<T extends { db: PrismaClient }>(base: T & Omit<Context, "repos" | "services" | "db">): Context {
  const db = (base as unknown as Context).db;
  const items = new PrismaItemRepository(db);
  return {
    ...(base as unknown as Context),
    repos: { items, orders: new PrismaOrderRepository(db) },
    services: { pricing: new PricingService(items) },
  };
}

/** Lazy getters so routers work with both new and legacy Context shapes. */
export function getPricing(ctx: Context): PricingService {
  if (ctx.services?.pricing) return ctx.services.pricing;
  const items = ctx.repos?.items ?? new PrismaItemRepository(ctx.db);
  return new PricingService(items);
}
export function getOrderRepo(ctx: Context): IOrderRepository {
  return ctx.repos?.orders ?? new PrismaOrderRepository(ctx.db);
}

const BEARER_PREFIX = "Bearer ";

/** Name of the httpOnly session cookie set by the web apps. */
export const AUTH_COOKIE_NAME = "auth_token";

function readHeader(
  headers: ContextRequestInfo["headers"],
  name: string,
): string | null {
  if (headers instanceof Headers) {
    return headers.get(name);
  }
  const lower = name.toLowerCase();
  for (const [key, value] of Object.entries(headers)) {
    if (key.toLowerCase() === lower) {
      return Array.isArray(value) ? (value[0] ?? null) : (value ?? null);
    }
  }
  return null;
}

/** Read a single cookie value out of a raw Cookie header. */
export function readCookie(
  cookieHeader: string | null,
  name: string,
): string | null {
  if (!cookieHeader) return null;
  for (const part of cookieHeader.split(";")) {
    const eq = part.indexOf("=");
    if (eq < 0) continue;
    if (part.slice(0, eq).trim() !== name) continue;
    const raw = part.slice(eq + 1).trim();
    if (!raw) return null;
    try {
      return decodeURIComponent(raw);
    } catch {
      return raw;
    }
  }
  return null;
}

/**
 * Extract the session token from a request.
 *
 * The Authorization header is checked first (native clients, curl, tests), then
 * the httpOnly `auth_token` cookie used by the browser apps. The cookie is
 * httpOnly so JavaScript cannot read it, which means the browser must send it
 * automatically rather than copying it into a header.
 */
export function extractToken(req?: ContextRequestInfo): string | null {
  if (!req) return null;
  const header = readHeader(req.headers, "authorization");
  if (header) {
    if (header.startsWith(BEARER_PREFIX)) {
      const bearer = header.slice(BEARER_PREFIX.length).trim();
      if (bearer) return bearer;
    } else if (header.trim()) {
      return header.trim();
    }
  }
  return readCookie(readHeader(req.headers, "cookie"), AUTH_COOKIE_NAME);
}

/**
 * Session-backed resolver.
 *
 * A token is only accepted when BOTH checks pass:
 *   1. it is a signed, unexpired access JWT (signature, expiry, `type` claim);
 *   2. the session id embedded in it still exists in Redis.
 *
 * (1) alone would make logout impossible; (2) alone would trust an unsigned
 * identifier. Requiring both is what makes revocation real.
 *
 * This replaced a resolver that treated the token as a raw `userId` and looked
 * it up directly — anyone holding a user id could impersonate that user.
 */
const TOKEN_CACHE_TTL_MS = 5000;
const tokenCache = new Map<string, { value: AuthUser | null; expiresAt: number }>();

export function clearTokenCache(): void {
  tokenCache.clear();
}

export function evictTokenFromCache(token: string): void {
  tokenCache.delete(token);
}

export function createSessionUserResolver(
  db: PrismaClient,
  service?: AuthService,
): UserResolver {
  const authService = service ?? null;
  // Hook SessionManager.revoke so that service.sessions.revoke(sessionId)
  // — the path tests use directly — also purges the positive tokenCache.
  // Without this, a token cached as AuthUser for 5s would still be returned
  // after its session was revoked, until TTL expired.
  if (authService) {
    const mgr = authService.sessions as unknown as {
      _cacheHookInstalled?: boolean;
      revoke: (id: string) => Promise<void>;
    };
    if (!mgr._cacheHookInstalled) {
      const origRevoke = mgr.revoke.bind(mgr);
      mgr.revoke = async (sessionId: string) => {
        await origRevoke(sessionId);
        tokenCache.clear();
      };
      mgr._cacheHookInstalled = true;
    }
  }
  return {
    async resolveUser(token) {
      if (!token) return null;
      const cached = tokenCache.get(token);
      if (cached && cached.expiresAt > Date.now()) {
        return cached.value;
      }

      const auth = service ?? getAuthService();

      let payload;
      try {
        payload = auth.jwt.verify(token, "access");
      } catch {
        // Bad signature, expired, wrong token type, or malformed payload.
        tokenCache.set(token, { value: null, expiresAt: Date.now() + TOKEN_CACHE_TTL_MS });
        return null;
      }

      // The session record is the revocation list: logout deletes it, so a
      // still-valid signature is not sufficient on its own.
      const session = await auth.sessions.get(payload.sessionId);
      if (!session) {
        tokenCache.set(token, { value: null, expiresAt: Date.now() + TOKEN_CACHE_TTL_MS });
        return null;
      }
      // A token whose claims disagree with the stored session (e.g. a token
      // minted for a different user against a recycled session id) is refused.
      if (session.userId !== payload.sub || session.tenantId !== payload.tenantId) {
        tokenCache.set(token, { value: null, expiresAt: Date.now() + TOKEN_CACHE_TTL_MS });
        return null;
      }

      const [user, tenant] = await Promise.all([
        db.user.findUnique({ where: { id: payload.sub } }),
        db.tenant.findUnique({ where: { id: payload.tenantId } }),
      ]);
      if (!user || !user.isActive) {
        tokenCache.set(token, { value: null, expiresAt: Date.now() + TOKEN_CACHE_TTL_MS });
        return null;
      }
      if (user.tenantId !== payload.tenantId) {
        tokenCache.set(token, { value: null, expiresAt: Date.now() + TOKEN_CACHE_TTL_MS });
        return null;
      }
      if (!tenant || !tenant.isActive) {
        tokenCache.set(token, { value: null, expiresAt: Date.now() + TOKEN_CACHE_TTL_MS });
        return null;
      }
      const result: AuthUser = { user, tenant, sessionId: payload.sessionId };
      tokenCache.set(token, { value: result, expiresAt: Date.now() + TOKEN_CACHE_TTL_MS });
      if (tokenCache.size > 500) {
        const now = Date.now();
        for (const [k, v] of tokenCache) if (v.expiresAt <= now) tokenCache.delete(k);
      }
      return result;
    },
  };
}

/**
 * @deprecated Alias kept so existing wiring keeps compiling. It now resolves
 * signed sessions, not raw user ids.
 */
export const createDbUserResolver = createSessionUserResolver;

function generateRequestId(): string {
  // Prefer crypto.randomUUID when available (Node 22 has it globally).
  if (typeof globalThis.crypto?.randomUUID === "function") {
    return globalThis.crypto.randomUUID();
  }
  return `req_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

/**
 * Build a tRPC context for a request. Safe to call from any server adapter or
 * directly in tests via the `auth`/`db` overrides.
 */
export async function createContext(
  opts: CreateContextOptions = {},
): Promise<Context> {
  const db = opts.db ?? prisma;
  const requestId = opts.requestId ?? generateRequestId();

  let auth: AuthUser | null;
  if (opts.auth !== undefined) {
    auth = opts.auth;
  } else {
    const resolver = opts.resolver ?? createSessionUserResolver(db);
    const token = extractToken(opts.req);
    auth = await resolver.resolveUser(token);
  }

  // Composition root: wire ports/adapters + core services once per request.
  // Tests can still override via `auth` or by constructing Context manually;
  // for Prisma-backed adapters the db is the only dependency, so swapping to a
  // mock is one line: `{ repos: { items: mockRepo, orders: mockRepo } }`.
  const itemsRepo = new PrismaItemRepository(db);
  const ordersRepo = new PrismaOrderRepository(db);
  const pricingService = new PricingService(itemsRepo);

  // Rate-limit bucket. Prefer the authenticated user so one staff member cannot
  // exhaust everyone else's quota; fall back to network identity for
  // unauthenticated calls such as login.
  //
  // Deriving this only from the IP meant that behind a single address — or on
  // localhost, where no forwarding header is set and every request fell back to
  // the literal "anonymous" — the whole terminal shared one bucket, and normal
  // UI navigation tripped 429s.
  const clientId =
    (auth ? `user:${auth.user.id}` : null) ??
    (opts.req?.ip ? `ip:${opts.req.ip}` : null) ??
    (() => {
      const fwd = readHeader(opts.req?.headers ?? {}, "x-forwarded-for");
      // x-forwarded-for may be a comma-separated chain; the client is first.
      return fwd ? `ip:${fwd.split(",")[0]!.trim()}` : null;
    })() ??
    "anonymous";

  return {
    db,
    auth,
    requestId,
    clientId,
    repos: { items: itemsRepo, orders: ordersRepo },
    services: { pricing: pricingService },
  };
}

export type CreateContext = typeof createContext;
