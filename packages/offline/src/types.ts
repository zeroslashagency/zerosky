// @zerosky/offline — shared types for the offline-first sync engine.

/** Mutation kind captured in the sync queue. */
export type SyncOperation = "CREATE" | "UPDATE" | "DELETE";

/** Lifecycle state of a queued mutation. */
export type SyncStatus = "PENDING" | "SYNCED" | "FAILED";

/**
 * Conflict resolution strategy applied when the server already holds a newer
 * (or divergent) version of a record being pushed.
 *
 *  - `last-write-wins`: whichever side has the newer `updatedAt` wins.
 *  - `server-wins`:      the server copy always wins; the local change is dropped.
 *  - `client-wins`:      the local change always wins; it overwrites the server.
 */
export type ConflictStrategy = "last-write-wins" | "server-wins" | "client-wins";

/** A record that carries a monotonic update timestamp used for LWW. */
export interface Versioned {
  id: string;
  updatedAt: Date | string;
  [key: string]: unknown;
}

/** A single queued mutation, as understood by the sync engine (decoded form). */
export interface QueuedMutation<T extends Versioned = Versioned> {
  id: string;
  model: string;
  recordId: string;
  operation: SyncOperation;
  /** Decoded record payload for CREATE/UPDATE; `null` for DELETE. */
  payload: T | null;
  status: SyncStatus;
  attempts: number;
  lastError: string | null;
  clientTime: Date;
}

/**
 * Transport used by the sync worker to push a local mutation upstream.
 * Implementations wrap the real REST/tRPC API (or Prisma against Postgres).
 *
 * The push must be idempotent: the worker may retry the same mutation.
 */
export interface SyncTransport {
  /**
   * Push a single mutation to the server.
   *
   * Resolve with `{ ok: true, server }` on success (optionally returning the
   * authoritative server record). Resolve with `{ ok: false, conflict }` when
   * the server rejected the write due to a newer server-side record, supplying
   * that record so a conflict strategy can be applied. Reject (throw) for
   * transient/network errors so the mutation is retried.
   */
  push(mutation: QueuedMutation): Promise<PushResult>;
}

/** Outcome of a single push attempt. */
export type PushResult =
  | { ok: true; server?: Versioned }
  | { ok: false; conflict: Versioned };

/** Aggregate counts for the sync queue, keyed by status. */
export interface SyncStats {
  pending: number;
  synced: number;
  failed: number;
  total: number;
}
