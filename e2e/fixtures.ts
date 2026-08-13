import { test as base, expect, type Page } from '@playwright/test';

/**
 * Seeded credentials from packages/database/prisma/seed.ts
 * DEV_PASSWORD = process.env.SEED_PASSWORD ?? "zerosky123"
 */
export const TEST_USERS = {
  owner: {
    email: 'owner@zerosky.dev',
    password: process.env.SEED_PASSWORD ?? 'zerosky123',
    role: 'OWNER',
  },
  manager: {
    email: 'manager@zerosky.dev',
    password: process.env.SEED_PASSWORD ?? 'zerosky123',
    role: 'MANAGER',
  },
  cashier: {
    email: 'cashier@zerosky.dev',
    password: process.env.SEED_PASSWORD ?? 'zerosky123',
    role: 'CASHIER',
  },
  waiter: {
    email: 'waiter@zerosky.dev',
    password: process.env.SEED_PASSWORD ?? 'zerosky123',
    role: 'WAITER',
  },
} as const;

type AuthenticatedFixture = {
  authenticatedPage: Page;
};

/**
 * Fixture that logs in before each test
 */
export const test = base.extend<AuthenticatedFixture>({
  authenticatedPage: async ({ page }, use) => {
    // Login with the cashier account (can handle orders + payments).
    //
    // The login mutation (/api/trpc) and the cookie writer (/api/auth/session)
    // are compiled lazily by the Next dev server, so the very first sign-in of
    // a cold run can be slow. The submit button also stays disabled until both
    // the tRPC mutation and the awaited session write resolve. Retry the submit
    // a couple of times and give the redirect a generous window so a cold
    // compile does not read as a product failure.
    await page.goto('/login');
    await page.waitForSelector('input[type="email"]');
    await page.fill('input[type="email"]', TEST_USERS.cashier.email);
    await page.fill('input[type="password"]', TEST_USERS.cashier.password);

    const redirected = /\/(dashboard|menu|tables)/;
    for (let attempt = 0; attempt < 3; attempt++) {
      await page.click('button[type="submit"]');
      try {
        await page.waitForURL(redirected, { timeout: 20_000 });
        break;
      } catch {
        // A visible auth error is a real failure; surface it. Otherwise the
        // route was still warming up — try the submit again.
        const err = page.locator('[role="alert"]');
        if (attempt === 2 && (await err.count()) > 0) {
          throw new Error(
            `Login did not complete: ${await err.first().innerText()}`,
          );
        }
        if (!page.url().includes('/login')) {
          await page.waitForURL(redirected, { timeout: 20_000 });
          break;
        }
      }
    }

    await use(page);
  },
});

export { expect };
