// @zerosky/offline — sync queue manager.
//
// Every offline mutation is appended to the `sync_queue` table as a durable,
// JSON-encoded record. The worker later drains PENDING rows in FIFO order.
// This module owns all reads/writes to that table so the storage shape stays
// in one place.

import type { PrismaClient } from "../generated/client";
import type {
  QueuedMutation,
  SyncOperation,
  SyncStats,
  SyncStatus,
  Versioned,
} from "./types";

export interface EnqueueInput<T extends Versioned = Versioned> {
  model: string;
  recordId: string;
  operation: SyncOperation;
  /** Full record snapshot for CREATE/UPDATE; omit/null for DELETE. */
  payload?: T | null;
  /** Local record `updatedAt` used for last-write-wins. Defaults to now. */
  clientTime?: Date;
}

/** Raw `sync_queue` row shape (payload stored as JSON string). */
interface SyncQueueRow {
  id: string;
  model: string;
  recordId: string;
  operation: string;
  payload: string;
  status: string;
  attempts: number;
  lastError: string | null;
  clientTime: Date;
}

/**
 * Durable FIFO queue of pending mutations, backed by the local SQLite DB.
 */
export class SyncQueue {
  constructor(private readonly db: PrismaClient) {}

  /** Append a mutation to the queue and return its decoded form. */
  async enqueue<T extends Versioned>(input: EnqueueInput<T>): Promise<QueuedMutation<T>> {
    const payload = input.payload ?? null;
    const row = await this.db.syncQueue.create({
      data: {
        model: input.model,
        recordId: input.recordId,
        operation: input.operation,
        payload: JSON.stringify(payload),
        status: "PENDING",
        clientTime: input.clientTime ?? new Date(),
      },
    });
    return this.decode<T>(row as SyncQueueRow);
  }

  /** Fetch PENDING mutations in insertion order, oldest first. */
  async pending(limit?: number): Promise<QueuedMutation[]> {
    const rows = await this.db.syncQueue.findMany({
      where: { status: "PENDING" },
      orderBy: { createdAt: "asc" },
      ...(limit !== undefined ? { take: limit } : {}),
    });
    return rows.map((row) => this.decode(row as SyncQueueRow));
  }

  /** Mark a mutation SYNCED and stamp the completion time. */
  async markSynced(id: string): Promise<void> {
    await this.db.syncQueue.update({
      where: { id },
      data: { status: "SYNCED", syncedAt: new Date(), lastError: null },
    });
  }

  /**
   * Mark a mutation FAILED, incrementing the attempt counter and recording the
   * error message for later inspection/retry.
   */
  async markFailed(id: string, error: string): Promise<void> {
    await this.db.syncQueue.update({
      where: { id },
      data: { status: "FAILED", attempts: { increment: 1 }, lastError: error },
    });
  }

  /**
   * Return a FAILED mutation to PENDING so the worker retries it. The attempt
   * counter is preserved to support capped-retry policies.
   */
  async retry(id: string): Promise<void> {
    await this.db.syncQueue.update({
      where: { id },
      data: { status: "PENDING" },
    });
  }

  /** Return all FAILED mutations to PENDING; resolves with the count reset. */
  async retryAllFailed(): Promise<number> {
    const result = await this.db.syncQueue.updateMany({
      where: { status: "FAILED" },
      data: { status: "PENDING" },
    });
    return result.count;
  }

  /** Count mutations grouped by status. */
  async stats(): Promise<SyncStats> {
    const grouped = await this.db.syncQueue.groupBy({
      by: ["status"],
      _count: { _all: true },
    });
    const stats: SyncStats = { pending: 0, synced: 0, failed: 0, total: 0 };
    for (const group of grouped) {
      const count = group._count._all;
      stats.total += count;
      if (group.status === "PENDING") stats.pending = count;
      else if (group.status === "SYNCED") stats.synced = count;
      else if (group.status === "FAILED") stats.failed = count;
    }
    return stats;
  }

  /** Delete SYNCED rows to keep the queue table small. Returns rows removed. */
  async purgeSynced(): Promise<number> {
    const result = await this.db.syncQueue.deleteMany({ where: { status: "SYNCED" } });
    return result.count;
  }

  private decode<T extends Versioned>(row: SyncQueueRow): QueuedMutation<T> {
    return {
      id: row.id,
      model: row.model,
      recordId: row.recordId,
      operation: row.operation as SyncOperation,
      payload: this.parsePayload<T>(row.payload),
      status: row.status as SyncStatus,
      attempts: row.attempts,
      lastError: row.lastError,
      clientTime: row.clientTime,
    };
  }

  private parsePayload<T extends Versioned>(raw: string): T | null {
    if (!raw || raw === "null") return null;
    try {
      return JSON.parse(raw) as T;
    } catch {
      return null;
    }
  }
}
