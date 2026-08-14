import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    // Pure logic + CSS parsing only — no DOM, so the lightweight node
    // environment is enough (no jsdom dependency required).
    environment: "node",
    include: ["tests/**/*.test.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "text-summary", "lcov"],
      thresholds: { branches: 80, functions: 80, lines: 80, statements: 80 },
    },
  },
});
