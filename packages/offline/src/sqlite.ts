// @zerosky/offline — SQLite Prisma client singleton.
//
// Mirrors the pattern in @zerosky/database: one client reused across hot-reloads
// in dev to avoid exhausting file handles. The datasource URL can be overridden
// at construction time, which the test-suite uses to point at throwaway DB files.

import { PrismaClient } from "../generated/client";

export * from "../generated/client";

const globalForSqlite = globalThis as unknown as {
  offlinePrisma: PrismaClient | undefined;
};

export interface CreateSqliteClientOptions {
  /** Override the datasource URL, e.g. `file:./test-123.db`. */
  url?: string;
}

/**
 * Create a fresh SQLite-backed Prisma client. Prefer {@link offlineDb} for the
 * shared singleton; use this when you need an isolated client (tests, workers).
 */
export function createSqliteClient(options: CreateSqliteClientOptions = {}): PrismaClient {
  return new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
    ...(options.url
      ? { datasources: { db: { url: options.url } } }
      : {}),
  });
}

export const offlineDb: PrismaClient =
  globalForSqlite.offlinePrisma ?? createSqliteClient();

if (process.env.NODE_ENV !== "production") {
  globalForSqlite.offlinePrisma = offlineDb;
}
