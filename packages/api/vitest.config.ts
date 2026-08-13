import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: ["tests/**/*.test.ts"],
    // Every test file in this package talks to the SAME Postgres database and
    // several deliberately exercise bcrypt, which is CPU-bound by design. Run
    // files in one process, one at a time: parallel forks contend on shared
    // rows and starve each other of CPU, which surfaced as auth and discount
    // tests timing out at random while passing perfectly in isolation. A flaky
    // suite is worse than a slow one — the whole file set still runs in ~15s.
    pool: "forks",
    poolOptions: {
      forks: { singleFork: true },
    },
    fileParallelism: false,
    // bcrypt hashing at a realistic cost factor can exceed the 5s default.
    testTimeout: 30_000,
    hookTimeout: 30_000,
    coverage: {
      provider: "v8",
      reporter: ["text", "json-summary", "html"],
      include: ["src/**/*.ts"],
      exclude: ["src/index.ts", "src/**/*.d.ts"],
      thresholds: {
        lines: 80,
        functions: 80,
        branches: 80,
        statements: 80,
      },
    },
  },
});
