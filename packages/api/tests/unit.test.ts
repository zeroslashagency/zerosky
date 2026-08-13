// Pure-unit tests for @zerosky/api plumbing that needs no database:
// token extraction, header parsing, request-id generation, the in-memory
// rate limiter, the logging seam, and the error-normalising middleware.

import { afterEach, describe, expect, it, vi } from "vitest";
import { TRPCError } from "@trpc/server";
import {
  createAuthService,
  createInMemorySessionStore,
  startSession,
} from "@zerosky/auth";
import {
  createContext,
  extractToken,
  createSessionUserResolver,
} from "../src/context.js";
import {
  createInMemoryRateLimiter,
  setRateLimiter,
  setLogger,
  publicProcedure,
  router,
  createCallerFactory,
  type Logger,
} from "../src/trpc.js";

describe("extractToken", () => {
  it("returns null when there is no request", () => {
    expect(extractToken(undefined)).toBeNull();
  });

  it("strips the Bearer prefix (Headers instance)", () => {
    const headers = new Headers({ authorization: "Bearer abc123" });
    expect(extractToken({ headers })).toBe("abc123");
  });

  it("accepts a raw token without the Bearer prefix (record headers)", () => {
    expect(extractToken({ headers: { Authorization: "rawtoken" } })).toBe(
      "rawtoken",
    );
  });

  it("handles array-valued and missing headers", () => {
    expect(extractToken({ headers: { authorization: ["Bearer x"] } })).toBe("x");
    expect(extractToken({ headers: {} })).toBeNull();
    expect(extractToken({ headers: { authorization: "Bearer   " } })).toBeNull();
  });
});

describe("createContext", () => {
  it("derives clientId from ip, then x-forwarded-for, then anonymous", async () => {
    // Buckets are namespaced ("ip:"/"user:") so an authenticated user and a
    // bare IP can never collide on the same rate-limit key.
    const withIp = await createContext({ auth: null, req: { headers: {}, ip: "1.2.3.4" } });
    expect(withIp.clientId).toBe("ip:1.2.3.4");

    const withXff = await createContext({
      auth: null,
      req: { headers: { "x-forwarded-for": "9.9.9.9" } },
    });
    expect(withXff.clientId).toBe("ip:9.9.9.9");

    const anon = await createContext({ auth: null });
    expect(anon.clientId).toBe("anonymous");
  });

  it("uses the explicit requestId when provided and generates one otherwise", async () => {
    const explicit = await createContext({ auth: null, requestId: "req-fixed" });
    expect(explicit.requestId).toBe("req-fixed");

    const generated = await createContext({ auth: null });
    expect(generated.requestId).toMatch(/./);
  });

  it("resolves auth via an injected resolver when auth is not pre-set", async () => {
    const ctx = await createContext({
      req: { headers: { authorization: "Bearer tok" } },
      resolver: {
        async resolveUser(token) {
          expect(token).toBe("tok");
          return null;
        },
      },
    });
    expect(ctx.auth).toBeNull();
  });
});

describe("createSessionUserResolver", () => {
  const SECRET = "unit-test-session-secret-0123456789abcdef";

  function makeService() {
    process.env.JWT_SECRET = SECRET;
    return createAuthService({ redis: createInMemorySessionStore() });
  }

  it("returns null for an empty token without touching the db", async () => {
    const resolver = createSessionUserResolver({} as never, makeService());
    expect(await resolver.resolveUser(null)).toBeNull();
  });

  // This is the vulnerability, expressed as a unit test: a bare user id is not
  // a credential. The previous resolver accepted it and returned the principal.
  it("returns null for a raw user id", async () => {
    const db = {
      user: { findUnique: vi.fn() },
      tenant: { findUnique: vi.fn() },
    } as never;
    const resolver = createSessionUserResolver(db, makeService());
    expect(await resolver.resolveUser("u1")).toBeNull();
    // It never even reaches the database: no signature, no lookup.
    expect((db as { user: { findUnique: ReturnType<typeof vi.fn> } }).user.findUnique)
      .not.toHaveBeenCalled();
  });

  it("returns null when the user is missing or inactive", async () => {
    const service = makeService();
    const issued = await startSession({
      userId: "u1",
      tenantId: "t1",
      role: "CASHIER",
      service,
    });
    const db = {
      user: { findUnique: vi.fn().mockResolvedValue(null) },
      tenant: { findUnique: vi.fn() },
    } as never;
    const resolver = createSessionUserResolver(db, service);
    expect(await resolver.resolveUser(issued.accessToken)).toBeNull();
  });

  it("returns null when the tenant is inactive", async () => {
    const service = makeService();
    const issued = await startSession({
      userId: "u1",
      tenantId: "t1",
      role: "CASHIER",
      service,
    });
    const db = {
      user: {
        findUnique: vi
          .fn()
          .mockResolvedValue({ id: "u1", tenantId: "t1", isActive: true }),
      },
      tenant: {
        findUnique: vi.fn().mockResolvedValue({ id: "t1", isActive: false }),
      },
    } as never;
    const resolver = createSessionUserResolver(db, service);
    expect(await resolver.resolveUser(issued.accessToken)).toBeNull();
  });

  it("returns the principal for a valid token, live session, active user + tenant", async () => {
    const service = makeService();
    const issued = await startSession({
      userId: "u1",
      tenantId: "t1",
      role: "CASHIER",
      service,
    });
    const user = { id: "u1", tenantId: "t1", isActive: true };
    const tenant = { id: "t1", isActive: true };
    const db = {
      user: { findUnique: vi.fn().mockResolvedValue(user) },
      tenant: { findUnique: vi.fn().mockResolvedValue(tenant) },
    } as never;
    const resolver = createSessionUserResolver(db, service);
    expect(await resolver.resolveUser(issued.accessToken)).toEqual({
      user,
      tenant,
      sessionId: issued.sessionId,
    });
  });
});

describe("in-memory rate limiter", () => {
  it("allows up to the limit then blocks within the window", () => {
    const rl = createInMemoryRateLimiter(2, 60_000);
    expect(rl.check("k").allowed).toBe(true);
    expect(rl.check("k").allowed).toBe(true);
    const blocked = rl.check("k");
    expect(blocked.allowed).toBe(false);
    expect(blocked.remaining).toBe(0);
  });

  it("resets counts after the window elapses", () => {
    vi.useFakeTimers();
    try {
      const rl = createInMemoryRateLimiter(1, 1_000);
      expect(rl.check("k").allowed).toBe(true);
      expect(rl.check("k").allowed).toBe(false);
      vi.advanceTimersByTime(1_001);
      expect(rl.check("k").allowed).toBe(true);
    } finally {
      vi.useRealTimers();
    }
  });

  it("clears all buckets on reset()", () => {
    const rl = createInMemoryRateLimiter(1, 60_000);
    rl.check("k");
    rl.reset();
    expect(rl.check("k").allowed).toBe(true);
  });
});

describe("trpc middleware chain", () => {
  const appRouter = router({
    ping: publicProcedure.query(() => "pong"),
    boom: publicProcedure.query(() => {
      throw new Error("kaboom");
    }),
    known: publicProcedure.query(() => {
      throw new TRPCError({ code: "NOT_FOUND", message: "missing" });
    }),
  });
  const createCaller = createCallerFactory(appRouter);

  const ctx = {
    db: {} as never,
    auth: null,
    requestId: "req-test",
    clientId: "test-client",
  };

  afterEach(() => {
    // Restore a permissive limiter so other suites are unaffected.
    setRateLimiter(createInMemoryRateLimiter(100_000, 60_000));
  });

  it("normalises unknown errors into INTERNAL_SERVER_ERROR and logs them", async () => {
    const logs: string[] = [];
    const logger: Logger = {
      info: () => {},
      warn: () => {},
      error: (msg) => logs.push(msg),
    };
    setLogger(logger);
    setRateLimiter(createInMemoryRateLimiter(100_000, 60_000));
    const caller = createCaller(ctx);
    await expect(caller.boom()).rejects.toMatchObject({
      code: "INTERNAL_SERVER_ERROR",
    });
    expect(logs).toContain("trpc.unhandled");
    setLogger({
      info: (m, meta) => console.info(m, meta ?? {}),
      warn: (m, meta) => console.warn(m, meta ?? {}),
      error: (m, meta) => console.error(m, meta ?? {}),
    });
  });

  it("passes TRPCErrors through untouched", async () => {
    setRateLimiter(createInMemoryRateLimiter(100_000, 60_000));
    const caller = createCaller(ctx);
    await expect(caller.known()).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("rejects with TOO_MANY_REQUESTS once the limiter is exhausted", async () => {
    setRateLimiter(createInMemoryRateLimiter(1, 60_000));
    const caller = createCaller(ctx);
    await expect(caller.ping()).resolves.toBe("pong");
    await expect(caller.ping()).rejects.toMatchObject({
      code: "TOO_MANY_REQUESTS",
    });
  });
});
