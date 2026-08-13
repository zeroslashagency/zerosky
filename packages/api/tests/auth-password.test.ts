// Regression tests for auth.login password verification.
//
// Context: auth.login originally looked the user up by email and returned a
// token WITHOUT ever comparing the supplied password against the stored bcrypt
// hash, so any password authenticated any account. These tests drive the real
// appRouter caller so they fail if that check is removed again.

import { beforeAll, describe, expect, it } from "vitest";
import {
  createAuthService,
  createInMemorySessionStore,
  hashPassword,
  setAuthService,
} from "@zerosky/auth";
import { appRouter } from "../src/index.js";
import type { Context } from "../src/context.js";

beforeAll(() => {
  // Deterministic secret + in-memory sessions: this suite stays hermetic.
  process.env.JWT_SECRET ??= "auth-password-test-secret-".padEnd(48, "x");
  setAuthService(createAuthService({ redis: createInMemorySessionStore() }));
});

const TENANT_ID = "tenant-pw-test";
const CORRECT_PASSWORD = "correct-horse-battery";

/**
 * Build a Context backed by a hand-rolled fake `db` exposing only the two
 * queries auth.login performs. This keeps the test hermetic (no Postgres)
 * while still executing the real router, real Zod schema, real middleware
 * chain, and the real bcrypt comparison.
 */
async function createTestContext(): Promise<Context> {
  const passwordHash = await hashPassword(CORRECT_PASSWORD, 4); // low rounds = fast test

  const user = {
    id: "user-pw-test",
    tenantId: TENANT_ID,
    email: "owner@example.test",
    name: "Test Owner",
    role: "OWNER",
    passwordHash,
    pinHash: null,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const tenant = {
    id: TENANT_ID,
    name: "Test Tenant",
    slug: "test-tenant",
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const db = {
    tenant: {
      findUnique: async ({ where }: { where: { slug?: string; id?: string } }) =>
        where.slug === tenant.slug || where.id === tenant.id ? tenant : null,
    },
    user: {
      findUnique: async ({
        where,
      }: {
        where: { tenantId_email?: { tenantId: string; email: string } };
      }) => {
        const key = where.tenantId_email;
        if (!key) return null;
        return key.tenantId === user.tenantId && key.email === user.email
          ? user
          : null;
      },
    },
  };

  return {
    db: db as unknown as Context["db"],
    auth: null,
    requestId: "req-pw-test",
    clientId: `pw-test-${Math.random().toString(36).slice(2)}`,
  } as Context;
}

describe("auth.login password verification", () => {
  it("rejects a wrong password with UNAUTHORIZED", async () => {
    const caller = appRouter.createCaller(await createTestContext());

    await expect(
      caller.auth.login({
        tenantSlug: "test-tenant",
        email: "owner@example.test",
        password: "definitely-not-the-password",
      }),
    ).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });

  it("accepts the correct password and returns the user", async () => {
    const caller = appRouter.createCaller(await createTestContext());

    const result = await caller.auth.login({
      tenantSlug: "test-tenant",
      email: "owner@example.test",
      password: CORRECT_PASSWORD,
    });

    expect(result.user.email).toBe("owner@example.test");
    expect(result.user.role).toBe("OWNER");
    // The token must be a signed JWT, never the raw user id.
    expect(result.token).not.toBe("user-pw-test");
    expect(result.token.split(".")).toHaveLength(3);
  });

  it("rejects an empty password", async () => {
    const caller = appRouter.createCaller(await createTestContext());

    await expect(
      caller.auth.login({
        tenantSlug: "test-tenant",
        email: "owner@example.test",
        password: "",
      }),
    ).rejects.toBeTruthy();
  });

  it("does not leak whether the email exists", async () => {
    const caller = appRouter.createCaller(await createTestContext());

    const unknownEmail = caller.auth
      .login({
        tenantSlug: "test-tenant",
        email: "nobody@example.test",
        password: CORRECT_PASSWORD,
      })
      .catch((e: { message: string }) => e.message);

    const wrongPassword = caller.auth
      .login({
        tenantSlug: "test-tenant",
        email: "owner@example.test",
        password: "wrong",
      })
      .catch((e: { message: string }) => e.message);

    // Both failure modes must produce the same message so an attacker cannot
    // enumerate valid accounts.
    expect(await unknownEmail).toBe(await wrongPassword);
  });
});
