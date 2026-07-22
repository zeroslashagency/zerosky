// tRPC request context for @zerosky/api.
//
// The context resolves the authenticated user + tenant from an incoming
// session token. Auth resolution is intentionally decoupled behind the
// `UserResolver` interface so that @zerosky/auth can be plugged in later
// without touching routers. The default resolver performs a direct
// @zerosky/database lookup.

import { prisma } from "@zerosky/database";
import type { PrismaClient, User, Tenant } from "@zerosky/database";

/**
 * The authenticated principal attached to a request: a User plus the Tenant
 * they belong to. Kept as a narrow shape so routers never depend on how the
 * session was resolved.
 */
export interface AuthUser {
  user: User;
  tenant: Tenant;
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
  /** Injectable auth resolver (defaults to the DB-backed resolver). */
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

/** Extract a bearer token from the Authorization header. */
export function extractToken(req?: ContextRequestInfo): string | null {
  if (!req) return null;
  const header = readHeader(req.headers, "authorization");
  if (!header) return null;
  if (header.startsWith(BEARER_PREFIX)) {
    return header.slice(BEARER_PREFIX.length).trim() || null;
  }
  return header.trim() || null;
}

/**
 * Default DB-backed resolver. Interprets the token as a `userId` and loads the
 * user + tenant directly. This is a deliberate placeholder seam: @zerosky/auth
 * will replace it with real session/JWT verification via the same interface.
 */
export function createDbUserResolver(db: PrismaClient): UserResolver {
  return {
    async resolveUser(token) {
      if (!token) return null;
      const user = await db.user.findUnique({ where: { id: token } });
      if (!user || !user.isActive) return null;
      const tenant = await db.tenant.findUnique({
        where: { id: user.tenantId },
      });
      if (!tenant || !tenant.isActive) return null;
      return { user, tenant };
    },
  };
}

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
  const clientId =
    opts.req?.ip ??
    readHeader(opts.req?.headers ?? {}, "x-forwarded-for") ??
    "anonymous";

  let auth: AuthUser | null;
  if (opts.auth !== undefined) {
    auth = opts.auth;
  } else {
    const resolver = opts.resolver ?? createDbUserResolver(db);
    const token = extractToken(opts.req);
    auth = await resolver.resolveUser(token);
  }

  return { db, auth, requestId, clientId };
}

export type CreateContext = typeof createContext;
