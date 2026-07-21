// @zerosky/offline — offline-first CRUD wrapper.
//
// Every write goes to the local SQLite mirror first (so the POS keeps working
// with no network) and is simultaneously appended to the sync queue for later
// upload. Reads always hit the local mirror. This gives the UI a single, always
// -available data source while the SyncWorker reconciles with the server.

import type { PrismaClient } from "../generated/client";
import type { SyncQueue } from "./queue";
import type { Versioned } from "./types";

/**
 * The subset of a Prisma model delegate this wrapper needs. Kept structural so
 * any generated model delegate (order, item, table, …) satisfies it without
 * pulling the full, heavily-overloaded Prisma types.
 */
export interface ModelDelegate<T extends Versioned> {
  create(args: { data: Record<string, unknown> }): Promise<T>;
  update(args: { where: { id: string }; data: Record<string, unknown> }): Promise<T>;
  delete(args: { where: { id: string } }): Promise<T>;
  findUnique(args: { where: { id: string } }): Promise<T | null>;
  findMany(args?: Record<string, unknown>): Promise<T[]>;
}

/**
 * Wraps a single model with offline-first create/update/delete/read. Instances
 * are cheap; create one per model via {@link OfflineStore.model}.
 */
export class OfflineRepository<T extends Versioned> {
  constructor(
    private readonly modelName: string,
    private readonly delegate: ModelDelegate<T>,
    private readonly queue: SyncQueue,
  ) {}

  /** Create locally and enqueue a CREATE mutation. */
  async create(data: Record<string, unknown>): Promise<T> {
    const record = await this.delegate.create({ data });
    await this.queue.enqueue<T>({
      model: this.modelName,
      recordId: record.id,
      operation: "CREATE",
      payload: record,
      clientTime: this.updatedAt(record),
    });
    return record;
  }

  /** Update locally and enqueue an UPDATE mutation with the new snapshot. */
  async update(id: string, data: Record<string, unknown>): Promise<T> {
    const record = await this.delegate.update({ where: { id }, data });
    await this.queue.enqueue<T>({
      model: this.modelName,
      recordId: id,
      operation: "UPDATE",
      payload: record,
      clientTime: this.updatedAt(record),
    });
    return record;
  }

  /** Delete locally and enqueue a DELETE mutation (no payload). */
  async delete(id: string): Promise<T> {
    const record = await this.delegate.delete({ where: { id } });
    await this.queue.enqueue<T>({
      model: this.modelName,
      recordId: id,
      operation: "DELETE",
      payload: null,
    });
    return record;
  }

  /** Read a single record from the local mirror. */
  async findById(id: string): Promise<T | null> {
    return this.delegate.findUnique({ where: { id } });
  }

  /** Read many records from the local mirror. */
  async findMany(args?: Record<string, unknown>): Promise<T[]> {
    return this.delegate.findMany(args);
  }

  private updatedAt(record: T): Date {
    const value = record.updatedAt;
    return value instanceof Date ? value : new Date(value);
  }
}

/**
 * Factory over a SQLite {@link PrismaClient} that hands out offline-first
 * repositories bound to the shared {@link SyncQueue}.
 */
export class OfflineStore {
  constructor(
    private readonly db: PrismaClient,
    readonly queue: SyncQueue,
  ) {}

  /**
   * Build an {@link OfflineRepository} for a model. `modelName` is the public
   * model name (e.g. "Order"); `delegateKey` is the Prisma client property
   * (e.g. "order"). When omitted, the delegate key is the camel-cased model.
   */
  model<T extends Versioned>(modelName: string, delegateKey?: string): OfflineRepository<T> {
    const key = delegateKey ?? camelCase(modelName);
    const delegate = (this.db as unknown as Record<string, ModelDelegate<T>>)[key];
    if (!delegate) {
      throw new Error(`Unknown model delegate: ${key}`);
    }
    return new OfflineRepository<T>(modelName, delegate, this.queue);
  }
}

function camelCase(name: string): string {
  return name.length > 0 ? name[0]!.toLowerCase() + name.slice(1) : name;
}
