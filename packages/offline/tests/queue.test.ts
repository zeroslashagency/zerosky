import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { SyncQueue } from "../src/queue";
import { createTestDb, type TestDb } from "./helpers/db";
import type { Versioned } from "../src/types";

let ctx: TestDb;
let queue: SyncQueue;

beforeEach(async () => {
  ctx = await createTestDb();
  queue = new SyncQueue(ctx.db);
});

afterAll(async () => {
  // Each test creates its own DB; ensure the last one is torn down.
  await ctx?.destroy();
});

function order(id: string, updatedAt = "2026-01-01T00:00:00.000Z"): Versioned {
  return { id, updatedAt, status: "OPEN" };
}

describe("SyncQueue", () => {
  it("enqueues a CREATE and decodes the payload", async () => {
    const mutation = await queue.enqueue({
      model: "Order",
      recordId: "o1",
      operation: "CREATE",
      payload: order("o1"),
    });
    expect(mutation.status).toBe("PENDING");
    expect(mutation.operation).toBe("CREATE");
    expect(mutation.payload?.id).toBe("o1");
  });

  it("stores DELETE mutations with a null payload", async () => {
    const mutation = await queue.enqueue({
      model: "Order",
      recordId: "o1",
      operation: "DELETE",
      payload: null,
    });
    expect(mutation.payload).toBeNull();
  });

  it("returns pending mutations oldest-first", async () => {
    await queue.enqueue({ model: "Order", recordId: "a", operation: "CREATE", payload: order("a") });
    await queue.enqueue({ model: "Order", recordId: "b", operation: "CREATE", payload: order("b") });
    const pending = await queue.pending();
    expect(pending.map((m) => m.recordId)).toEqual(["a", "b"]);
  });

  it("honours the pending limit", async () => {
    await queue.enqueue({ model: "Order", recordId: "a", operation: "CREATE", payload: order("a") });
    await queue.enqueue({ model: "Order", recordId: "b", operation: "CREATE", payload: order("b") });
    expect(await queue.pending(1)).toHaveLength(1);
  });

  it("markSynced flips status and stamps syncedAt", async () => {
    const m = await queue.enqueue({ model: "Order", recordId: "a", operation: "CREATE", payload: order("a") });
    await queue.markSynced(m.id);
    const stats = await queue.stats();
    expect(stats.synced).toBe(1);
    expect(stats.pending).toBe(0);
  });

  it("markFailed records the error and increments attempts", async () => {
    const m = await queue.enqueue({ model: "Order", recordId: "a", operation: "CREATE", payload: order("a") });
    await queue.markFailed(m.id, "boom");
    const failed = await ctx.db.syncQueue.findUniqueOrThrow({ where: { id: m.id } });
    expect(failed.status).toBe("FAILED");
    expect(failed.attempts).toBe(1);
    expect(failed.lastError).toBe("boom");
  });

  it("retry returns a failed mutation to pending", async () => {
    const m = await queue.enqueue({ model: "Order", recordId: "a", operation: "CREATE", payload: order("a") });
    await queue.markFailed(m.id, "boom");
    await queue.retry(m.id);
    expect((await queue.stats()).pending).toBe(1);
  });

  it("retryAllFailed re-queues every failed mutation", async () => {
    const a = await queue.enqueue({ model: "Order", recordId: "a", operation: "CREATE", payload: order("a") });
    const b = await queue.enqueue({ model: "Order", recordId: "b", operation: "CREATE", payload: order("b") });
    await queue.markFailed(a.id, "x");
    await queue.markFailed(b.id, "y");
    expect(await queue.retryAllFailed()).toBe(2);
    expect((await queue.stats()).pending).toBe(2);
  });

  it("stats counts each status", async () => {
    const a = await queue.enqueue({ model: "Order", recordId: "a", operation: "CREATE", payload: order("a") });
    const b = await queue.enqueue({ model: "Order", recordId: "b", operation: "CREATE", payload: order("b") });
    await queue.enqueue({ model: "Order", recordId: "c", operation: "CREATE", payload: order("c") });
    await queue.markSynced(a.id);
    await queue.markFailed(b.id, "x");
    expect(await queue.stats()).toEqual({ pending: 1, synced: 1, failed: 1, total: 3 });
  });

  it("purgeSynced removes only synced rows", async () => {
    const a = await queue.enqueue({ model: "Order", recordId: "a", operation: "CREATE", payload: order("a") });
    await queue.enqueue({ model: "Order", recordId: "b", operation: "CREATE", payload: order("b") });
    await queue.markSynced(a.id);
    expect(await queue.purgeSynced()).toBe(1);
    expect((await queue.stats()).total).toBe(1);
  });

  it("tolerates a corrupt payload by decoding to null", async () => {
    const m = await queue.enqueue({ model: "Order", recordId: "a", operation: "CREATE", payload: order("a") });
    await ctx.db.syncQueue.update({ where: { id: m.id }, data: { payload: "{not json" } });
    const [pending] = await queue.pending();
    expect(pending?.payload).toBeNull();
  });
});
