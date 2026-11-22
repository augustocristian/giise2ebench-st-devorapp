import { test, expect } from '@playwright/test';

test.describe('Side menu tests - Base-Choice', () => {

  test.beforeEach(async ({ page }) => {
    // Forward browser console logs for diagnostics
    page.on('console', msg => console.log('PAGE LOG:', msg.text()));

    // Stub the Google GSI script
    await page.route('**/gsi/client', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/javascript',
        body: 'console.log("Mock Google GSI client script loaded");',
      });
    });

    // Mock /api/v1/me: logged-in session
    await page.route('**/api/v1/me', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          username: 'testuser',
          email: 'test@test.com',
          first_name: 'Test',
          last_name: 'User',
          location: 'Springfield, USA',
          is_google: false,
        }),
      });
    });

    // Start every test from a clean theme/font state
    await page.addInitScript(() => {
      localStorage.removeItem('devorapp_theme');
      localStorage.removeItem('devorapp_fontsize');
    });

    // /home is where the side menu is available
    await page.goto('/home');

    // Open the side menu with the hamburger button
    await page.getByTestId('side-menu-open').click();
    await expect(page.getByTestId('side-menu-drawer')).toBeVisible();
  });

  // ── BASE: Theme = Light, Font = M ──
  test('should apply Light theme and font M by default (BASE)', async ({ page }) => {
    await page.getByTestId('theme-light').click();

    // Light is active, Dark is not
    await expect(page.getByTestId('theme-light')).toHaveClass(/active/);
    await expect(page.getByTestId('theme-dark')).not.toHaveClass(/active/);

    await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');

    // Font M is active by default
    await expect(page.getByTestId('font-size-m')).toHaveClass(/active/);

    // No data-font-size attribute (M is the default)
    await expect(page.locator('html')).not.toHaveAttribute('data-font-size');
  });

  // ── Case 2: Theme = Dark, Font = M ──
  test('should apply Dark theme and font M (Case 2)', async ({ page }) => {
    await page.getByTestId('theme-dark').click();

    await expect(page.getByTestId('theme-dark')).toHaveClass(/active/);
    await expect(page.getByTestId('theme-light')).not.toHaveClass(/active/);

    // No data-theme attribute (dark is the default)
    await expect(page.locator('html')).not.toHaveAttribute('data-theme');

    await expect(page.getByTestId('font-size-m')).toHaveClass(/active/);
  });

  // ── Case 3: Theme = Light, Font = S ──
  test('should apply Light theme and font S (Case 3)', async ({ page }) => {
    await page.getByTestId('theme-light').click();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');

    await page.getByTestId('font-size-s').click();

    await expect(page.getByTestId('font-size-s')).toHaveClass(/active/);
    await expect(page.getByTestId('font-size-m')).not.toHaveClass(/active/);

    await expect(page.locator('html')).toHaveAttribute('data-font-size', 'S');
  });

  // ── Case 4: Theme = Light, Font = L ──
  test('should apply Light theme and font L (Case 4)', async ({ page }) => {
    await page.getByTestId('theme-light').click();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');

    await page.getByTestId('font-size-l').click();

    await expect(page.getByTestId('font-size-l')).toHaveClass(/active/);
    await expect(page.getByTestId('font-size-m')).not.toHaveClass(/active/);

    await expect(page.locator('html')).toHaveAttribute('data-font-size', 'L');
  });
});
