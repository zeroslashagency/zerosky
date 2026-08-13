// tRPC instance, middleware, and reusable procedures for @zerosky/api.

import { initTRPC, TRPCError } from "@trpc/server";
import superjson from "superjson";
import { ZodError } from "zod";
import type { UserRole } from "@zerosky/database";
import type { AuthUser, Context } from "./context.js";

/**
 * Structured logger contract. Defaults to console but can be swapped (e.g. for
 * pino) via `setLogger`. Kept tiny so it is trivial to mock in tests.
 */
export interface Logger {
  info(msg: string, meta?: Record<string, unknown>): void;
  warn(msg: string, meta?: Record<string, unknown>): void;
  error(msg: string, meta?: Record<string, unknown>): void;
}

const consoleLogger: Logger = {
  info: (msg, meta) => console.info(msg, meta ?? {}),
  warn: (msg, meta) => console.warn(msg, meta ?? {}),
  error: (msg, meta) => console.error(msg, meta ?? {}),
};

let activeLogger: Logger = consoleLogger;

/** Override the module logger (used by the logging middleware). */
export function setLogger(logger: Logger): void {
  activeLogger = logger;
}

const t = initTRPC.context<Context>().create({
  transformer: superjson,
  errorFormatter({ shape, error }) {
    return {
      ...shape,
      data: {
        ...shape.data,
        // Surface flattened Zod issues for clients without leaking internals.
        zodError:
          error.cause instanceof ZodError ? error.cause.flatten() : null,
      },
    };
  },
});

export const router = t.router;
export const middleware = t.middleware;
export const mergeRouters = t.mergeRouters;
export const createCallerFactory = t.createCallerFactory;

/**
 * Error-handling middleware. Wraps every call so that unexpected (non-TRPC)
 * errors are logged and normalised into a TRPCError instead of leaking stack
 * traces to clients.
 */
const errorHandler = middleware(async ({ ctx, path, type, next }) => {
  // tRPC middleware `next()` resolves with a result object ({ ok, error })
  // rather than throwing, so we branch on `result.ok` instead of try/catch.
  const result = await next();
  if (result.ok) {
    return result;
  }

  const err = result.error;
  // A TRPCError whose `cause` is not itself an Error is a deliberate,
  // client-facing error raised by a router: log at warn and pass it through.
  const isClientFacing = !(err.cause instanceof Error);
  if (isClientFacing) {
    activeLogger.warn("trpc.error", {
      requestId: ctx.requestId,
      path,
      type,
      code: err.code,
      message: err.message,
    });
  } else {
    // Unknown/unexpected errors (tRPC wraps the original in `cause`): log the
    // full detail so it is not lost. The errorFormatter controls what the
    // client actually sees.
    activeLogger.error("trpc.unhandled", {
      requestId: ctx.requestId,
      path,
      type,
      code: err.code,
      error: err.cause instanceof Error ? err.cause.message : err.message,
      stack: err.cause instanceof Error ? err.cause.stack : err.stack,
    });
  }
  return result;
});

/** Request logging middleware. Emits one structured line per call w/ duration. */
const requestLogger = middleware(async ({ ctx, path, type, next }) => {
  const start = Date.now();
  const result = await next();
  const durationMs = Date.now() - start;
  activeLogger.info("trpc.request", {
    requestId: ctx.requestId,
    path,
    type,
    ok: result.ok,
    durationMs,
    userId: ctx.auth?.user.id ?? null,
    tenantId: ctx.auth?.tenant.id ?? null,
  });
  return result;
});

// ─────────────────────────────────────────────────────────────
// Rate limiting
// ─────────────────────────────────────────────────────────────

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

export interface RateLimiter {
  /** Returns true when the request is allowed, false when limited. */
  check(key: string): { allowed: boolean; remaining: number; resetAt: number };
  reset(): void;
}

/**
 * Fixed-window in-memory rate limiter. Suitable for single-process/dev and
 * tests. In production this can be swapped for a Redis-backed limiter through
 * `setRateLimiter` without changing middleware wiring.
 * 
 * FIXED: Added periodic cleanup to prevent unbounded Map growth (memory leak).
 */
export function createInMemoryRateLimiter(
  limit: number,
  windowMs: number,
): RateLimiter {
  const buckets = new Map<string, RateLimitEntry>();
  
  // Cleanup stale entries every 5 minutes to prevent memory leak
  const cleanupInterval = setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of buckets.entries()) {
      if (now >= entry.resetAt) {
        buckets.delete(key);
      }
    }
  }, 5 * 60 * 1000);
  
  // Allow cleanup to be stopped (important for tests and graceful shutdown)
  if (typeof cleanupInterval.unref === 'function') {
    cleanupInterval.unref();
  }
  
  return {
    check(key) {
      const now = Date.now();
      const existing = buckets.get(key);
      if (!existing || now >= existing.resetAt) {
        const resetAt = now + windowMs;
        buckets.set(key, { count: 1, resetAt });
        return { allowed: true, remaining: limit - 1, resetAt };
      }
      if (existing.count >= limit) {
        return { allowed: false, remaining: 0, resetAt: existing.resetAt };
      }
      existing.count += 1;
      return {
        allowed: true,
        remaining: limit - existing.count,
        resetAt: existing.resetAt,
      };
    },
    reset() {
      buckets.clear();
    },
  };
}

// Per-client request budget. A POS terminal is chatty: each screen issues
// several queries on mount and the kitchen/floor views poll every 10-15s, so a
// single active user legitimately makes hundreds of calls per minute. 100 was
// low enough that ordinary navigation returned 429.
const DEFAULT_LIMIT = Number(process.env.API_RATE_LIMIT ?? 1_000);
const DEFAULT_WINDOW_MS = Number(process.env.API_RATE_LIMIT_WINDOW_MS ?? 60_000);

let activeRateLimiter: RateLimiter = createInMemoryRateLimiter(
  DEFAULT_LIMIT,
  DEFAULT_WINDOW_MS,
);

/** Override the active rate limiter (e.g. Redis-backed, or a test double). */
export function setRateLimiter(limiter: RateLimiter): void {
  activeRateLimiter = limiter;
}

const rateLimit = middleware(async ({ ctx, next }) => {
  const { allowed, resetAt } = activeRateLimiter.check(ctx.clientId);
  if (!allowed) {
    const retryAfterSec = Math.max(0, Math.ceil((resetAt - Date.now()) / 1000));
    throw new TRPCError({
      code: "TOO_MANY_REQUESTS",
      message: `Rate limit exceeded. Retry in ${retryAfterSec}s.`,
    });
  }
  return next();
});

/** Authentication guard: narrows ctx.auth to a non-null AuthUser. */
const enforceAuth = middleware(async ({ ctx, next }) => {
  if (!ctx.auth) {
    throw new TRPCError({
      code: "UNAUTHORIZED",
      message: "Authentication required.",
    });
  }
  return next({
    ctx: {
      ...ctx,
      // Re-narrowed for downstream procedures.
      auth: ctx.auth as AuthUser,
    },
  });
});

// Base chain applied to all procedures: error handling → logging → rate limit.
const baseProcedure = t.procedure
  .use(errorHandler)
  .use(requestLogger)
  .use(rateLimit);

/** Public procedure: no authentication required. */
export const publicProcedure = baseProcedure;

/** Protected procedure: requires a valid authenticated user + tenant. */
export const protectedProcedure = baseProcedure.use(enforceAuth);

/**
 * Credential-checking procedure (login, PIN login).
 *
 * The general budget is sized for a chatty authenticated UI, which is far too
 * generous for password guessing. Unauthenticated callers share an IP-derived
 * bucket, so this applies a much tighter, separate limit on top.
 */
const AUTH_ATTEMPT_LIMIT = Number(process.env.API_AUTH_RATE_LIMIT ?? 10);
const AUTH_ATTEMPT_WINDOW_MS = Number(
  process.env.API_AUTH_RATE_LIMIT_WINDOW_MS ?? 60_000,
);

let authRateLimiter: RateLimiter = createInMemoryRateLimiter(
  AUTH_ATTEMPT_LIMIT,
  AUTH_ATTEMPT_WINDOW_MS,
);

/** Override the auth-attempt limiter (tests, or a Redis-backed limiter). */
export function setAuthRateLimiter(limiter: RateLimiter): void {
  authRateLimiter = limiter;
}

const authAttemptLimit = middleware(async ({ ctx, next }) => {
  const { allowed, resetAt } = authRateLimiter.check(`auth:${ctx.clientId}`);
  if (!allowed) {
    const retryAfterSec = Math.max(0, Math.ceil((resetAt - Date.now()) / 1000));
    throw new TRPCError({
      code: "TOO_MANY_REQUESTS",
      message: `Too many sign-in attempts. Retry in ${retryAfterSec}s.`,
    });
  }
  return next();
});

export const authProcedure = baseProcedure.use(authAttemptLimit);

/**
 * Role-guarded procedure factory. Builds on protectedProcedure and enforces
 * that the authenticated user's role is in the allowed set.
 */
export function roleProcedure(...allowed: UserRole[]) {
  return protectedProcedure.use(async ({ ctx, next }) => {
    if (!allowed.includes(ctx.auth.user.role)) {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: `Requires one of roles: ${allowed.join(", ")}.`,
      });
    }
    return next();
  });
}
