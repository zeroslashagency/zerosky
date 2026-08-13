import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    // Pure logic + CSS parsing only — no DOM, so the lightweight node
    // environment is enough (no jsdom dependency required).
    environment: "node",
    include: ["tests/**/*.test.ts"],
  },
});
