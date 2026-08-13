// Tests for the AuthService seam: session issuance, refresh rotation, and the
// in-memory session store used when Redis is not configured in development.

import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  createAuthService,
  createInMemorySessionStore,
  getAuthService,
  refreshSession,
  setAuthService,
  startSession,
  type AuthService,
} from "../src/service.js";
import { SessionError } from "../src/session.js";

const SECRET = "service-test-secret-0123456789abcdefghij";

let service: AuthService;

beforeEach(() => {
  process.env.JWT_SECRET = SECRET;
  service = createAuthService({ redis: createInMemorySessionStore() });
  setAuthService(service);
});

afterEach(() => {
  setAuthService(null);
  delete process.env.JWT_SECRET;
});

describe("startSession", () => {
  it("issues a token pair and persists the session", async () => {
    const issued = await startSession({
      userId: "u1",
      tenantId: "t1",
      role: "MANAGER",
      service,
    });

    expect(issued.accessToken.split(".")).toHaveLength(3);
    expect(issued.refreshToken).not.toBe(issued.accessToken);
    expect(await service.sessions.exists(issued.sessionId)).toBe(true);

    const payload = service.jwt.verify(issued.accessToken, "access");
    expect(payload.sub).toBe("u1");
    expect(payload.tenantId).toBe("t1");
    expect(payload.role).toBe("MANAGER");
    expect(payload.sessionId).toBe(issued.sessionId);
  });

  it("gives every login a distinct session id", async () => {
    const a = await startSession({ userId: "u1", tenantId: "t1", role: "CASHIER", service });
    const b = await startSession({ userId: "u1", tenantId: "t1", role: "CASHIER", service });
    expect(a.sessionId).not.toBe(b.sessionId);
    // Revoking one terminal must not sign the other one out.
    await service.sessions.revoke(a.sessionId);
    expect(await service.sessions.exists(b.sessionId)).toBe(true);
  });

  it("uses the process singleton when no service is passed", async () => {
    const issued = await startSession({ userId: "u1", tenantId: "t1", role: "OWNER" });
    expect(await getAuthService().sessions.exists(issued.sessionId)).toBe(true);
  });
});

describe("refreshSession", () => {
  it("rotates the pair while keeping the session id", async () => {
    const first = await startSession({
      userId: "u1",
      tenantId: "t1",
      role: "WAITER",
      service,
    });
    const second = await refreshSession(first.refreshToken, service);

    expect(second.sessionId).toBe(first.sessionId);
    expect(second.refreshToken).not.toBe(first.refreshToken);
    expect(await service.sessions.exists(first.sessionId)).toBe(true);
  });

  it("revokes the session when a stale refresh token is replayed", async () => {
    const first = await startSession({
      userId: "u1",
      tenantId: "t1",
      role: "WAITER",
      service,
    });
    await refreshSession(first.refreshToken, service);

    // Replaying the superseded token is the signature of a stolen token.
    await expect(refreshSession(first.refreshToken, service)).rejects.toThrow(
      SessionError,
    );
    expect(await service.sessions.exists(first.sessionId)).toBe(false);
  });

  it("rejects an access token presented as a refresh token", async () => {
    const issued = await startSession({
      userId: "u1",
      tenantId: "t1",
      role: "OWNER",
      service,
    });
    await expect(refreshSession(issued.accessToken, service)).rejects.toThrow();
  });

  it("rejects a session that no longer exists", async () => {
    const issued = await startSession({
      userId: "u1",
      tenantId: "t1",
      role: "OWNER",
      service,
    });
    await service.sessions.revoke(issued.sessionId);
    await expect(refreshSession(issued.refreshToken, service)).rejects.toThrow(
      /session not found/,
    );
  });
});

describe("createInMemorySessionStore", () => {
  it("honours the EX ttl", async () => {
    const store = createInMemorySessionStore();
    await store.set("k", "v", "EX", 0);
    // A zero TTL is already in the past by the time it is read back.
    expect(await store.get("k")).toBeNull();
    expect(await store.exists("k")).toBe(0);
  });

  it("stores, reads, and deletes", async () => {
    const store = createInMemorySessionStore();
    await store.set("k", "v", "EX", 60);
    expect(await store.get("k")).toBe("v");
    expect(await store.exists("k")).toBe(1);
    expect(await store.del("k")).toBe(1);
    expect(await store.get("k")).toBeNull();
  });
});
