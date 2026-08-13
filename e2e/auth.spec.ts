import { test, expect } from '@playwright/test';
import { TEST_USERS } from './fixtures';

test.describe('Authentication & Middleware', () => {
  test('should redirect unauthenticated users to /login from protected routes', async ({ page }) => {
    const protectedRoutes = ['/dashboard', '/staff', '/settings', '/reports'];

    for (const route of protectedRoutes) {
      await page.goto(route);
      await expect(page).toHaveURL(/\/login/);
    }
  });

  test('should allow login with valid credentials', async ({ page }) => {
    await page.goto('/login');
    
    await page.fill('input[type="email"]', TEST_USERS.cashier.email);
    await page.fill('input[type="password"]', TEST_USERS.cashier.password);
    await page.click('button[type="submit"]');
    
    // Should redirect to a main page after login
    await page.waitForURL(/\/(dashboard|menu|tables)/);
    
    // Verify we're authenticated by checking a protected route is accessible
    await page.goto('/dashboard');
    await expect(page).toHaveURL('/dashboard');
  });

  test('should reject login with invalid credentials', async ({ page }) => {
    await page.goto('/login');
    
    await page.fill('input[type="email"]', TEST_USERS.cashier.email);
    await page.fill('input[type="password"]', 'wrongpassword');
    await page.click('button[type="submit"]');
    
    // Should stay on login page and show error
    await expect(page).toHaveURL(/\/login/);
    await expect(page.locator('text=/invalid|incorrect|wrong/i')).toBeVisible({ timeout: 5000 });
  });
});
