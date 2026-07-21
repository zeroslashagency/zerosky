import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { OfflineStore } from "../src/crud";
import { ConnectivityMonitor } from "../src/network";
import { SyncQueue } from "../src/queue";
import { SyncWorker } from "../src/sync";
import { createTestDb, type TestDb } from "./helpers/db";
import type { PushResult, QueuedMutation, SyncTransport, Versioned } from "../src/types";

let ctx: TestDb;
let queue: SyncQueue;

interface TenantRow {
  id: string;
  name: string;
  slug: string;
  updatedAt: Date;
  [key: string]: unknown;
}

beforeEach(async () => {
  ctx = await createTestDb();
  queue = new SyncQueue(ctx.db);
});

afterEach(async () => {
  await ctx.destroy();
});

/** Transport that records every push and returns a scripted result. */
class ScriptedTransport implements SyncTransport {
  readonly pushes: QueuedMutation[] = [];
  constructor(private readonly handler: (m: QueuedMutation) => Promise<PushResult> | PushResult) {}
  async push(mutation: QueuedMutation): Promise<PushResult> {
    this.pushes.push(mutation);
    return this.handler(mutation);
  }
}

function server(id: string, updatedAt: string, extra: Record<string, unknown> = {}): Versioned {
  return { id, updatedAt, ...extra };
}

describe("SyncWorker offline behaviour", () => {
  it("skips draining while offline and keeps mutations pending", async () => {
    const transport = new ScriptedTransport(() => ({ ok: true }));
    const network = new ConnectivityMonitor({ initialOnline: false });
    const worker = new SyncWorker({ queue, transport, network });

    await queue.enqueue({ model: "Order", recordId: "a", operation: "CREATE", payload: server("a", "2026-01-01T00:00:00.000Z") });

    const result = await worker.syncOnce();
    expect(result.skippedOffline).toBe(true);
    expect(transport.pushes).toHaveLength(0);
    expect((await queue.stats()).pending).toBe(1);
  });

  it("drains queued mutations once back online", async () => {
    const transport = new ScriptedTransport(() => ({ ok: true }));
    const network = new ConnectivityMonitor({ initialOnline: false });
    const worker = new SyncWorker({ queue, transport, network });

    await queue.enqueue({ model: "Order", recordId: "a", operation: "CREATE", payload: server("a", "2026-01-01T00:00:00.000Z") });
    await queue.enqueue({ model: "Order", recordId: "b", operation: "CREATE", payload: server("b", "2026-01-01T00:00:00.000Z") });

    network.setOnline(true);
    const result = await worker.syncOnce();

    expect(result.synced).toBe(2);
    expect(result.failed).toBe(0);
    expect((await queue.stats()).synced).toBe(2);
  });

  it("auto-drains when connectivity is regained via start()", async () => {
    const transport = new ScriptedTransport(() => ({ ok: true }));
    const network = new ConnectivityMonitor({ initialOnline: false });
    const worker = new SyncWorker({ queue, transport, network, intervalMs: 1_000_000 });

    await queue.enqueue({ model: "Order", recordId: "a", operation: "CREATE", payload: server("a", "2026-01-01T00:00:00.000Z") });

    worker.start();
    expect(worker.isRunning).toBe(true);
    network.setOnline(true); // triggers listener-driven drain

    // Allow the fire-and-forget drain to settle.
    await vi.waitFor(async () => {
      expect((await queue.stats()).synced).toBe(1);
    });
    worker.stop();
    expect(worker.isRunning).toBe(false);
  });
});

describe("SyncWorker end-to-end with OfflineStore", () => {
  it("captures offline writes then syncs them", async () => {
    const store = new OfflineStore(ctx.db, queue);
    const transport = new ScriptedTransport(() => ({ ok: true }));
    const network = new ConnectivityMonitor({ initialOnline: false });
    const worker = new SyncWorker({ queue, transport, network });

    const tenants = store.model<TenantRow>("Tenant");
    await tenants.create({ name: "Acme", slug: "acme" });
    await tenants.update((await tenants.findMany())[0]!.id, { name: "Acme Foods" });

    expect((await queue.stats()).pending).toBe(2);

    network.setOnline(true);
    const result = await worker.syncOnce();
    expect(result.synced).toBe(2);
  });
});

describe("SyncWorker conflict resolution", () => {
  it("last-write-wins: local newer → forced overwrite", async () => {
    let attempt = 0;
    const transport = new ScriptedTransport(() => {
      attempt += 1;
      // First push conflicts with an older server copy; retry succeeds.
      return attempt === 1
        ? { ok: false, conflict: server("a", "2026-01-01T00:00:00.000Z") }
        : { ok: true };
    });
    const worker = new SyncWorker({ queue, transport, strategy: "last-write-wins" });

    await queue.enqueue({
      model: "Order",
      recordId: "a",
      operation: "UPDATE",
      payload: server("a", "2026-06-01T00:00:00.000Z", { name: "local" }),
    });

    const result = await worker.syncOnce();
    expect(result.synced).toBe(1);
    expect(transport.pushes).toHaveLength(2); // original + forced overwrite
    expect((await queue.stats()).synced).toBe(1);
  });

  it("last-write-wins: server newer → local change dropped", async () => {
    const transport = new ScriptedTransport(() => ({
      ok: false,
      conflict: server("a", "2026-12-01T00:00:00.000Z"),
    }));
    const worker = new SyncWorker({ queue, transport, strategy: "last-write-wins" });

    await queue.enqueue({
      model: "Order",
      recordId: "a",
      operation: "UPDATE",
      payload: server("a", "2026-01-01T00:00:00.000Z", { name: "local" }),
    });

    const result = await worker.syncOnce();
    expect(result.synced).toBe(1); // resolved by accepting server
    expect(transport.pushes).toHaveLength(1); // no overwrite attempt
    expect((await queue.stats()).synced).toBe(1);
  });

  it("server-wins: always accepts the server copy without overwrite", async () => {
    const transport = new ScriptedTransport(() => ({
      ok: false,
      conflict: server("a", "2020-01-01T00:00:00.000Z"),
    }));
    const worker = new SyncWorker({ queue, transport, strategy: "server-wins" });

    await queue.enqueue({
      model: "Order",
      recordId: "a",
      operation: "UPDATE",
      payload: server("a", "2026-06-01T00:00:00.000Z"),
    });

    await worker.syncOnce();
    expect(transport.pushes).toHaveLength(1);
    expect((await queue.stats()).synced).toBe(1);
  });

  it("DELETE conflict resolves to synced (no payload to compare)", async () => {
    const transport = new ScriptedTransport(() => ({
      ok: false,
      conflict: server("a", "2026-01-01T00:00:00.000Z"),
    }));
    const worker = new SyncWorker({ queue, transport, strategy: "last-write-wins" });

    await queue.enqueue({ model: "Order", recordId: "a", operation: "DELETE", payload: null });
    const result = await worker.syncOnce();
    expect(result.synced).toBe(1);
    expect(transport.pushes).toHaveLength(1);
  });

  it("marks a mutation FAILED when the forced overwrite is rejected", async () => {
    const transport = new ScriptedTransport(() => ({
      ok: false,
      conflict: server("a", "2020-01-01T00:00:00.000Z"),
    }));
    const worker = new SyncWorker({ queue, transport, strategy: "client-wins" });

    await queue.enqueue({
      model: "Order",
      recordId: "a",
      operation: "UPDATE",
      payload: server("a", "2026-06-01T00:00:00.000Z"),
    });

    const result = await worker.syncOnce();
    expect(result.failed).toBe(1);
    const stats = await queue.stats();
    expect(stats.failed).toBe(1);
  });
});

describe("SyncWorker error handling", () => {
  it("marks a mutation FAILED on a thrown (transient) error", async () => {
    const transport = new ScriptedTransport(() => {
      throw new Error("connection reset");
    });
    const worker = new SyncWorker({ queue, transport });

    const m = await queue.enqueue({ model: "Order", recordId: "a", operation: "CREATE", payload: server("a", "2026-01-01T00:00:00.000Z") });
    const result = await worker.syncOnce();

    expect(result.failed).toBe(1);
    const row = await ctx.db.syncQueue.findUniqueOrThrow({ where: { id: m.id } });
    expect(row.status).toBe("FAILED");
    expect(row.lastError).toContain("connection reset");
    expect(row.attempts).toBe(1);
  });

  it("recovers failed mutations after retryAllFailed + successful sync", async () => {
    let failNext = true;
    const transport = new ScriptedTransport(() => {
      if (failNext) {
        failNext = false;
        throw new Error("temporary");
      }
      return { ok: true };
    });
    const worker = new SyncWorker({ queue, transport });

    await queue.enqueue({ model: "Order", recordId: "a", operation: "CREATE", payload: server("a", "2026-01-01T00:00:00.000Z") });
    await worker.syncOnce(); // fails
    expect((await queue.stats()).failed).toBe(1);

    await queue.retryAllFailed();
    const result = await worker.syncOnce(); // succeeds
    expect(result.synced).toBe(1);
    expect((await queue.stats()).synced).toBe(1);
  });

  it("collapses concurrent drains (draining guard)", async () => {
    let inFlight = 0;
    let maxConcurrent = 0;
    const transport = new ScriptedTransport(async () => {
      inFlight += 1;
      maxConcurrent = Math.max(maxConcurrent, inFlight);
      await new Promise((r) => setTimeout(r, 10));
      inFlight -= 1;
      return { ok: true };
    });
    const worker = new SyncWorker({ queue, transport });

    await queue.enqueue({ model: "Order", recordId: "a", operation: "CREATE", payload: server("a", "2026-01-01T00:00:00.000Z") });

    const [first, second] = await Promise.all([worker.syncOnce(), worker.syncOnce()]);
    // One drain does the work; the other short-circuits.
    const totalSynced = first.synced + second.synced;
    expect(totalSynced).toBe(1);
    expect(maxConcurrent).toBe(1);
  });

  it("stats() passes through the queue counts", async () => {
    const transport = new ScriptedTransport(() => ({ ok: true }));
    const worker = new SyncWorker({ queue, transport });
    await queue.enqueue({ model: "Order", recordId: "a", operation: "CREATE", payload: server("a", "2026-01-01T00:00:00.000Z") });
    expect((await worker.stats()).pending).toBe(1);
  });
});
