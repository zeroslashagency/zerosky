// @zerosky/auth — process-wide auth service (JWT issuance + Redis sessions).
//
// This is the single seam the API layer uses so routers never construct
// secrets or Redis clients themselves. It is lazily built on first use and can
// be replaced wholesale in tests via `setAuthService`.

import { randomUUID } from "node:crypto";
import { createRequire } from "node:module";
import type Redis from "ioredis";
import { resolveJwtConfig } from "./env.js";
import { JwtService } from "./jwt.js";
import { SessionManager } from "./session.js";
import type { Role, TokenPair } from "./types.js";

export interface AuthService {
  jwt: JwtService;
  sessions: SessionManager;
  /** Session/refresh lifetime in seconds (mirrors the refresh token TTL). */
  sessionTtlSeconds: number;
  /** Access-token lifetime in seconds; useful for cookie Max-Age. */
  accessTtlSeconds: number;
}

export interface IssuedSession extends TokenPair {
  sessionId: string;
  accessTtlSeconds: number;
  refreshTtlSeconds: number;
}

/**
 * Minimal Redis subset used by SessionManager. Lets a non-Redis store stand in
 * for development/tests without pulling a server into the loop.
 */
type RedisLike = Pick<Redis, "get" | "set" | "del" | "exists">;

/** In-memory, TTL-aware stand-in for Redis. Never used in production. */
export function createInMemorySessionStore(): RedisLike {
  const store = new Map<string, { value: string; expiresAt: number }>();

  const live = (key: string): string | null => {
    const hit = store.get(key);
    if (!hit) return null;
    if (Date.now() >= hit.expiresAt) {
      store.delete(key);
      return null;
    }
    return hit.value;
  };

  return {
    async get(key: string) {
      return live(key);
    },
    async set(key: string, value: string, ...rest: unknown[]) {
      // Called as set(key, value, "EX", seconds) by SessionManager.
      const ttlIndex = rest.findIndex(
        (arg) => typeof arg === "string" && arg.toUpperCase() === "EX",
      );
      const ttl = ttlIndex >= 0 ? Number(rest[ttlIndex + 1]) : 604800;
      store.set(key, {
        value: String(value),
        expiresAt: Date.now() + ttl * 1000,
      });
      return "OK";
    },
    async del(...keys: unknown[]) {
      let removed = 0;
      for (const key of keys.flat() as string[]) {
        if (store.delete(key)) removed += 1;
      }
      return removed;
    },
    async exists(...keys: unknown[]) {
      let found = 0;
      for (const key of keys.flat() as string[]) {
        if (live(key) !== null) found += 1;
      }
      return found;
    },
  } as unknown as RedisLike;
}

let redisClient: Redis | null = null;

/**
 * Connect to Redis when REDIS_URL is configured. Outside production a missing
 * REDIS_URL falls back to the in-memory store with a warning; in production a
 * missing REDIS_URL is fatal because sessions would not survive a restart and
 * revocation would not work across processes.
 */
function resolveSessionStore(): RedisLike {
  const url = process.env.REDIS_URL?.trim();
  const production = process.env.NODE_ENV === "production";

  if (!url) {
    if (production) {
      throw new Error(
        "REDIS_URL is required in production: sessions and revocation depend on it.",
      );
    }
    console.warn(
      "[zerosky/auth] REDIS_URL is not set: using an in-memory session store. " +
        "Sessions are lost on restart and are not shared between processes.",
    );
    return createInMemorySessionStore();
  }

  if (!redisClient) {
    // Loaded lazily so environments without Redis (e.g. unit tests) never pay
    // for the module or open a socket. `createRequire` keeps this synchronous
    // inside an ESM package.
    const nodeRequire = createRequire(import.meta.url);
    const mod = nodeRequire("ioredis") as {
      default?: new (url: string, opts?: Record<string, unknown>) => Redis;
    } & (new (url: string, opts?: Record<string, unknown>) => Redis);
    const RedisCtor = mod.default ?? mod;
    redisClient = new RedisCtor(url, {
      lazyConnect: false,
      maxRetriesPerRequest: 2,
      enableOfflineQueue: true,
    });
    redisClient.on("error", (err: Error) => {
      console.error("[zerosky/auth] redis error", { message: err.message });
    });
  }
  return redisClient;
}

let activeService: AuthService | null = null;

/** Build an AuthService. Exposed for tests and for explicit wiring. */
export function createAuthService(opts: { redis?: RedisLike } = {}): AuthService {
  const config = resolveJwtConfig();
  const store = opts.redis ?? resolveSessionStore();
  return {
    jwt: new JwtService(config),
    sessions: new SessionManager(
      store as unknown as Redis,
      config.refreshTtlSeconds,
    ),
    sessionTtlSeconds: config.refreshTtlSeconds,
    accessTtlSeconds: config.accessTtlSeconds,
  };
}

/** Lazily-built process singleton. */
export function getAuthService(): AuthService {
  if (!activeService) {
    activeService = createAuthService();
  }
  return activeService;
}

/** Replace (or reset, with null) the active service. Intended for tests. */
export function setAuthService(service: AuthService | null): void {
  activeService = service;
}

export interface StartSessionInput {
  userId: string;
  tenantId: string;
  role: Role;
  service?: AuthService;
}

/** Issue a token pair and persist the matching Redis session record. */
export async function startSession(
  input: StartSessionInput,
): Promise<IssuedSession> {
  const service = input.service ?? getAuthService();
  const sessionId = randomUUID();
  const tokens = service.jwt.issueTokens({
    userId: input.userId,
    tenantId: input.tenantId,
    role: input.role,
    sessionId,
  });
  await service.sessions.create({
    sessionId,
    userId: input.userId,
    tenantId: input.tenantId,
    role: input.role,
    refreshToken: tokens.refreshToken,
  });
  return {
    ...tokens,
    sessionId,
    accessTtlSeconds: service.accessTtlSeconds,
    refreshTtlSeconds: service.sessionTtlSeconds,
  };
}

/**
 * Verify a refresh token, rotate it, and return a fresh pair. The session id is
 * preserved so revocation semantics stay stable across refreshes.
 */
export async function refreshSession(
  refreshToken: string,
  service: AuthService = getAuthService(),
): Promise<IssuedSession> {
  const payload = service.jwt.verify(refreshToken, "refresh");
  const next = service.jwt.issueTokens({
    userId: payload.sub,
    tenantId: payload.tenantId,
    role: payload.role,
    sessionId: payload.sessionId,
  });
  await service.sessions.rotate(
    payload.sessionId,
    refreshToken,
    next.refreshToken,
  );
  return {
    ...next,
    sessionId: payload.sessionId,
    accessTtlSeconds: service.accessTtlSeconds,
    refreshTtlSeconds: service.sessionTtlSeconds,
  };
}
