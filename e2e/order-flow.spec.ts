import { test, expect } from './fixtures';

/**
 * Money-path coverage. The modifier modal is database-driven: only items with
 * seeded modifier groups (Paneer Tikka, Butter Chicken, Dal Makhani) open the
 * dialog; other items go straight to the cart. Required groups (Spice Level,
 * Portion Size) ship a default selection, so "Add to Cart" is enabled on open.
 *
 * GST is applied in the cart, not in the modal: the modal footer shows the
 * pre-tax line total, the cart shows Subtotal / Tax (GST) / Total.
 */

test.describe('Critical Money Path', () => {
  test('modifier modal opens for a seeded item and adds it with correct 5% GST', async ({
    authenticatedPage: page,
  }) => {
    await page.goto('/menu');
    await page.waitForLoadState('networkidle');

    // Click the Paneer Tikka card (₹249, 5% GST). It has a required Spice Level
    // group (Mild is the seeded default) plus optional Add-ons.
    await page.getByRole('heading', { name: 'Paneer Tikka' }).click();

    const modal = page.getByRole('dialog');
    await expect(modal).toBeVisible();
    await expect(modal).toContainText('Spice Level');
    await expect(modal).toContainText('Add-ons');

    // With the required default already selected, the footer offers the pre-tax
    // line total and is enabled.
    const addToCart = modal.getByRole('button', { name: /Add to Cart/ });
    await expect(addToCart).toBeEnabled();
    await expect(addToCart).toContainText('₹249.00');
    await addToCart.click();

    // Modal closes and the item lands in the cart.
    await expect(modal).toBeHidden();

    // Open the cart and verify GST math: 249 + 5% = 12.45 → 261.45.
    await page.getByRole('button', { name: /View Cart/ }).click();
    const cart = page.getByRole('heading', { name: /^Cart \(/ }).locator('xpath=ancestor::div[1]/..');
    await expect(page.getByText('₹249.00').first()).toBeVisible();
    await expect(page.getByText('₹12.45')).toBeVisible();
    await expect(page.getByText('₹261.45')).toBeVisible();
    void cart;
  });

  test('Butter Chicken with an add-on modifier computes the right GST', async ({
    authenticatedPage: page,
  }) => {
    await page.goto('/menu');
    await page.waitForLoadState('networkidle');

    // Butter Chicken ₹349, required Portion Size (Full default) + Spice Level
    // (Medium default) + optional Add-ons.
    await page.getByRole('heading', { name: 'Butter Chicken' }).click();

    const modal = page.getByRole('dialog');
    await expect(modal).toBeVisible();
    await expect(modal).toContainText('Portion Size');
    await expect(modal).toContainText('Spice Level');

    // Add the optional "Extra Butter" (+₹30) → line total 379.
    await modal.getByText('Extra Butter').click();

    const addToCart = modal.getByRole('button', { name: /Add to Cart/ });
    await expect(addToCart).toContainText('₹379.00');
    await addToCart.click();
    await expect(modal).toBeHidden();

    // Cart: 379 + 5% = 18.95 → 397.95.
    await page.getByRole('button', { name: /View Cart/ }).click();
    await expect(page.getByText('₹379.00').first()).toBeVisible();
    await expect(page.getByText('₹18.95')).toBeVisible();
    await expect(page.getByText('₹397.95')).toBeVisible();
  });

  test('full lifecycle: menu → cart → create order → cash payment → PAID', async ({
    authenticatedPage: page,
  }) => {
    // Accept the "Payment successful!" alert the order page raises on capture.
    page.on('dialog', (d) => d.accept());

    await page.goto('/menu');
    await page.waitForLoadState('networkidle');

    // Add Paneer Tikka (Mild default) to the cart.
    await page.getByRole('heading', { name: 'Paneer Tikka' }).click();
    const modal = page.getByRole('dialog');
    await expect(modal).toBeVisible();
    await modal.getByRole('button', { name: /Add to Cart/ }).click();
    await expect(modal).toBeHidden();

    // Cart → checkout.
    await page.getByRole('button', { name: /View Cart/ }).click();
    await expect(page.getByText('₹261.45')).toBeVisible();
    await page.getByRole('button', { name: /Proceed to Checkout/ }).click();

    // Create-order page carries the same total; create it as takeaway.
    await page.waitForURL('**/orders/create');
    await expect(page.getByText('₹261.45')).toBeVisible();
    await page.getByRole('button', { name: /^Create Order$/ }).click();

    // Redirects to the order detail page (not /orders/create).
    await page.waitForURL(/\/orders\/(?!create)[^/]+$/);
    await page.waitForLoadState('networkidle');
    await expect(page.getByRole('heading', { name: /^Order #/ })).toBeVisible({
      timeout: 15_000,
    });
    const orderUrl = page.url();

    // Pay in cash on the Payment tab.
    await page.getByRole('button', { name: /^Payment$/ }).click();
    await expect(page.getByText('Total Amount')).toBeVisible();
    await page.getByRole('button', { name: 'Cash' }).click();
    await page.getByPlaceholder('Enter amount').fill('300');

    // Change due is computed and shown before completion (300 - 261.45 = 38.55).
    await expect(page.getByText('₹38.55')).toBeVisible();

    await page.getByRole('button', { name: /Complete Payment/ }).click();

    // Success redirects to the dashboard.
    await page.waitForURL('**/dashboard');

    // The order is now PAID: reopening it shows the completion state.
    await page.goto(orderUrl);
    await page.waitForLoadState('networkidle');
    await expect(page.getByRole('heading', { name: /^Order #/ })).toBeVisible();
    // Status chip reflects the settled order.
    await expect(page.getByText('PAID')).toBeVisible();
    await page.getByRole('button', { name: /^Payment$/ }).click();
    await expect(page.getByText(/Payment Complete/i)).toBeVisible();
  });
});
