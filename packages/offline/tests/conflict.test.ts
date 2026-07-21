import { describe, expect, it } from "vitest";
import {
  clientWins,
  getResolver,
  lastWriteWins,
  resolveConflict,
  serverWins,
} from "../src/conflict";
import type { Versioned } from "../src/types";

function rec(id: string, updatedAt: string, extra: Record<string, unknown> = {}): Versioned {
  return { id, updatedAt, ...extra };
}

describe("lastWriteWins", () => {
  it("picks the record with the newer updatedAt", () => {
    const local = rec("1", "2026-01-02T00:00:00.000Z", { v: "local" });
    const server = rec("1", "2026-01-01T00:00:00.000Z", { v: "server" });
    const decision = lastWriteWins(local, server);
    expect(decision.winner).toBe("local");
    expect(decision.resolved).toBe(local);
  });

  it("picks the server when it is newer", () => {
    const local = rec("1", "2026-01-01T00:00:00.000Z");
    const server = rec("1", "2026-01-03T00:00:00.000Z");
    expect(lastWriteWins(local, server).winner).toBe("server");
  });

  it("resolves ties to the server", () => {
    const ts = "2026-01-01T00:00:00.000Z";
    expect(lastWriteWins(rec("1", ts), rec("1", ts)).winner).toBe("server");
  });

  it("accepts Date instances", () => {
    const local = { id: "1", updatedAt: new Date(2026, 0, 2) };
    const server = { id: "1", updatedAt: new Date(2026, 0, 1) };
    expect(lastWriteWins(local, server).winner).toBe("local");
  });

  it("treats an unparseable local timestamp as epoch 0 (server wins)", () => {
    const local = rec("1", "not-a-date");
    const server = rec("1", "2026-01-01T00:00:00.000Z");
    expect(lastWriteWins(local, server).winner).toBe("server");
  });
});

describe("serverWins", () => {
  it("always returns the server record", () => {
    const local = rec("1", "2026-01-09T00:00:00.000Z");
    const server = rec("1", "2026-01-01T00:00:00.000Z");
    const decision = serverWins(local, server);
    expect(decision.winner).toBe("server");
    expect(decision.resolved).toBe(server);
  });
});

describe("clientWins", () => {
  it("always returns the local record", () => {
    const local = rec("1", "2026-01-01T00:00:00.000Z");
    const server = rec("1", "2026-01-09T00:00:00.000Z");
    const decision = clientWins(local, server);
    expect(decision.winner).toBe("local");
    expect(decision.resolved).toBe(local);
  });
});

describe("getResolver / resolveConflict", () => {
  it("maps strategy names to resolvers", () => {
    expect(getResolver("last-write-wins")).toBe(lastWriteWins);
    expect(getResolver("server-wins")).toBe(serverWins);
    expect(getResolver("client-wins")).toBe(clientWins);
  });

  it("applies a named strategy", () => {
    const local = rec("1", "2026-01-05T00:00:00.000Z");
    const server = rec("1", "2026-01-01T00:00:00.000Z");
    expect(resolveConflict("server-wins", local, server).winner).toBe("server");
    expect(resolveConflict("last-write-wins", local, server).winner).toBe("local");
  });
});
