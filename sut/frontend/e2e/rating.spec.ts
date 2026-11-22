import { test, expect } from '@playwright/test';

// Paginated collection envelope used by the API (limit/offset pagination)
const paginated = (items: unknown[]) => ({ items, total: items.length, limit: 100, offset: 0 });

test.describe('Rating - Base-Choice', () => {

  let lastRatingPayload: any = null;

  test.beforeEach(async ({ page }) => {
    // Browser console logs help diagnose failures
    page.on('console', msg => console.log('PAGE LOG:', msg.text()));

    // Reset the payload
    lastRatingPayload = null;

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

    // History mock with one unreviewed restaurant
    await page.route(url => url.pathname === '/api/v1/history', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(paginated([
          {
            id: 1,
            user_id: 'test-user-1',
            place_id: 'place_base_choice',
            accessed_at: '2026-05-28T10:00:00Z',
            restaurant: {
              name: 'Base Choice Restaurant',
              rating: 4.5,
              user_ratings_total: 120,
              types: ['restaurant'],
              address: 'Test Street 123',
              main_photo: null,
            },
          },
        ])),
      });
    });

    // Ratings mock (empty, so the restaurant counts as unreviewed)
    await page.route(url => url.pathname === '/api/v1/ratings', async (route) => {
      if (route.request().method() === 'GET') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(paginated([])),
        });
      } else {
        await route.fallback();
      }
    });

    // Rating upsert: PUT /restaurants/{place_id}/rating (place_id lives in the path, not in the body)
    await page.route('**/api/v1/restaurants/*/rating', async (route) => {
      if (route.request().method() === 'PUT') {
        lastRatingPayload = JSON.parse(route.request().postData() || '{}');
        lastRatingPayload.place_id = decodeURIComponent(new URL(route.request().url()).pathname.split('/')[4]);
        await route.fulfill({
          status: 201,
          contentType: 'application/json',
          body: JSON.stringify({
            id: 101,
            place_id: lastRatingPayload.place_id,
            quality: lastRatingPayload.quality,
            price: lastRatingPayload.price,
            hygiene: lastRatingPayload.hygiene,
            service: lastRatingPayload.service,
            comment: lastRatingPayload.comment,
            created_at: new Date().toISOString(),
          }),
        });
      } else if (route.request().method() === 'GET') {
        // The caller has no rating for this restaurant yet
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({}),
        });
      } else {
        await route.fallback();
      }
    });

    // Go to the history page
    await page.goto('/history');
  });

  // Open the rating modal for the mocked restaurant
  async function openRatingModal(page: any) {
    const card = page.getByTestId('restaurant-card').filter({ hasText: 'Base Choice Restaurant' });
    await expect(card).toBeVisible();

    // The card has two buttons: the first opens the details view, the menu has its own testid.
    await card.getByTestId('history-card-menu').click();

    const ratingBtn = page.getByTestId('history-menu-rate');
    await expect(ratingBtn).toBeVisible();
    await ratingBtn.click();

    await expect(page.getByTestId('rating-modal')).toBeVisible();
  }

  // Pick the star score of one aspect
  async function selectStars(page: any, aspect: string, rating: number) {
    if (rating <= 0) return;
    await page.getByTestId(`rating-star-${aspect}-${rating}`).click();
  }

  // Fill the base values in the modal
  async function fillBaseRatings(page: any, {
    quality = 5,
    price = 5,
    hygiene = 5,
    service = 5,
    comment = 'Excellent service and delicious food',
  } = {}) {
    await selectStars(page, 'quality', quality);
    await selectStars(page, 'price', price);
    await selectStars(page, 'hygiene', hygiene);
    await selectStars(page, 'service', service);

    const textarea = page.getByTestId('rating-comment');
    if (comment) {
      await textarea.fill(comment);
    } else {
      await textarea.fill('');
    }
  }

  // ── 1. Save a complete rating - BASE case (BASE) ─────────────────────────────
  test('should save the rating with every aspect at max and a comment (BASE)', async ({ page }) => {
    await openRatingModal(page);
    await fillBaseRatings(page);

    const submitBtn = page.getByTestId('rating-submit');
    await expect(submitBtn).toBeEnabled();
    await submitBtn.click();

    // Check the API call
    await expect.poll(() => lastRatingPayload).not.toBeNull();
    expect(lastRatingPayload.quality).toBe(5);
    expect(lastRatingPayload.price).toBe(5);
    expect(lastRatingPayload.hygiene).toBe(5);
    expect(lastRatingPayload.service).toBe(5);
    expect(lastRatingPayload.comment).toBe('Excellent service and delicious food');

    // The modal closes and the success toast shows
    await expect(page.getByTestId('rating-modal')).not.toBeVisible();
    await expect(page.getByTestId('toast-success')).toBeVisible();
  });

  // ── 2. Submit disabled with 0 stars (S2, S5, S8, S11) ─────────────────
  test('should disable submit if any aspect has 0 stars (S2, S5, S8, S11)', async ({ page }) => {
    const submitBtn = page.getByTestId('rating-submit');

    // 2.1. S2: Calidad = 0
    await openRatingModal(page);
    await fillBaseRatings(page, { quality: 0 });
    await expect(submitBtn).toBeDisabled();

    // 2.2. S5: Precio = 0
    await page.goto('/history');
    await openRatingModal(page);
    await fillBaseRatings(page, { price: 0 });
    await expect(submitBtn).toBeDisabled();

    // 2.3. S8: Higiene = 0
    await page.goto('/history');
    await openRatingModal(page);
    await fillBaseRatings(page, { hygiene: 0 });
    await expect(submitBtn).toBeDisabled();

    // 2.4. S11: Trato = 0
    await page.goto('/history');
    await openRatingModal(page);
    await fillBaseRatings(page, { service: 0 });
    await expect(submitBtn).toBeDisabled();
  });

  // ── 3. Varying Quality and Price scores (S3, S4, S6, S7) ───────────────
  test('should save the rating with different quality and price scores (S3, S4, S6, S7)', async ({ page }) => {
    const submitBtn = page.getByTestId('rating-submit');

    // 3.1. Sub-case A: Calidad = 1, Precio = 3
    await openRatingModal(page);
    await fillBaseRatings(page, { quality: 1, price: 3 });
    await expect(submitBtn).toBeEnabled();
    await submitBtn.click();
    await expect.poll(() => lastRatingPayload).not.toBeNull();
    expect(lastRatingPayload.quality).toBe(1);
    expect(lastRatingPayload.price).toBe(3);
    expect(lastRatingPayload.hygiene).toBe(5);
    expect(lastRatingPayload.service).toBe(5);

    // Wait for the modal to close after submitting
    await expect(page.getByTestId('rating-modal')).not.toBeVisible();
    lastRatingPayload = null; // Reset the payload

    // 3.2. Sub-case B: Calidad = 3, Precio = 1
    await page.goto('/history');
    await openRatingModal(page);
    await fillBaseRatings(page, { quality: 3, price: 1 });
    await expect(submitBtn).toBeEnabled();
    await submitBtn.click();
    await expect.poll(() => lastRatingPayload).not.toBeNull();
    expect(lastRatingPayload.quality).toBe(3);
    expect(lastRatingPayload.price).toBe(1);
    expect(lastRatingPayload.hygiene).toBe(5);
    expect(lastRatingPayload.service).toBe(5);
  });

  // ── 4. Varying Hygiene and Service scores (S9, S10, S12, S13) ──────────────
  test('should save the rating with different hygiene and service scores (S9, S10, S12, S13)', async ({ page }) => {
    const submitBtn = page.getByTestId('rating-submit');

    // 4.1. Sub-case A: Higiene = 1, Trato = 3
    await openRatingModal(page);
    await fillBaseRatings(page, { hygiene: 1, service: 3 });
    await expect(submitBtn).toBeEnabled();
    await submitBtn.click();
    await expect.poll(() => lastRatingPayload).not.toBeNull();
    expect(lastRatingPayload.quality).toBe(5);
    expect(lastRatingPayload.price).toBe(5);
    expect(lastRatingPayload.hygiene).toBe(1);
    expect(lastRatingPayload.service).toBe(3);

    // Wait for the modal to close after submitting
    await expect(page.getByTestId('rating-modal')).not.toBeVisible();
    lastRatingPayload = null; // Reset the payload

    // 4.2. Sub-case B: Higiene = 3, Trato = 1
    await page.goto('/history');
    await openRatingModal(page);
    await fillBaseRatings(page, { hygiene: 3, service: 1 });
    await expect(submitBtn).toBeEnabled();
    await submitBtn.click();
    await expect.poll(() => lastRatingPayload).not.toBeNull();
    expect(lastRatingPayload.quality).toBe(5);
    expect(lastRatingPayload.price).toBe(5);
    expect(lastRatingPayload.hygiene).toBe(3);
    expect(lastRatingPayload.service).toBe(1);
  });

  // ── 5. Save a rating without a comment (S14) ───────────────────────────────────
  test('should save the rating when the comment is left empty (S14)', async ({ page }) => {
    await openRatingModal(page);
    await fillBaseRatings(page, { comment: '' });

    const submitBtn = page.getByTestId('rating-submit');
    await expect(submitBtn).toBeEnabled();
    await submitBtn.click();

    await expect.poll(() => lastRatingPayload).not.toBeNull();
    expect(lastRatingPayload.quality).toBe(5);
    expect(lastRatingPayload.price).toBe(5);
    expect(lastRatingPayload.hygiene).toBe(5);
    expect(lastRatingPayload.service).toBe(5);
    expect(lastRatingPayload.comment || '').toBe('');
  });

});

