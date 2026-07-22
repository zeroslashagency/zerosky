// @zerosky/offline — offline-first sync engine for the zerosky POS.
//
// Public surface:
//   * SQLite mirror client        (sqlite.ts)
//   * durable sync queue          (queue.ts)
//   * conflict resolution         (conflict.ts)
//   * network detection           (network.ts)
//   * background sync worker      (sync.ts)
//   * offline-first CRUD wrapper  (crud.ts)

export * from "./types";
export * from "./network";
export * from "./conflict";
export * from "./sync";
export * from "./crud";

// The Prisma-generated client (re-exported from ./sqlite) also declares a
// `SyncQueue`/`SyncMeta` *model type*. Our own sync-queue *manager* class shares
// the `SyncQueue` name, so re-export ./queue explicitly to take precedence and
// avoid an ambiguous star-export.
export { SyncQueue } from "./queue";
export type { EnqueueInput } from "./queue";
export * from "./sqlite";
