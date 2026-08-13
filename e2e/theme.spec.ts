import { test, expect } from './fixtures';

const THEME_KEY = 'zerosky-theme';
const PALETTE_KEY = 'zerosky-palette';

test.describe('Theme Persistence', () => {
  test('fresh load writes no storage yet still resolves a valid mode and palette', async ({
    authenticatedPage: page,
  }) => {
    await page.goto('/settings');
    await page.waitForSelector('text=/Appearance/i');

    // The provider defaults to `system` mode + `default` palette and deliberately
    // does NOT persist anything until the user actively chooses something. Writing
    // on mount would freeze a visitor's mode against later OS changes.
    const stored = await page.evaluate(
      ([t, p]) => ({
        theme: localStorage.getItem(t),
        palette: localStorage.getItem(p),
      }),
      [THEME_KEY, PALETTE_KEY],
    );
    expect(stored.theme).toBeNull();
    expect(stored.palette).toBeNull();

    // Even with nothing stored, <html> must still resolve to a real mode: the
    // pre-paint script adds `dark` iff the OS prefers dark, and always sets a
    // palette attribute (falling back to "default").
    const html = page.locator('html');
    const prefersDark = await page.evaluate(
      () => window.matchMedia('(prefers-color-scheme: dark)').matches,
    );
    const classAttr = (await html.getAttribute('class')) ?? '';
    expect(classAttr.includes('dark')).toBe(prefersDark);

    // Palette attribute is present and resolves to the default when unset.
    await expect(html).toHaveAttribute('data-palette', 'default');
  });

  test('choosing a mode sets <html>, persists, and survives a reload', async ({
    authenticatedPage: page,
  }) => {
    await page.goto('/settings');
    await page.waitForSelector('text=/Appearance/i');

    const html = page.locator('html');

    // Explicitly pick Dark from the mode segmented control (role=radio).
    const modeGroup = page.locator('[role="radiogroup"][aria-label="Colour mode"]');
    await modeGroup.getByRole('radio', { name: 'Dark' }).click();

    // <html> flips to dark and storage now records the explicit choice.
    await expect(html).toHaveClass(/dark/);
    await expect
      .poll(() => page.evaluate((k) => localStorage.getItem(k), THEME_KEY))
      .toBe('dark');

    // Survives a reload (pre-paint script reads storage before first paint).
    await page.reload();
    await page.waitForLoadState('networkidle');
    await expect(html).toHaveClass(/dark/);
    expect(await page.evaluate((k) => localStorage.getItem(k), THEME_KEY)).toBe('dark');

    // Now switch to Light and confirm the class is removed and persisted.
    await modeGroup.getByRole('radio', { name: 'Light' }).click();
    await expect(html).not.toHaveClass(/dark/);
    await expect
      .poll(() => page.evaluate((k) => localStorage.getItem(k), THEME_KEY))
      .toBe('light');

    await page.reload();
    await page.waitForLoadState('networkidle');
    await expect(html).not.toHaveClass(/dark/);
    expect(await page.evaluate((k) => localStorage.getItem(k), THEME_KEY)).toBe('light');
  });

  test('choosing a palette sets data-palette, persists, and survives a reload', async ({
    authenticatedPage: page,
  }) => {
    await page.goto('/settings');
    await page.waitForSelector('text=/Appearance/i');

    const html = page.locator('html');

    // Pick Ocean from the palette radiogroup.
    const paletteGroup = page.locator('[role="radiogroup"][aria-label="Colour palette"]');
    await paletteGroup.getByRole('radio', { name: 'Ocean' }).click();

    await expect(html).toHaveAttribute('data-palette', 'ocean');
    await expect
      .poll(() => page.evaluate((k) => localStorage.getItem(k), PALETTE_KEY))
      .toBe('ocean');

    // Reload — the pre-paint script must restore data-palette from storage.
    await page.reload();
    await page.waitForLoadState('networkidle');
    await expect(html).toHaveAttribute('data-palette', 'ocean');
    expect(await page.evaluate((k) => localStorage.getItem(k), PALETTE_KEY)).toBe('ocean');

    // Switch to Emerald and confirm the same round-trip.
    await paletteGroup.getByRole('radio', { name: 'Emerald' }).click();
    await expect(html).toHaveAttribute('data-palette', 'emerald');
    await expect
      .poll(() => page.evaluate((k) => localStorage.getItem(k), PALETTE_KEY))
      .toBe('emerald');

    await page.reload();
    await page.waitForLoadState('networkidle');
    await expect(html).toHaveAttribute('data-palette', 'emerald');
    expect(await page.evaluate((k) => localStorage.getItem(k), PALETTE_KEY)).toBe('emerald');
  });

  test('mode and palette compose independently and both survive one reload', async ({
    authenticatedPage: page,
  }) => {
    await page.goto('/settings');
    await page.waitForSelector('text=/Appearance/i');

    const html = page.locator('html');
    const modeGroup = page.locator('[role="radiogroup"][aria-label="Colour mode"]');
    const paletteGroup = page.locator('[role="radiogroup"][aria-label="Colour palette"]');

    // Pick Dark + Sunset together.
    await modeGroup.getByRole('radio', { name: 'Dark' }).click();
    await paletteGroup.getByRole('radio', { name: 'Sunset' }).click();

    await expect(html).toHaveClass(/dark/);
    await expect(html).toHaveAttribute('data-palette', 'sunset');

    // Both axes are stored and both survive a reload without interfering.
    const before = await page.evaluate(
      ([t, p]) => ({
        theme: localStorage.getItem(t),
        palette: localStorage.getItem(p),
      }),
      [THEME_KEY, PALETTE_KEY],
    );
    expect(before).toEqual({ theme: 'dark', palette: 'sunset' });

    await page.reload();
    await page.waitForLoadState('networkidle');
    await expect(html).toHaveClass(/dark/);
    await expect(html).toHaveAttribute('data-palette', 'sunset');
  });
});
