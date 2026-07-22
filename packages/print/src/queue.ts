// @zerosky/print — print queue with retry + backoff
// Serializes jobs to a single transport, retrying transient failures with
// exponential backoff. Transport-agnostic: works with any PrinterTransport.

import type { PrinterTransport } from "./escpos.js";
import { sendToPrinter } from "./escpos.js";

/** Lifecycle state of a queued print job. */
export type JobStatus = "pending" | "printing" | "done" | "failed";

/** A unit of work: a named payload to send to the printer. */
export interface PrintJob {
  id: string;
  payload: Uint8Array;
  /** Optional label for logging/observability. */
  label?: string;
}

/** A job plus its runtime bookkeeping. */
export interface QueuedJob extends PrintJob {
  status: JobStatus;
  attempts: number;
  lastError?: string;
}

/** Tuning knobs for the queue's retry behaviour. */
export interface QueueOptions {
  /** Max attempts per job before marking it failed. Default 3. */
  maxAttempts?: number;
  /** Base backoff in ms; delay = base * 2^(attempt-1). Default 100. */
  backoffMs?: number;
  /** Upper bound on a single backoff delay. Default 5000. */
  maxBackoffMs?: number;
  /** Injectable sleep (for tests). Defaults to setTimeout-based sleep. */
  sleep?: (ms: number) => Promise<void>;
  /** Called whenever a job's status changes. */
  onStatusChange?: (job: QueuedJob) => void;
}

const defaultSleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * FIFO print queue. Jobs are processed one at a time to avoid interleaving
 * byte streams on a shared device. Failed sends are retried with exponential
 * backoff up to `maxAttempts`.
 */
export class PrintQueue {
  private readonly transport: PrinterTransport;
  private readonly maxAttempts: number;
  private readonly backoffMs: number;
  private readonly maxBackoffMs: number;
  private readonly sleep: (ms: number) => Promise<void>;
  private readonly onStatusChange?: (job: QueuedJob) => void;

  private readonly jobs: QueuedJob[] = [];
  private processing = false;

  constructor(transport: PrinterTransport, options: QueueOptions = {}) {
    this.transport = transport;
    this.maxAttempts = options.maxAttempts ?? 3;
    this.backoffMs = options.backoffMs ?? 100;
    this.maxBackoffMs = options.maxBackoffMs ?? 5000;
    this.sleep = options.sleep ?? defaultSleep;
    this.onStatusChange = options.onStatusChange;
  }

  /** Number of jobs still pending or in flight. */
  get pending(): number {
    return this.jobs.filter((j) => j.status === "pending" || j.status === "printing").length;
  }

  /** Snapshot of all jobs (including completed/failed). */
  get all(): readonly QueuedJob[] {
    return this.jobs;
  }

  private setStatus(job: QueuedJob, status: JobStatus, error?: string): void {
    job.status = status;
    if (error !== undefined) job.lastError = error;
    this.onStatusChange?.(job);
  }

  private backoffFor(attempt: number): number {
    return Math.min(this.backoffMs * 2 ** (attempt - 1), this.maxBackoffMs);
  }

  /**
   * Enqueue a job and start draining if idle. Resolves once the queue has
   * fully drained (all jobs done or failed).
   */
  async enqueue(job: PrintJob): Promise<void> {
    this.jobs.push({ ...job, status: "pending", attempts: 0 });
    await this.process();
  }

  /** Drain the queue, processing pending jobs in order. Safe to call re-entrantly. */
  async process(): Promise<void> {
    if (this.processing) return;
    this.processing = true;
    try {
      for (const job of this.jobs) {
        if (job.status !== "pending") continue;
        await this.runJob(job);
      }
    } finally {
      this.processing = false;
    }
  }

  private async runJob(job: QueuedJob): Promise<void> {
    while (job.attempts < this.maxAttempts) {
      job.attempts += 1;
      this.setStatus(job, "printing");
      try {
        await sendToPrinter(this.transport, job.payload);
        this.setStatus(job, "done");
        return;
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        if (job.attempts >= this.maxAttempts) {
          this.setStatus(job, "failed", message);
          return;
        }
        this.setStatus(job, "pending", message);
        await this.sleep(this.backoffFor(job.attempts));
      }
    }
  }

  /** Reset failed jobs back to pending so they can be retried, then drain. */
  async retryFailed(): Promise<void> {
    for (const job of this.jobs) {
      if (job.status === "failed") {
        job.attempts = 0;
        this.setStatus(job, "pending");
      }
    }
    await this.process();
  }

  /** Remove completed/failed jobs from the queue's history. */
  clearCompleted(): void {
    for (let i = this.jobs.length - 1; i >= 0; i -= 1) {
      const job = this.jobs[i];
      if (job && (job.status === "done" || job.status === "failed")) {
        this.jobs.splice(i, 1);
      }
    }
  }
}
