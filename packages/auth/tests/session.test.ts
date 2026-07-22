import RedisMock from "ioredis-mock";
import { beforeEach, describe, expect, it } from "vitest";
import { SessionError, SessionManager } from "../src/session.js";

function makeManager() {
  // ioredis-mock is API-compatible with ioredis for the ops we use.
  const redis = new RedisMock();
  return new SessionManager(redis as unknown as import("ioredis").default, 3600);
}

describe("SessionManager", () => {
  let mgr: SessionManager;

  beforeEach(() => {
    mgr = makeManager();
  });

  it("creates and reads a session", async () => {
    await mgr.create({
      sessionId: "s1",
      userId: "u1",
      tenantId: "t1",
      role: "CASHIER",
      refreshToken: "rt-1",
    });
    const rec = await mgr.get("s1");
    expect(rec?.userId).toBe("u1");
    expect(rec?.tenantId).toBe("t1");
    expect(rec?.role).toBe("CASHIER");
    expect(rec?.refreshTokenHash).not.toBe("rt-1");
    expect(await mgr.exists("s1")).toBe(true);
  });

  it("returns null for missing session", async () => {
    expect(await mgr.get("nope")).toBeNull();
    expect(await mgr.exists("nope")).toBe(false);
  });

  it("rotates the refresh token when the presented token matches", async () => {
    await mgr.create({
      sessionId: "s1",
      userId: "u1",
      tenantId: "t1",
      role: "MANAGER",
      refreshToken: "rt-1",
    });
    const before = await mgr.get("s1");
    const updated = await mgr.rotate("s1", "rt-1", "rt-2");
    expect(updated.refreshTokenHash).not.toBe(before?.refreshTokenHash);
    // New token now validates, old one does not.
    await expect(mgr.rotate("s1", "rt-1", "rt-3")).rejects.toThrow(SessionError);
  });

  it("revokes session and throws on stale refresh token reuse", async () => {
    await mgr.create({
      sessionId: "s1",
      userId: "u1",
      tenantId: "t1",
      role: "OWNER",
      refreshToken: "rt-1",
    });
    await expect(mgr.rotate("s1", "wrong-token", "rt-2")).rejects.toThrow(
      /reuse detected/,
    );
    // Session was revoked defensively.
    expect(await mgr.exists("s1")).toBe(false);
  });

  it("throws when rotating a non-existent session", async () => {
    await expect(mgr.rotate("ghost", "rt", "rt2")).rejects.toThrow(SessionError);
  });

  it("revoke removes the session", async () => {
    await mgr.create({
      sessionId: "s1",
      userId: "u1",
      tenantId: "t1",
      role: "WAITER",
      refreshToken: "rt-1",
    });
    await mgr.revoke("s1");
    expect(await mgr.exists("s1")).toBe(false);
  });
});
