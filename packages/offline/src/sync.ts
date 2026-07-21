// @zerosky/offline — background sync worker.
//
// Drains the sync queue whenever the network is up. For each pending mutation
// it calls the transport; on a conflict it applies the configured resolution
// strategy and, when the local side wins, retries the push as an authoritative
// overwrite. Transient (thrown) errors mark the mutation FAILED for later retry.

import type { NetworkMonitor } from "./network";
import { ConnectivityMonitor } from "./network";
import { resolveConflict } from "./conflict";
import type { SyncQueue } from "./queue";
import type {
  ConflictStrategy,
  PushResult,
  QueuedMutation,
  SyncStats,
  SyncTransport,
  Versioned,
} from "./types";

export interface SyncWorkerOptions {
  queue: SyncQueue;
  transport: SyncTransport;
  /** Connectivity source; defaults to an always-online monitor. */
  network?: NetworkMonitor;
  /** Conflict strategy applied on server rejection. Defaults to last-write-wins. */
  strategy?: ConflictStrategy;
  /** Polling interval (ms) for {@link SyncWorker.start}. Defaults to 15000. */
  intervalMs?: number;
  /** Max mutations processed per drain. Defaults to unbounded. */
  batchSize?: number;
}

export interface SyncResult {
  processed: number;
  synced: number;
  failed: number;
  /** True when the drain was skipped because the network was offline. */
  skippedOffline: boolean;
}

/**
 * Coordinates draining the {@link SyncQueue} through a {@link SyncTransport}.
 * Can run on demand ({@link syncOnce}) or on an interval ({@link start}), and
 * auto-drains when connectivity is regained.
 */
export class SyncWorker {
  private readonly queue: SyncQueue;
  private readonly transport: SyncTransport;
  private readonly network: NetworkMonitor;
  private readonly strategy: ConflictStrategy;
  private readonly intervalMs: number;
  private readonly batchSize?: number;

  private timer: ReturnType<typeof setInterval> | undefined;
  private unsubscribe: (() => void) | undefined;
  private running = false;
  private draining = false;

  constructor(options: SyncWorkerOptions) {
    this.queue = options.queue;
    this.transport = options.transport;
    this.network = options.network ?? new ConnectivityMonitor();
    this.strategy = options.strategy ?? "last-write-wins";
    this.intervalMs = options.intervalMs ?? 15_000;
    this.batchSize = options.batchSize;
  }

  /** Whether the periodic worker loop is active. */
  get isRunning(): boolean {
    return this.running;
  }

  /**
   * Begin periodic syncing and drain immediately when the network transitions
   * back online. Safe to call once; repeated calls are ignored while running.
   */
  start(): void {
    if (this.running) return;
    this.running = true;

    this.unsubscribe = this.network.subscribe((online) => {
      if (online) void this.syncOnce();
    });

    this.timer = setInterval(() => {
      void this.syncOnce();
    }, this.intervalMs);

    // Kick off an initial drain without blocking the caller.
    void this.syncOnce();
  }

  /** Stop the periodic loop and detach the connectivity listener. */
  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = undefined;
    }
    this.unsubscribe?.();
    this.unsubscribe = undefined;
    this.running = false;
  }

  /** Convenience passthrough to the queue's status counts. */
  async stats(): Promise<SyncStats> {
    return this.queue.stats();
  }

  /**
   * Drain all currently-pending mutations once. No-ops (skippedOffline) when
   * the network is down. Concurrent invocations are collapsed: if a drain is
   * already in flight, this resolves immediately as a skipped run.
   */
  async syncOnce(): Promise<SyncResult> {
    if (!this.network.isOnline()) {
      return { processed: 0, synced: 0, failed: 0, skippedOffline: true };
    }
    if (this.draining) {
      return { processed: 0, synced: 0, failed: 0, skippedOffline: false };
    }

    this.draining = true;
    try {
      const pending = await this.queue.pending(this.batchSize);
      let synced = 0;
      let failed = 0;

      for (const mutation of pending) {
        // Bail out mid-batch if connectivity dropped.
        if (!this.network.isOnline()) break;
        const ok = await this.process(mutation);
        if (ok) synced += 1;
        else failed += 1;
      }

      return { processed: synced + failed, synced, failed, skippedOffline: false };
    } finally {
      this.draining = false;
    }
  }

  /** Push a single mutation and record the outcome. Returns true on success. */
  private async process(mutation: QueuedMutation): Promise<boolean> {
    try {
      const result = await this.transport.push(mutation);
      if (result.ok) {
        await this.queue.markSynced(mutation.id);
        return true;
      }
      return await this.handleConflict(mutation, result);
    } catch (error) {
      await this.queue.markFailed(mutation.id, errorMessage(error));
      return false;
    }
  }

  /**
   * Resolve a server-reported conflict. If the local side wins, re-push the
   * local payload as an authoritative overwrite; otherwise accept the server
   * copy and consider the mutation synced (local change superseded).
   */
  private async handleConflict(
    mutation: QueuedMutation,
    result: Extract<PushResult, { ok: false }>,
  ): Promise<boolean> {
    const local = this.localVersion(mutation);
    // Without a local payload (e.g. DELETE) there is nothing to compare; the
    // server copy stands and the mutation is dropped.
    if (!local) {
      await this.queue.markSynced(mutation.id);
      return true;
    }

    const decision = resolveConflict(this.strategy, local, result.conflict);
    if (decision.winner === "server") {
      await this.queue.markSynced(mutation.id);
      return true;
    }

    // Local wins — re-push as a forced overwrite carrying the resolved record.
    try {
      const forced = await this.transport.push({
        ...mutation,
        payload: decision.resolved,
      });
      if (forced.ok) {
        await this.queue.markSynced(mutation.id);
        return true;
      }
      // Server still refused; record and retry later.
      await this.queue.markFailed(mutation.id, "conflict overwrite rejected");
      return false;
    } catch (error) {
      await this.queue.markFailed(mutation.id, errorMessage(error));
      return false;
    }
  }

  private localVersion(mutation: QueuedMutation): Versioned | null {
    if (!mutation.payload) return null;
    // Prefer the payload's own updatedAt; fall back to the queue clientTime so
    // last-write-wins still has a comparable timestamp.
    return {
      ...mutation.payload,
      updatedAt: mutation.payload.updatedAt ?? mutation.clientTime,
    };
  }
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
