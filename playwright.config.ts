import { defineConfig, devices } from '@playwright/test';

/**
 * See https://playwright.dev/docs/test-configuration.
 */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  // The Next dev server compiles each route on first hit. A wide burst of
  // parallel workers all authenticating and navigating cold pages at once can
  // starve the first tests past their timeout — a dev-server characteristic,
  // not a product fault. Cap concurrency (CI already runs serially) and give
  // each test enough room to absorb a cold compile.
  workers: process.env.CI ? 1 : 2,
  timeout: 60_000,
  reporter: 'html',
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],

  webServer: {
    command: process.env.CI ? 'npm run build --workspace=pos-web && npm run start --workspace=pos-web -- -p 3000' : 'cd apps/pos-web && npm run dev -- -p 3000',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
    timeout: 120 * 1000,
    stdout: 'pipe',
    stderr: 'pipe',
    env: {
      // Every spec authenticates via the login fixture, and on localhost all
      // unauthenticated callers share one `auth:anonymous` bucket. The default
      // 10 sign-ins/min guards against password guessing in production but is
      // far too tight for a full suite that logs in once per test. Raise both
      // budgets for the test server only; the limiter itself is covered by the
      // @zerosky/api unit tests, not by these E2E specs.
      API_AUTH_RATE_LIMIT: '1000',
      API_RATE_LIMIT: '100000',
    },
  },
});
