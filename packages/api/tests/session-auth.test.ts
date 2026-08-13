// Session/token verification tests for @zerosky/api.
//
// THE VULNERABILITY these lock down: the session token used to be the raw user
// id, and the context resolved it with `db.user.findUnique({ where: { id: token } })`.
// No signature, no expiry, no revocation — anyone holding a user id could
// impersonate that user forever. "rejects a raw user id" is the regression test
// for exactly that and fails against the old resolver.
//
// The resolver now requires BOTH a valid access-JWT signature AND a live Redis
// session, so each half is tested independently.

import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import jwt from "jsonwebtoken";
import {
  createAuthService,
  createInMemorySessionStore,
  hashPassword,
  hashPin,
  resolveJwtConfig,
  setAuthService,
  startSession,
  type AuthService,
} from "@zerosky/auth";
import { appRouter } from "../src/index.js";
import {
  createContext,
  createSessionUserResolver,
  extractToken,
  readCookie,
  type Context,
} from "../src/context.js";

const TENANT_ID = "tenant-session-test";
const USER_ID = "user-session-test";
const PASSWORD = "session-test-password";
const PIN = "4821";

/** Strong, deterministic secret for this suite. Never a production value. */
const TEST_SECRET = "session-auth-test-secret-0123456789abcdef";
const TEST_REFRESH_SECRET = "session-auth-test-refresh-0123456789abcdef";

let service: AuthService;
let passwordHash: string;
let pinHash: string;

const tenant = {
  id: TENANT_ID,
  name: "Session Test Tenant",
  slug: "session-test-tenant",
  isActive: true,
  createdAt: new Date(),
  updatedAt: new Date(),
};

function makeUser() {
  return {
    id: USER_ID,
    tenantId: TENANT_ID,
    email: "cashier@session.test",
    name: "Session Cashier",
    role: "CASHIER",
    passwordHash,
    pinHash,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

/** Hermetic fake db covering only what auth + the resolver query. */
function makeDb() {
  const user = makeUser();
  return {
    tenant: {
      findUnique: async ({ where }: { where: { slug?: string; id?: string } }) =>
        where.slug === tenant.slug || where.id === tenant.id ? tenant : null,
    },
    user: {
      findUnique: async ({
        where,
      }: {
        where: { id?: string; tenantId_email?: { tenantId: string; email: string } };
      }) => {
        if (where.id) return where.id === user.id ? user : null;
        const key = where.tenantId_email;
        if (!key) return null;
        return key.tenantId === user.tenantId && key.email === user.email
          ? user
          : null;
      },
      findMany: async ({ where }: { where: { tenantId: string } }) =>
        where.tenantId === user.tenantId ? [user] : [],
    },
  };
}

async function contextForToken(token: string | null): Promise<Context> {
  const db = makeDb() as unknown as Context["db"];
  return createContext({
    db,
    resolver: createSessionUserResolver(db, service),
    req: {
      headers: token ? { authorization: `Bearer ${token}` } : {},
      ip: `127.0.0.${Math.floor(Math.random() * 250) + 1}`,
    },
  });
}

async function loginContext(): Promise<Context> {
  const db = makeDb() as unknown as Context["db"];
  return {
    db,
    auth: null,
    requestId: "req-session-test",
    clientId: `session-test-${Math.random().toString(36).slice(2)}`,
  } as Context;
}

beforeAll(async () => {
  // Deterministic secrets so tokens can also be forged/expired by hand below.
  process.env.JWT_SECRET = TEST_SECRET;
  process.env.JWT_REFRESH_SECRET = TEST_REFRESH_SECRET;
  passwordHash = await hashPassword(PASSWORD, 4);
  pinHash = await hashPin(PIN);
});

beforeEach(() => {
  // Fresh store per test so revocation in one test cannot leak into another.
  // The router helpers (startSession/refreshSession/logout) reach for the
  // process singleton, so it must be the same instance the resolver uses.
  service = createAuthService({ redis: createInMemorySessionStore() });
  setAuthService(service);
});

afterAll(() => {
  setAuthService(null);
});

describe("token extraction", () => {
  it("reads the token from the httpOnly cookie when no header is present", () => {
    expect(
      extractToken({ headers: { cookie: "theme=dark; auth_token=abc.def.ghi" } }),
    ).toBe("abc.def.ghi");
  });

  it("prefers the Authorization header over the cookie", () => {
    expect(
      extractToken({
        headers: { authorization: "Bearer header-token", cookie: "auth_token=cookie-token" },
      }),
    ).toBe("header-token");
  });

  it("returns null when neither is present", () => {
    expect(extractToken({ headers: { cookie: "theme=dark" } })).toBeNull();
    expect(readCookie(null, "auth_token")).toBeNull();
    expect(readCookie("auth_token=", "auth_token")).toBeNull();
  });

  it("url-decodes cookie values", () => {
    expect(readCookie("auth_token=a%2Bb", "auth_token")).toBe("a+b");
  });
});

describe("session resolution", () => {
  it("accepts a freshly issued access token", async () => {
    const issued = await startSession({
      userId: USER_ID,
      tenantId: TENANT_ID,
      role: "CASHIER",
      service,
    });

    const ctx = await contextForToken(issued.accessToken);
    expect(ctx.auth).not.toBeNull();
    expect(ctx.auth?.user.id).toBe(USER_ID);
    expect(ctx.auth?.tenant.id).toBe(TENANT_ID);
    expect(ctx.auth?.sessionId).toBe(issued.sessionId);
  });

  // ── THE REGRESSION TEST FOR THE ACTUAL VULNERABILITY ──
  it("rejects a raw user id used as a token", async () => {
    const ctx = await contextForToken(USER_ID);
    expect(ctx.auth).toBeNull();
  });

  it("rejects an expired access token", async () => {
    const config = resolveJwtConfig({
      env: { JWT_SECRET: TEST_SECRET, JWT_REFRESH_SECRET: TEST_REFRESH_SECRET },
    });
    // Sign directly with a negative expiry: already expired on arrival.
    const expired = jwt.sign(
      {
        sub: USER_ID,
        tenantId: TENANT_ID,
        role: "CASHIER",
        type: "access",
        sessionId: "expired-session",
      },
      config.accessSecret,
      { expiresIn: -60, issuer: config.issuer },
    );

    // Session exists, so only expiry can be what rejects this.
    await service.sessions.create({
      sessionId: "expired-session",
      userId: USER_ID,
      tenantId: TENANT_ID,
      role: "CASHIER",
      refreshToken: "rt",
    });
    const ctx = await contextForToken(expired);
    expect(ctx.auth).toBeNull();
  });

  it("rejects a tampered access token", async () => {
    const issued = await startSession({
      userId: USER_ID,
      tenantId: TENANT_ID,
      role: "CASHIER",
      service,
    });

    // Flip the payload segment: same structure, broken signature.
    const [header, payload, signature] = issued.accessToken.split(".");
    const decoded = JSON.parse(
      Buffer.from(payload!, "base64url").toString("utf8"),
    );
    decoded.role = "OWNER";
    const forgedPayload = Buffer.from(JSON.stringify(decoded)).toString(
      "base64url",
    );
    const tampered = `${header}.${forgedPayload}.${signature}`;

    const ctx = await contextForToken(tampered);
    expect(ctx.auth).toBeNull();
  });

  it("rejects a token signed with the wrong secret", async () => {
    const forged = jwt.sign(
      {
        sub: USER_ID,
        tenantId: TENANT_ID,
        role: "OWNER",
        type: "access",
        sessionId: "forged-session",
      },
      "an-attacker-chosen-secret-that-is-long-enough",
      { expiresIn: 900 },
    );
    const ctx = await contextForToken(forged);
    expect(ctx.auth).toBeNull();
  });

  it("rejects a valid token whose Redis session was revoked", async () => {
    const issued = await startSession({
      userId: USER_ID,
      tenantId: TENANT_ID,
      role: "CASHIER",
      service,
    });

    // Sanity: it works before revocation.
    const before = await contextForToken(issued.accessToken);
    expect(before.auth).not.toBeNull();

    await service.sessions.revoke(issued.sessionId);

    // The JWT is still perfectly valid and unexpired — only the missing session
    // record can reject it.
    const after = await contextForToken(issued.accessToken);
    expect(after.auth).toBeNull();
  });

  it("rejects a refresh token presented as an access token", async () => {
    const issued = await startSession({
      userId: USER_ID,
      tenantId: TENANT_ID,
      role: "CASHIER",
      service,
    });
    const ctx = await contextForToken(issued.refreshToken);
    expect(ctx.auth).toBeNull();
  });

  it("rejects a token whose claims disagree with the stored session", async () => {
    const issued = await startSession({
      userId: "someone-else",
      tenantId: TENANT_ID,
      role: "CASHIER",
      service,
    });
    // Session belongs to "someone-else"; the db only knows USER_ID.
    const ctx = await contextForToken(issued.accessToken);
    expect(ctx.auth).toBeNull();
  });
});

describe("auth router with real sessions", () => {
  it("login returns a signed JWT pair and a live session", async () => {
    const caller = appRouter.createCaller(await loginContext());
    const res = await caller.auth.login({
      tenantSlug: tenant.slug,
      email: "cashier@session.test",
      password: PASSWORD,
    });

    expect(res.token).not.toBe(USER_ID);
    expect(res.token.split(".")).toHaveLength(3);
    expect(res.expiresIn).toBeGreaterThan(0);

    const payload = service.jwt.verify(res.token, "access");
    expect(payload.sub).toBe(USER_ID);
    expect(await service.sessions.exists(payload.sessionId)).toBe(true);
  });

  it("pinLogin authenticates against a hashed PIN", async () => {
    const caller = appRouter.createCaller(await loginContext());
    const res = await caller.auth.pinLogin({
      tenantSlug: tenant.slug,
      pin: PIN,
    });
    expect(res.user.id).toBe(USER_ID);
    expect(res.token).not.toBe(USER_ID);
  });

  it("pinLogin rejects a wrong PIN", async () => {
    const caller = appRouter.createCaller(await loginContext());
    await expect(
      caller.auth.pinLogin({ tenantSlug: tenant.slug, pin: "0000" }),
    ).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });

  it("logout revokes the session so the token stops working", async () => {
    const loginCaller = appRouter.createCaller(await loginContext());
    const res = await loginCaller.auth.login({
      tenantSlug: tenant.slug,
      email: "cashier@session.test",
      password: PASSWORD,
    });

    const authedCtx = await contextForToken(res.token);
    expect(authedCtx.auth).not.toBeNull();

    await appRouter.createCaller(authedCtx).auth.logout();

    const afterCtx = await contextForToken(res.token);
    expect(afterCtx.auth).toBeNull();
  });

  it("me is unreachable without a valid session", async () => {
    const ctx = await contextForToken(USER_ID);
    await expect(appRouter.createCaller(ctx).auth.me()).rejects.toThrow(
      /Authentication required/,
    );
  });

  it("refresh rotates the token pair", async () => {
    const loginCaller = appRouter.createCaller(await loginContext());
    const res = await loginCaller.auth.login({
      tenantSlug: tenant.slug,
      email: "cashier@session.test",
      password: PASSWORD,
    });

    const refreshCaller = appRouter.createCaller(await loginContext());
    const refreshed = await refreshCaller.auth.refresh({
      refreshToken: res.refreshToken,
    });
    expect(refreshed.refreshToken).not.toBe(res.refreshToken);

    const rotatedCtx = await contextForToken(refreshed.token);
    expect(rotatedCtx.auth?.user.id).toBe(USER_ID);
  });

  it("refresh rejects a garbage refresh token", async () => {
    const caller = appRouter.createCaller(await loginContext());
    await expect(
      caller.auth.refresh({ refreshToken: "not-a-jwt" }),
    ).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });
});
