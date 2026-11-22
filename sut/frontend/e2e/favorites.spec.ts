import { test, expect } from '@playwright/test';

// ── Reusable test data ─────────────────────────────────────────────

const LIST_A = { id: 1, user_id: 'test-user-1', name: 'My Favorites', icon: 'Heart' };
const LIST_B = { id: 2, user_id: 'test-user-1', name: 'Dinner', icon: 'Wine' };

const RESTAURANTS_LIST_A = [
  {
    id: 10, list_id: 1, place_id: 'place_a',
    restaurant: { id: 101, name: 'Pizzeria Bella', rating: 4.5, user_ratings_total: 100, types: ['restaurant'], address: 'Street A 1', main_photo: null },
  },
  {
    id: 11, list_id: 1, place_id: 'place_b',
    restaurant: { id: 102, name: 'Taco Loco', rating: 4.0, user_ratings_total: 80, types: ['restaurant'], address: 'Street B 2', main_photo: null },
  },
  {
    id: 12, list_id: 1, place_id: 'place_c',
    restaurant: { id: 103, name: 'Burger Bar', rating: 3.8, user_ratings_total: 50, types: ['restaurant'], address: 'Street C 3', main_photo: null },
  },
];

test.describe('Favorites - Base-Choice', () => {

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
  });

  // ── BASE: Lists = Several, Restaurants = Several, Search = No ───────────────
  test('should show several lists and several restaurants without search (BASE)', async ({ page }) => {
    // Mock the lists overview
    await page.route('**/api/v1/favorites/lists', async (route) => {
      if (route.request().method() === 'GET') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify([LIST_A, LIST_B]),
        });
      } else {
        await route.continue();
      }
    });

    // Mock the detail of list A (3 restaurants)
    await page.route('**/api/v1/favorites/lists/1', async (route) => {
      if (route.request().method() === 'GET') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ list: LIST_A, restaurants: RESTAURANTS_LIST_A }),
        });
      } else {
        await route.continue();
      }
    });

    await page.goto('/favorites');

    // Two list cards are shown
    const listCards = page.getByTestId('favorites-list-card');
    await expect(listCards).toHaveCount(2);

    // Open list A
    await listCards.first().getByTestId('favorites-list-open').click();

    // All 3 restaurants are shown
    const restaurantCards = page.getByTestId('restaurant-card');
    await expect(restaurantCards).toHaveCount(3);

    // The detail header shows the list name
    await expect(page.getByTestId('favorites-detail-title')).toHaveText(LIST_A.name);

    // The in-list search box starts empty
    const searchInput = page.getByTestId('favorites-search');
    await expect(searchInput).toHaveValue('');
  });

  // ── 2. No lists created (Caso 2) ───────────────────────────────────────────────
  test('should show the empty state when there are no lists (Caso 2)', async ({ page }) => {
    await page.route('**/api/v1/favorites/lists', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([]),
      });
    });

    await page.goto('/favorites');

    // No list cards
    const listCards = page.getByTestId('favorites-list-card');
    await expect(listCards).toHaveCount(0);

    // Empty-state message
    await expect(page.getByTestId('favorites-empty')).toBeVisible();
  });

  // ── 3. Single lists and items (Caso 3, Caso 4, Caso 5) ─────────────────────────
  test('should show lists and items one at a time (Caso 3, Caso 4, Caso 5)', async ({ page }) => {
    const listCards = page.getByTestId('favorites-list-card');
    const restaurantCards = page.getByTestId('restaurant-card');

    // 3.1. Caso 3: Lists = 1
    await page.route('**/api/v1/favorites/lists', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([LIST_A]),
      });
    });

    await page.goto('/favorites');
    await expect(listCards).toHaveCount(1);
    await expect(listCards.first().getByTestId('favorites-list-name')).toHaveText(LIST_A.name);

    // 3.2. Caso 4: Restaurants in list = 0
    await page.route('**/api/v1/favorites/lists', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([LIST_A, LIST_B]),
      });
    });
    await page.route('**/api/v1/favorites/lists/1', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ list: LIST_A, restaurants: [] }),
      });
    });

    await page.goto('/favorites');
    await listCards.first().getByTestId('favorites-list-open').click();
    await expect(restaurantCards).toHaveCount(0);
    await expect(page.getByTestId('favorites-detail-empty')).toBeVisible();

    // 3.3. Caso 5: Restaurants in list = 1
    await page.route('**/api/v1/favorites/lists/1', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ list: LIST_A, restaurants: [RESTAURANTS_LIST_A[0]] }),
      });
    });

    await page.goto('/favorites');
    await listCards.first().getByTestId('favorites-list-open').click();
    await expect(restaurantCards).toHaveCount(1);
    await expect(restaurantCards.first().getByTestId('restaurant-card-name')).toHaveText('Pizzeria Bella');
  });

  // ── 4. Search inside a list (Caso 6) ─────────────────────────────────────────
  test('should filter dynamically when searching inside a list (Caso 6)', async ({ page }) => {
    await page.route('**/api/v1/favorites/lists', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([LIST_A]),
      });
    });

    await page.route('**/api/v1/favorites/lists/1', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ list: LIST_A, restaurants: RESTAURANTS_LIST_A }),
      });
    });

    await page.goto('/favorites');

    const listCards = page.getByTestId('favorites-list-card');
    await listCards.first().getByTestId('favorites-list-open').click();

    const restaurantCards = page.getByTestId('restaurant-card');
    await expect(restaurantCards).toHaveCount(3);

    const searchInput = page.getByTestId('favorites-search');
    await searchInput.fill('Pizz');

    await expect(restaurantCards).toHaveCount(1);
    await expect(restaurantCards.first().getByTestId('restaurant-card-name')).toHaveText('Pizzeria Bella');
  });
});
