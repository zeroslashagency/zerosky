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
export function createSessionUserResolver(
  db: PrismaClient,
  service?: AuthService,
): UserResolver {
  return {
    async resolveUser(token) {
      if (!token) return null;

      const auth = service ?? getAuthService();

      let payload;
      try {
        payload = auth.jwt.verify(token, "access");
      } catch {
        // Bad signature, expired, wrong token type, or malformed payload.
        return null;
      }

      // The session record is the revocation list: logout deletes it, so a
      // still-valid signature is not sufficient on its own.
      const session = await auth.sessions.get(payload.sessionId);
      if (!session) return null;
      // A token whose claims disagree with the stored session (e.g. a token
      // minted for a different user against a recycled session id) is refused.
      if (session.userId !== payload.sub || session.tenantId !== payload.tenantId) {
        return null;
      }

      const user = await db.user.findUnique({ where: { id: payload.sub } });
      if (!user || !user.isActive) return null;
      if (user.tenantId !== payload.tenantId) return null;
      const tenant = await db.tenant.findUnique({
        where: { id: user.tenantId },
      });
      if (!tenant || !tenant.isActive) return null;
      return { user, tenant, sessionId: payload.sessionId };
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

  return { db, auth, requestId, clientId };
}

export type CreateContext = typeof createContext;
