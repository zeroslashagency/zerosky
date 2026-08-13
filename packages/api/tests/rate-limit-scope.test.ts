// Tests for how the rate-limit bucket (ctx.clientId) is derived.
//
// The bucket was originally IP-only, falling back to the literal string
// "anonymous". On localhost no forwarding header is set, so every request —
// from every user and tab — shared one 100/min bucket and ordinary UI
// navigation returned 429. These tests pin the per-user scoping.

import { describe, expect, it } from "vitest";
import { createContext } from "../src/context.js";
import type { AuthUser, UserResolver } from "../src/context.js";

/** A resolver that always returns the given principal. */
function resolverFor(auth: AuthUser | null): UserResolver {
  return { resolveUser: async () => auth };
}

function fakeAuth(userId: string, tenantId = "tenant-1"): AuthUser {
  return {
    user: { id: userId, tenantId } as AuthUser["user"],
    tenant: { id: tenantId } as AuthUser["tenant"],
  };
}

describe("rate-limit client id", () => {
  it("scopes to the authenticated user, not the shared IP", async () => {
    const alice = await createContext({
      req: { headers: {}, ip: "10.0.0.1" },
      resolver: resolverFor(fakeAuth("user-alice")),
    });
    const bob = await createContext({
      req: { headers: {}, ip: "10.0.0.1" },
      resolver: resolverFor(fakeAuth("user-bob")),
    });

    expect(alice.clientId).toBe("user:user-alice");
    expect(bob.clientId).toBe("user:user-bob");
    // Same IP must not collapse two staff members into one bucket.
    expect(alice.clientId).not.toBe(bob.clientId);
  });

  it("falls back to IP for unauthenticated requests", async () => {
    const ctx = await createContext({
      req: { headers: {}, ip: "10.0.0.7" },
      resolver: resolverFor(null),
    });

    expect(ctx.clientId).toBe("ip:10.0.0.7");
  });

  it("uses the first x-forwarded-for hop when no direct ip is present", async () => {
    const ctx = await createContext({
      req: { headers: { "x-forwarded-for": "203.0.113.5, 70.41.3.18" } },
      resolver: resolverFor(null),
    });

    expect(ctx.clientId).toBe("ip:203.0.113.5");
  });

  it("does not collapse distinct unauthenticated IPs into one bucket", async () => {
    const a = await createContext({
      req: { headers: {}, ip: "10.0.0.1" },
      resolver: resolverFor(null),
    });
    const b = await createContext({
      req: { headers: {}, ip: "10.0.0.2" },
      resolver: resolverFor(null),
    });

    expect(a.clientId).not.toBe(b.clientId);
    // Neither may degrade to the old catch-all value.
    expect(a.clientId).not.toBe("anonymous");
    expect(b.clientId).not.toBe("anonymous");
  });
});
