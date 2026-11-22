import { test, expect } from '@playwright/test';

const PREFERRED_LOCATION = 'Madrid, Spain';

const PLACE_1 = {
  id: 'mock_restaurant_1',
  name: 'Test Restaurant 1',
  main_photo: null,
  rating: 4.5,
  user_ratings_total: 120,
  types: ['mexican_restaurant', 'restaurant'],
  address: 'Fake Street 123, Madrid',
  summary: 'An excellent Mexican place.',
  opening_hours: { open_now: true },
  google_maps_uri: 'https://maps.google.com/?q=Test+Restaurant+1',
  website_uri: 'https://testrestaurant1.com',
};

const PLACE_2 = {
  id: 'mock_restaurant_2',
  name: 'Test Restaurant 2',
  main_photo: null,
  rating: 4.0,
  user_ratings_total: 80,
  types: ['italian_restaurant', 'restaurant'],
  address: 'Fake Street 124, Madrid',
  summary: 'An excellent Italian place.',
  opening_hours: { open_now: true },
  google_maps_uri: 'https://maps.google.com/?q=Test+Restaurant+2',
  website_uri: 'https://testrestaurant2.com',
};

// Cuisine tags from src/data/tags.json. The query is matched against the (Spanish) tag label.
const MEXICAN = { id: 'mexican_restaurant', query: 'Mexicano' };
const ITALIAN = { id: 'italian_restaurant', query: 'Italiano' };

test.describe('Restaurant Recommender - Base-Choice', () => {

  let lastSearchPayload: any = null;

  test.beforeEach(async ({ page }) => {
    // Browser console logs help diagnose failures
    page.on('console', msg => console.log('PAGE LOG:', msg.text()));

    // Reset the payload
    lastSearchPayload = null;

    // Stub the Google GSI script
    await page.route('**/gsi/client', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/javascript',
        body: 'console.log("Mock Google GSI client script loaded");',
      });
    });

    // Stub the Google Maps script so the real one cannot overwrite our mock
    await page.route('**/maps/api/js*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/javascript',
        body: 'console.log("Mock Google Maps script loaded");',
      });
    });

    // Inject a global Google Maps Autocomplete mock to avoid react-google-autocomplete crashes
    await page.addInitScript(() => {
      (window as any).google = {
        maps: {
          places: {
            Autocomplete: class {
              listeners: Record<string, Function[]> = {};
              input: HTMLInputElement;
              constructor(input: HTMLInputElement, options: any) {
                (window as any).mockAutocompleteInstance = this;
                this.input = input;
              }
              addListener(event: string, callback: Function) {
                if (!this.listeners[event]) this.listeners[event] = [];
                this.listeners[event].push(callback);
                return { remove: () => {} };
              }
              getPlace() {
                return {
                  formatted_address: this.input ? this.input.value : PREFERRED_LOCATION,
                  address_components: [
                    {
                      types: ['country'],
                      short_name: 'ES'
                    }
                  ]
                };
              }
              setTypes(types: any) {}
              setBounds(bounds: any) {}
              setFields(fields: any) {}
              setComponentRestrictions(restrictions: any) {}
              getBounds() { return {}; }
              getFields() { return []; }
              setOptions(options: any) {}
            }
          }
        }
      };
    });

    // Mock /api/v1/me to provide the preferred location
    await page.route('**/api/v1/me', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          username: 'testuser',
          email: 'test@test.com',
          first_name: 'Test',
          last_name: 'User',
          location: PREFERRED_LOCATION,
          is_google: false,
        }),
      });
    });

    // Mock Google Geocoding (used to load the currency for the preferred location)
    await page.route('**/maps/api/geocode/json*', async (route) => {
      await route.fulfill({
        status: 200,
        headers: {
          'Access-Control-Allow-Origin': '*',
        },
        contentType: 'application/json',
        body: JSON.stringify({
          results: [
            {
              address_components: [
                {
                  types: ['country'],
                  short_name: 'ES'
                }
              ]
            }
          ]
        })
      });
    });

    // Mock the recommendation search endpoint
    await page.route('**/api/v1/recommendations/search', async (route) => {
      if (route.request().method() !== 'POST') {
        return route.fallback();
      }
      lastSearchPayload = JSON.parse(route.request().postData() || '{}');

      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ results: [PLACE_1, PLACE_2], next_page_token: null }),
      });
    });

    // Go to the recommender page
    await page.goto('/recommend-restaurants');
  });

  // Adds a cuisine from the autocomplete dropdown. The option is a <button> inside the form, so
  // depending on the build the click may also submit a search and collapse the filters. Either way,
  // end with the filter form open and all the chips visible.
  async function addTag(page: any, tag: { id: string; query: string }, expectedChips: number) {
    const input = page.getByTestId('recommend-cuisine-input');
    const chips = page.getByTestId('recommend-cuisine-tag');
    const editFilters = page.getByTestId('recommend-edit-filters');

    await input.click();
    await input.fill(tag.query);
    await page.getByTestId(`cuisine-option-${tag.id}`).click();

    // Retry until the form is open and shows all chips (reopens it only if it collapsed).
    await expect(async () => {
      if (await editFilters.isVisible()) await editFilters.click();
      await expect(chips).toHaveCount(expectedChips, { timeout: 1000 });
    }).toPass();
  }

  // Fill the common BASE filter values
  async function setupBaseFilters(page: any) {
    // 1. Tags: several (Mexican and Italian)
    await addTag(page, MEXICAN, 1);
    await addTag(page, ITALIAN, 2);

    // 2. Price: several (moderate and expensive)
    await page.getByTestId('price-2').click();
    await page.getByTestId('price-3').click();

    // 3. No-price places: yes
    await page.getByTestId('recommend-include-no-price').setChecked(true);

    // 4. Open now: yes
    await page.getByTestId('recommend-open-now').setChecked(true);

    // 5. Location: preferred (default, forced for safety)
    await page.getByTestId('recommend-location-preferred').check();
  }

  async function expectBothResults(page: any) {
    await expect(page.getByTestId('recommend-results-title')).toBeVisible();
    const cards = page.getByTestId('recommend-result-card');
    await expect(cards).toHaveCount(2);
    await expect(cards.nth(0)).toContainText(PLACE_1.name);
    await expect(cards.nth(1)).toContainText(PLACE_2.name);
  }

  // ── 1. BASE case: base filters with preferred location (BASE) ──────────
  test('should search with all base filters and the preferred location (BASE)', async ({ page }) => {
    await setupBaseFilters(page);

    await page.getByTestId('recommend-submit').click({ noWaitAfter: true });

    // The request carries every BASE filter and the preferred location
    await expect.poll(() => lastSearchPayload).not.toBeNull();
    expect(lastSearchPayload.categories).toContain(MEXICAN.id);
    expect(lastSearchPayload.categories).toContain(ITALIAN.id);
    expect(lastSearchPayload.prices).toContain('PRICE_LEVEL_MODERATE');
    expect(lastSearchPayload.prices).toContain('PRICE_LEVEL_EXPENSIVE');
    expect(lastSearchPayload.include_unconfirmed_price).toBe(true);
    expect(lastSearchPayload.open_now).toBe(true);
    expect(lastSearchPayload.location).toBe(PREFERRED_LOCATION);

    await expectBothResults(page);
  });

  // ── 2. Search without filters and with 0 results (S2, S4, S10) ───────────────────
  test('should search without filters and handle an empty response (S2, S4, S10)', async ({ page }) => {
    // Empty results for this test
    await page.route('**/api/v1/recommendations/search', async (route) => {
      lastSearchPayload = JSON.parse(route.request().postData() || '{}');
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ results: [], next_page_token: null }),
      });
    });

    // Submit directly (no tags or prices, preferred location by default)
    await page.getByTestId('recommend-submit').click({ noWaitAfter: true });

    await expect.poll(() => lastSearchPayload).not.toBeNull();
    expect(lastSearchPayload.categories).toEqual([]); // S2 (Tags = 0)
    expect(lastSearchPayload.prices).toEqual([]); // S4 (Price = 0)
    expect(lastSearchPayload.location).toBe(PREFERRED_LOCATION);

    // No cards and no results title (S10)
    await expect(page.getByTestId('recommend-result-card')).toHaveCount(0);
    await expect(page.getByTestId('recommend-results-title')).toHaveCount(0);
  });

  // ── 3. Simple filters and a single result (S3, S5, S11) ───────────────────
  test('should search with simple filters and show a single result (S3, S5, S11)', async ({ page }) => {
    // One restaurant for this test
    await page.route('**/api/v1/recommendations/search', async (route) => {
      lastSearchPayload = JSON.parse(route.request().postData() || '{}');
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ results: [PLACE_1], next_page_token: null }),
      });
    });

    // Exactly 1 tag
    await addTag(page, MEXICAN, 1); // S3 (Tags = 1)

    // Price: 1 (inexpensive)
    await page.getByTestId('price-1').click(); // S5 (Price = 1)

    await page.getByTestId('recommend-submit').click({ noWaitAfter: true });

    await expect.poll(() => lastSearchPayload).not.toBeNull();
    expect(lastSearchPayload.categories).toEqual([MEXICAN.id]);
    expect(lastSearchPayload.prices).toEqual(['PRICE_LEVEL_INEXPENSIVE']);

    // Exactly 1 card (S11)
    const cards = page.getByTestId('recommend-result-card');
    await expect(cards).toHaveCount(1);
    await expect(cards.first()).toContainText(PLACE_1.name);
  });

  // ── 4. Boolean filters off and empty alternative location error (S6, S7, S9) ──
  test('should validate excluded booleans and block an empty alternative location (S6, S7, S9)', async ({ page }) => {
    await addTag(page, MEXICAN, 1);
    await addTag(page, ITALIAN, 2);
    await page.getByTestId('price-2').click();
    await page.getByTestId('price-3').click();

    // Uncheck "include places without a confirmed price" (S6: No-price = No)
    await page.getByTestId('recommend-include-no-price').setChecked(false);

    // Uncheck "open now only" (S7: Open = No)
    await page.getByTestId('recommend-open-now').setChecked(false);

    // Choose another location
    await page.getByTestId('recommend-location-custom').check();
    await expect(page.getByTestId('recommend-location-input')).toBeVisible();

    // Leave the input empty (S9: Location = invalid alternative) and submit
    await page.getByTestId('recommend-submit').click({ noWaitAfter: true });

    // Validation error is shown and no search request is made
    await expect(page.getByTestId('recommend-error')).toBeVisible();
    expect(lastSearchPayload).toBeNull();
  });

  // ── 5. Alternative location with full filters and several results (S8) ──
  test('should search with full filters and an alternative location showing several results (S8)', async ({ page }) => {
    await setupBaseFilters(page);

    // Switch from the preferred location to another one
    await page.getByTestId('recommend-location-custom').check();
    const autocompleteInput = page.getByTestId('recommend-location-input');
    await expect(autocompleteInput).toBeVisible();
    await autocompleteInput.fill('Barcelona, Spain');

    // Wait for the Autocomplete mock instance to exist
    await page.waitForFunction(() => (window as any).mockAutocompleteInstance !== undefined);

    // Fire the Google Maps 'place_changed' listener
    await page.evaluate(() => {
      const instance = (window as any).mockAutocompleteInstance;
      if (instance && instance.listeners['place_changed']) {
        instance.listeners['place_changed'].forEach((cb: Function) => cb());
      }
    });

    await page.getByTestId('recommend-submit').click({ noWaitAfter: true });

    // The request carries every BASE filter and the alternative location (S8)
    await expect.poll(() => lastSearchPayload).not.toBeNull();
    expect(lastSearchPayload.categories).toContain(MEXICAN.id);
    expect(lastSearchPayload.categories).toContain(ITALIAN.id);
    expect(lastSearchPayload.prices).toContain('PRICE_LEVEL_MODERATE');
    expect(lastSearchPayload.prices).toContain('PRICE_LEVEL_EXPENSIVE');
    expect(lastSearchPayload.include_unconfirmed_price).toBe(true);
    expect(lastSearchPayload.open_now).toBe(true);
    expect(lastSearchPayload.location).toBe('Barcelona, Spain');

    await expectBothResults(page);
  });

});
