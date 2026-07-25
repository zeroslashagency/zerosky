// Test helper: provision an isolated SQLite database per test suite.
//
// We push the Prisma schema to a throwaway file DB, hand back a client bound to
// it, and provide a teardown that disconnects and removes the files. `db push`
// runs once per suite (not per test) which keeps the suite fast enough.

import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { createSqliteClient, type PrismaClient } from "../../src/sqlite";

const packageRoot = fileURLToPath(new URL("../..", import.meta.url));

export interface TestDb {
  db: PrismaClient;
  url: string;
  dir: string;
  destroy(): Promise<void>;
}

/** Create a fresh, migrated SQLite database in a temp dir. */
export async function createTestDb(): Promise<TestDb> {
  const dir = mkdtempSync(join(tmpdir(), "zerosky-offline-"));
  const file = join(dir, "test.db");
  const url = `file:${file}`;

  // Provision the schema on the temp DB via the Prisma CLI.
  execFileSync(
    "npx",
    ["prisma", "db", "push", "--skip-generate", "--accept-data-loss"],
    {
      cwd: packageRoot,
      env: { ...process.env, OFFLINE_DATABASE_URL: url },
      stdio: "ignore",
    },
  );

  const db = createSqliteClient({ url });

  return {
    db,
    url,
    dir,
    async destroy() {
      await db.$disconnect();
      rmSync(dir, { recursive: true, force: true });
    },
  };
}

let seq = 0;

/** Deterministic-ish unique id generator for seeding test records. */
export function testId(prefix = "id"): string {
  seq += 1;
  return `${prefix}_${Date.now().toString(36)}_${seq}`;
}
