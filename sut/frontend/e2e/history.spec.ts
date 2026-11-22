import { test, expect } from '@playwright/test';

// Paginated collection envelope used by the API (limit/offset pagination)
const paginated = (items: unknown[]) => ({ items, total: items.length, limit: 100, offset: 0 });

// Month group labels as rendered by the app (es-ES locale); they are the grouping behavior under test.
const MAY_LABEL = 'MAYO 2026';
const APRIL_LABEL = 'ABRIL 2026';

test.describe('History - Base-Choice', () => {

  test.beforeEach(async ({ page }) => {
    // Browser console logs help diagnose failures
    page.on('console', msg => console.log('PAGE LOG:', msg.text()));

    // Stub the Google GSI script
    await page.route('**/gsi/client', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/javascript',
        body: 'console.log("Mock Google GSI client script loaded");',
      });
    });

    // Mock /api/v1/me to simulate a signed-in session
    await page.route('**/api/v1/me', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          username: 'testuser',
          email: 'test@test.com',
          first_name: 'Test',
          last_name: 'User',
          location: 'Madrid, Spain',
          is_google: false,
        }),
      });
    });

    // Mock the ratings (empty)
    await page.route(url => url.pathname === '/api/v1/ratings', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(paginated([])),
      });
    });
  });

  // ── 1. BASE: Months = Several, Restaurants = Several, Search = No ────────────────
  test('should show several months and several restaurants without search (BASE)', async ({ page }) => {
    // History mock: 3 restaurants spread over 2 months (May 2026 and April 2026)
    await page.route(url => url.pathname === '/api/v1/history', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(paginated([
          {
            id: 1,
            user_id: 'test-user-1',
            place_id: 'place_1',
            accessed_at: '2026-05-28T10:00:00Z',
            restaurant: {
              name: 'Base Choice Restaurant 1',
              rating: 4.5,
              user_ratings_total: 120,
              types: ['restaurant'],
              address: 'Fake Street 123',
              main_photo: null,
            },
          },
          {
            id: 2,
            user_id: 'test-user-1',
            place_id: 'place_2',
            accessed_at: '2026-05-27T10:00:00Z',
            restaurant: {
              name: 'Base Choice Restaurant 2',
              rating: 4.0,
              user_ratings_total: 80,
              types: ['restaurant'],
              address: 'Fake Street 456',
              main_photo: null,
            },
          },
          {
            id: 3,
            user_id: 'test-user-1',
            place_id: 'place_3',
            accessed_at: '2026-04-15T10:00:00Z',
            restaurant: {
              name: 'Base Choice Restaurant 3',
              rating: 4.2,
              user_ratings_total: 95,
              types: ['restaurant'],
              address: 'Fake Street 789',
              main_photo: null,
            },
          },
        ])),
      });
    });

    await page.goto('/history');

    // Both month headers are shown
    const mayHeader = page.getByTestId('history-group-title').filter({ hasText: MAY_LABEL });
    const aprilHeader = page.getByTestId('history-group-title').filter({ hasText: APRIL_LABEL });
    await expect(mayHeader).toBeVisible();
    await expect(aprilHeader).toBeVisible();

    // Only May is expanded by default, showing 2 restaurants
    const cards = page.getByTestId('restaurant-card');
    await expect(cards).toHaveCount(2);

    // Expand April
    await page.getByTestId('history-group-header').filter({ hasText: APRIL_LABEL }).click();

    // Now all 3 restaurants are shown
    await expect(cards).toHaveCount(3);

    // The search box is empty
    const searchInput = page.getByTestId('history-search');
    await expect(searchInput).toHaveValue('');
  });

  // ── 2. Empty history (Caso 2, Caso 4) ──────────────────────────────────────────
  test('should show the empty state when there are no months or restaurants (Caso 2, Caso 4)', async ({ page }) => {
    await page.route(url => url.pathname === '/api/v1/history', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(paginated([])),
      });
    });

    await page.goto('/history');

    // No month groups
    const headers = page.getByTestId('history-group-title');
    await expect(headers).toHaveCount(0);

    // The history list container is rendered (no spinner) with no cards
    await expect(page.getByTestId('history-loading')).toHaveCount(0);
    await expect(page.getByTestId('history-search')).toBeVisible();

    // No restaurant cards
    const cards = page.getByTestId('restaurant-card');
    await expect(cards).toHaveCount(0);
  });

  // ── 3. Single-item history (Caso 3, Caso 5) ───────────────────────────────────────
  test('should show a single month with one or several restaurants (Caso 3, Caso 5)', async ({ page }) => {
    // 3.1. Caso 5: Restaurants = 1
    await page.route(url => url.pathname === '/api/v1/history', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(paginated([
          {
            id: 1,
            user_id: 'test-user-1',
            place_id: 'place_1',
            accessed_at: '2026-05-28T10:00:00Z',
            restaurant: {
              name: 'Base Choice Restaurant 1',
              rating: 4.5,
              user_ratings_total: 120,
              types: ['restaurant'],
              address: 'Fake Street 123',
              main_photo: null,
            },
          },
        ])),
      });
    });

    await page.goto('/history');

    const headers = page.getByTestId('history-group-title');
    await expect(headers).toHaveCount(1);
    await expect(headers.first()).toHaveText(MAY_LABEL);

    const cards = page.getByTestId('restaurant-card');
    await expect(cards).toHaveCount(1);
    await expect(cards.first().getByTestId('restaurant-card-name')).toHaveText('Base Choice Restaurant 1');

    // 3.2. Caso 3: Months = 1, Restaurants = Several
    await page.route(url => url.pathname === '/api/v1/history', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(paginated([
          {
            id: 1,
            user_id: 'test-user-1',
            place_id: 'place_1',
            accessed_at: '2026-05-28T10:00:00Z',
            restaurant: {
              name: 'Base Choice Restaurant 1',
              rating: 4.5,
              user_ratings_total: 120,
              types: ['restaurant'],
              address: 'Fake Street 123',
              main_photo: null,
            },
          },
          {
            id: 2,
            user_id: 'test-user-1',
            place_id: 'place_2',
            accessed_at: '2026-05-27T10:00:00Z',
            restaurant: {
              name: 'Base Choice Restaurant 2',
              rating: 4.0,
              user_ratings_total: 80,
              types: ['restaurant'],
              address: 'Fake Street 456',
              main_photo: null,
            },
          },
        ])),
      });
    });

    await page.goto('/history');
    await expect(headers).toHaveCount(1);
    await expect(headers.first()).toHaveText(MAY_LABEL);
    await expect(cards).toHaveCount(2);
  });

  // ── 4. History search (Caso 6) ────────────────────────────────────────────
  test('should filter dynamically and hide months without matches when searching (Caso 6)', async ({ page }) => {
    await page.route(url => url.pathname === '/api/v1/history', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(paginated([
          {
            id: 1,
            user_id: 'test-user-1',
            place_id: 'place_1',
            accessed_at: '2026-05-28T10:00:00Z',
            restaurant: {
              name: 'Pizzeria Bella Vista',
              rating: 4.5,
              user_ratings_total: 120,
              types: ['restaurant'],
              address: 'Fake Street 123',
              main_photo: null,
            },
          },
          {
            id: 2,
            user_id: 'test-user-1',
            place_id: 'place_2',
            accessed_at: '2026-05-27T10:00:00Z',
            restaurant: {
              name: 'Taco Loco',
              rating: 4.0,
              user_ratings_total: 80,
              types: ['restaurant'],
              address: 'Fake Street 456',
              main_photo: null,
            },
          },
          {
            id: 3,
            user_id: 'test-user-1',
            place_id: 'place_3',
            accessed_at: '2026-04-15T10:00:00Z',
            restaurant: {
              name: 'Burger Bar',
              rating: 4.2,
              user_ratings_total: 95,
              types: ['restaurant'],
              address: 'Fake Street 789',
              main_photo: null,
            },
          },
        ])),
      });
    });

    await page.goto('/history');

    // Type "Pizz" in the search box
    const searchInput = page.getByTestId('history-search');
    await searchInput.fill('Pizz');

    // April has no matches, so its header disappears
    const aprilHeader = page.getByTestId('history-group-title').filter({ hasText: APRIL_LABEL });
    await expect(aprilHeader).toHaveCount(0);

    // May stays visible
    const mayHeader = page.getByTestId('history-group-title').filter({ hasText: MAY_LABEL });
    await expect(mayHeader).toBeVisible();

    // Only the "Pizzeria Bella Vista" card remains
    const cards = page.getByTestId('restaurant-card');
    await expect(cards).toHaveCount(1);
    await expect(cards.first().getByTestId('restaurant-card-name')).toHaveText('Pizzeria Bella Vista');
  });
});
