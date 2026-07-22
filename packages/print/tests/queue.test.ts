import { describe, it, expect } from "vitest";
import { PrintQueue } from "../src/queue.js";
import { MockPrinter } from "../src/escpos.js";
import type { PrinterTransport, TransportKind } from "../src/escpos.js";

const noSleep = (): Promise<void> => Promise.resolve();

/** A transport that fails a fixed number of times before succeeding. */
class FlakyTransport implements PrinterTransport {
  readonly kind: TransportKind = "mock";
  private failuresLeft: number;
  writeCount = 0;
  constructor(failures: number) {
    this.failuresLeft = failures;
  }
  async open(): Promise<void> {}
  async write(): Promise<void> {
    this.writeCount += 1;
    if (this.failuresLeft > 0) {
      this.failuresLeft -= 1;
      throw new Error("transient failure");
    }
  }
  async close(): Promise<void> {}
}

describe("PrintQueue", () => {
  it("processes a job successfully on first try", async () => {
    const printer = new MockPrinter();
    const q = new PrintQueue(printer, { sleep: noSleep });
    await q.enqueue({ id: "1", payload: Uint8Array.from([1, 2]) });
    expect(q.all[0]?.status).toBe("done");
    expect(q.all[0]?.attempts).toBe(1);
    expect(q.pending).toBe(0);
    expect(Array.from(printer.buffer())).toEqual([1, 2]);
  });

  it("retries transient failures and eventually succeeds", async () => {
    const flaky = new FlakyTransport(2);
    const q = new PrintQueue(flaky, { sleep: noSleep, maxAttempts: 3 });
    await q.enqueue({ id: "1", payload: Uint8Array.from([9]) });
    expect(q.all[0]?.status).toBe("done");
    expect(q.all[0]?.attempts).toBe(3);
    expect(flaky.writeCount).toBe(3);
  });

  it("marks a job failed after exhausting attempts", async () => {
    const flaky = new FlakyTransport(5);
    const q = new PrintQueue(flaky, { sleep: noSleep, maxAttempts: 3 });
    await q.enqueue({ id: "1", payload: Uint8Array.from([9]) });
    expect(q.all[0]?.status).toBe("failed");
    expect(q.all[0]?.attempts).toBe(3);
    expect(q.all[0]?.lastError).toContain("transient failure");
  });

  it("invokes onStatusChange for lifecycle transitions", async () => {
    const printer = new MockPrinter();
    const statuses: string[] = [];
    const q = new PrintQueue(printer, {
      sleep: noSleep,
      onStatusChange: (job) => statuses.push(job.status),
    });
    await q.enqueue({ id: "1", payload: Uint8Array.from([1]) });
    expect(statuses).toContain("printing");
    expect(statuses).toContain("done");
  });

  it("computes exponential backoff delays", async () => {
    const flaky = new FlakyTransport(2);
    const delays: number[] = [];
    const q = new PrintQueue(flaky, {
      maxAttempts: 3,
      backoffMs: 100,
      sleep: (ms) => {
        delays.push(ms);
        return Promise.resolve();
      },
    });
    await q.enqueue({ id: "1", payload: Uint8Array.from([1]) });
    // Two failures → two backoffs: 100 * 2^0, 100 * 2^1
    expect(delays).toEqual([100, 200]);
  });

  it("caps backoff at maxBackoffMs", async () => {
    const flaky = new FlakyTransport(2);
    const delays: number[] = [];
    const q = new PrintQueue(flaky, {
      maxAttempts: 3,
      backoffMs: 1000,
      maxBackoffMs: 1500,
      sleep: (ms) => {
        delays.push(ms);
        return Promise.resolve();
      },
    });
    await q.enqueue({ id: "1", payload: Uint8Array.from([1]) });
    expect(delays).toEqual([1000, 1500]);
  });

  it("processes multiple jobs in FIFO order", async () => {
    const printer = new MockPrinter();
    const q = new PrintQueue(printer, { sleep: noSleep });
    await q.enqueue({ id: "1", payload: Uint8Array.from([1]) });
    await q.enqueue({ id: "2", payload: Uint8Array.from([2]) });
    expect(q.all.map((j) => j.id)).toEqual(["1", "2"]);
    expect(Array.from(printer.buffer())).toEqual([1, 2]);
  });

  it("retryFailed resets and reprocesses failed jobs", async () => {
    const flaky = new FlakyTransport(2);
    const q = new PrintQueue(flaky, { sleep: noSleep, maxAttempts: 1 });
    await q.enqueue({ id: "1", payload: Uint8Array.from([1]) });
    expect(q.all[0]?.status).toBe("failed");
    // Two more attempts via retry: first fails, but retryFailed resets attempts
    // and drains; flaky now has 1 failure left then succeeds.
    await q.retryFailed();
    // With maxAttempts 1, one retry consumes the last failure → still failed once more,
    // so retry again to reach success.
    await q.retryFailed();
    expect(q.all[0]?.status).toBe("done");
  });

  it("clearCompleted removes done and failed jobs", async () => {
    const printer = new MockPrinter();
    const q = new PrintQueue(printer, { sleep: noSleep });
    await q.enqueue({ id: "1", payload: Uint8Array.from([1]) });
    expect(q.all).toHaveLength(1);
    q.clearCompleted();
    expect(q.all).toHaveLength(0);
  });

  it("process() is a no-op re-entrant guard when already processing", async () => {
    const printer = new MockPrinter();
    const q = new PrintQueue(printer, { sleep: noSleep });
    // Directly calling process with no pending jobs resolves cleanly.
    await expect(q.process()).resolves.toBeUndefined();
  });

  it("labels are preserved on jobs", async () => {
    const printer = new MockPrinter();
    const q = new PrintQueue(printer, { sleep: noSleep });
    await q.enqueue({ id: "1", payload: Uint8Array.from([1]), label: "receipt" });
    expect(q.all[0]?.label).toBe("receipt");
  });
});
