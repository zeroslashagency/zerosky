import { test, expect } from './fixtures';
import AxeBuilder from '@axe-core/playwright';

async function scanA11y(page: import('@playwright/test').Page) {
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze();
  const critical = results.violations.filter(v => v.impact === 'critical' || v.impact === 'serious');
  expect(critical, JSON.stringify(critical.map(v => ({ id: v.id, desc: v.description, nodes: v.nodes.length })), null, 2)).toHaveLength(0);
}

async function setLight(page: import('@playwright/test').Page) {
  await page.evaluate(() => {
    document.documentElement.classList.remove('dark');
    localStorage.setItem('zerosky-theme', 'light');
  });
}

async function setDark(page: import('@playwright/test').Page) {
  await page.evaluate(() => {
    document.documentElement.classList.add('dark');
    localStorage.setItem('zerosky-theme', 'dark');
  });
  await page.reload();
  await page.waitForLoadState('networkidle');
}

const AUTHED_ROUTES = ['/dashboard', '/menu', '/settings', '/kitchen', '/orders', '/orders/create', '/tables', '/billing', '/shift'] as const;

test.describe('Accessibility Smoke Check (light/dark)', () => {
  for (const route of AUTHED_ROUTES) {
    test(`a11y ${route} (light)`, async ({ authenticatedPage: page }) => {
      await page.goto(route);
      await page.waitForLoadState('networkidle');
      await setLight(page);
      await scanA11y(page);
    });
    test(`a11y ${route} (dark)`, async ({ authenticatedPage: page }) => {
      await page.goto(route);
      await page.waitForLoadState('networkidle');
      await setDark(page);
      await scanA11y(page);
    });
  }

  test('a11y /login (light)', async ({ page }) => {
    await page.goto('/login');
    await page.waitForLoadState('networkidle');
    await setLight(page);
    await scanA11y(page);
  });

  test('a11y /login (dark)', async ({ page }) => {
    await page.goto('/login');
    await page.waitForLoadState('networkidle');
    await setDark(page);
    await scanA11y(page);
  });

  // KDS display runs on :3002; skip when not reachable (dev not started)
  test('a11y KDS / (light)', async ({ playwright }) => {
    const request = await playwright.request.newContext();
    const probe = await request.get('http://localhost:3002/').catch(() => null);
    test.skip(!probe || !probe.ok(), 'KDS not running on :3002');
    const browser = await playwright.chromium.launch();
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    // Seed a session cookie by logging into pos-web then copy? Instead just visit KDS directly;
    // axe checks structure/contrast which is valid unauthenticated (redirect still has a11y).
    await page.goto('http://localhost:3002/');
    await page.waitForLoadState('networkidle');
    await page.evaluate(() => {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('zerosky-theme', 'light');
    });
    const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
    const critical = results.violations.filter(v => v.impact === 'critical' || v.impact === 'serious');
    expect(critical).toHaveLength(0);
    await ctx.close();
    await browser.close();
  });

  test('a11y KDS / (dark)', async ({ playwright }) => {
    const request = await playwright.request.newContext();
    const probe = await request.get('http://localhost:3002/').catch(() => null);
    test.skip(!probe || !probe.ok(), 'KDS not running on :3002');
    const browser = await playwright.chromium.launch();
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    await page.goto('http://localhost:3002/');
    await page.waitForLoadState('networkidle');
    await page.evaluate(() => {
      document.documentElement.classList.add('dark');
      localStorage.setItem('zerosky-theme', 'dark');
    });
    await page.reload();
    await page.waitForLoadState('networkidle');
    const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
    const critical = results.violations.filter(v => v.impact === 'critical' || v.impact === 'serious');
    expect(critical).toHaveLength(0);
    await ctx.close();
    await browser.close();
  });
});
