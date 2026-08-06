import { test, expect } from '@playwright/test';

test.describe('Pruebas de Historial - Base-Choice', () => {

  test.beforeEach(async ({ page }) => {
    // Escuchamos logs de la consola del navegador para diagnóstico
    page.on('console', msg => console.log('PAGE LOG:', msg.text()));

    // Interceptamos la carga del script de Google GSI
    await page.route('**/gsi/client', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/javascript',
        body: 'console.log("Mock Google GSI client script loaded");',
      });
    });

    // Mock de perfil /api/me para simular sesión iniciada
    await page.route('**/api/me', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          username: 'testuser',
          email: 'test@test.com',
          nombre: 'Test',
          apellidos: 'User',
          ubicacion: 'Madrid, España',
          is_google: false,
        }),
      });
    });

    // Mock de las valoraciones (vacío)
    await page.route('**/api/valoraciones', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([]),
      });
    });
  });

  // ── 1. BASE: Meses = Varios, Restaurantes = Varios, Búsqueda = No ────────────────
  test('debe mostrar múltiples meses y múltiples restaurantes sin búsqueda (BASE)', async ({ page }) => {
    // Mock de historial con 3 restaurantes repartidos en 2 meses (Mayo 2026 y Abril 2026)
    await page.route('**/api/historial', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          {
            id: 1,
            user_id: 'test-user-1',
            place_id: 'place_1',
            fecha_acceso: '2026-05-28T10:00:00Z',
            restaurant: {
              name: 'Restaurante Base Choice 1',
              rating: 4.5,
              user_ratings_total: 120,
              types: ['restaurant'],
              address: 'Calle Falsa 123',
              main_photo: null,
            },
          },
          {
            id: 2,
            user_id: 'test-user-1',
            place_id: 'place_2',
            fecha_acceso: '2026-05-27T10:00:00Z',
            restaurant: {
              name: 'Restaurante Base Choice 2',
              rating: 4.0,
              user_ratings_total: 80,
              types: ['restaurant'],
              address: 'Calle Falsa 456',
              main_photo: null,
            },
          },
          {
            id: 3,
            user_id: 'test-user-1',
            place_id: 'place_3',
            fecha_acceso: '2026-04-15T10:00:00Z',
            restaurant: {
              name: 'Restaurante Base Choice 3',
              rating: 4.2,
              user_ratings_total: 95,
              types: ['restaurant'],
              address: 'Calle Falsa 789',
              main_photo: null,
            },
          },
        ]),
      });
    });

    await page.goto('/history');

    // Verificamos que se muestran los encabezados de los meses
    const mayoHeader = page.locator('.history-group-title', { hasText: 'MAYO 2026' });
    const abrilHeader = page.locator('.history-group-title', { hasText: 'ABRIL 2026' });
    await expect(mayoHeader).toBeVisible();
    await expect(abrilHeader).toBeVisible();

    // Mayo se expande solo por defecto, mostrando 2 restaurantes
    const cards = page.locator('.restaurant-compact-card');
    await expect(cards).toHaveCount(2);

    // Expandimos Abril
    const abrilGroupHeader = page.locator('.history-group-header', { hasText: 'ABRIL 2026' });
    await abrilGroupHeader.click();

    // Ahora deben mostrarse 3 restaurantes en total
    await expect(cards).toHaveCount(3);

    // Comprobar que la barra de búsqueda está vacía
    const searchInput = page.getByPlaceholder('Buscar en historial...');
    await expect(searchInput).toHaveValue('');
  });

  // ── 2. Historial vacío (Caso 2, Caso 4) ──────────────────────────────────────────
  test('debe mostrar estado vacío si no hay meses ni restaurantes (Caso 2, Caso 4)', async ({ page }) => {
    await page.route('**/api/historial', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([]),
      });
    });

    await page.goto('/history');

    // Verificamos que no hay grupos de meses
    const headers = page.locator('.history-group-title');
    await expect(headers).toHaveCount(0);

    // Verificamos que se muestra "0 restaurantes"
    const countText = page.locator('span', { hasText: '0 restaurantes' }).first();
    await expect(countText).toBeVisible();

    // No hay tarjetas de restaurantes
    const cards = page.locator('.restaurant-compact-card');
    await expect(cards).toHaveCount(0);
  });

  // ── 3. Historial unitario (Caso 3, Caso 5) ───────────────────────────────────────
  test('debe mostrar un único mes con uno o varios restaurantes (Caso 3, Caso 5)', async ({ page }) => {
    // 3.1. Caso 5: Restaurantes = 1
    await page.route('**/api/historial', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          {
            id: 1,
            user_id: 'test-user-1',
            place_id: 'place_1',
            fecha_acceso: '2026-05-28T10:00:00Z',
            restaurant: {
              name: 'Restaurante Base Choice 1',
              rating: 4.5,
              user_ratings_total: 120,
              types: ['restaurant'],
              address: 'Calle Falsa 123',
              main_photo: null,
            },
          },
        ]),
      });
    });

    await page.goto('/history');

    const headers = page.locator('.history-group-title');
    await expect(headers).toHaveCount(1);
    await expect(headers.first()).toHaveText('MAYO 2026');

    const cards = page.locator('.restaurant-compact-card');
    await expect(cards).toHaveCount(1);
    await expect(cards.first().locator('.compact-name')).toHaveText('Restaurante Base Choice 1');

    // 3.2. Caso 3: Meses = 1, Restaurantes = Varios
    await page.route('**/api/historial', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          {
            id: 1,
            user_id: 'test-user-1',
            place_id: 'place_1',
            fecha_acceso: '2026-05-28T10:00:00Z',
            restaurant: {
              name: 'Restaurante Base Choice 1',
              rating: 4.5,
              user_ratings_total: 120,
              types: ['restaurant'],
              address: 'Calle Falsa 123',
              main_photo: null,
            },
          },
          {
            id: 2,
            user_id: 'test-user-1',
            place_id: 'place_2',
            fecha_acceso: '2026-05-27T10:00:00Z',
            restaurant: {
              name: 'Restaurante Base Choice 2',
              rating: 4.0,
              user_ratings_total: 80,
              types: ['restaurant'],
              address: 'Calle Falsa 456',
              main_photo: null,
            },
          },
        ]),
      });
    });

    await page.goto('/history');
    await expect(headers).toHaveCount(1);
    await expect(headers.first()).toHaveText('MAYO 2026');
    await expect(cards).toHaveCount(2);
  });

  // ── 4. Búsqueda en historial (Caso 6) ────────────────────────────────────────────
  test('debe filtrar dinámicamente y ocultar meses sin coincidencias al buscar (Caso 6)', async ({ page }) => {
    await page.route('**/api/historial', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          {
            id: 1,
            user_id: 'test-user-1',
            place_id: 'place_1',
            fecha_acceso: '2026-05-28T10:00:00Z',
            restaurant: {
              name: 'Pizzería Bella Vista',
              rating: 4.5,
              user_ratings_total: 120,
              types: ['restaurant'],
              address: 'Calle Falsa 123',
              main_photo: null,
            },
          },
          {
            id: 2,
            user_id: 'test-user-1',
            place_id: 'place_2',
            fecha_acceso: '2026-05-27T10:00:00Z',
            restaurant: {
              name: 'Taco Loco',
              rating: 4.0,
              user_ratings_total: 80,
              types: ['restaurant'],
              address: 'Calle Falsa 456',
              main_photo: null,
            },
          },
          {
            id: 3,
            user_id: 'test-user-1',
            place_id: 'place_3',
            fecha_acceso: '2026-04-15T10:00:00Z',
            restaurant: {
              name: 'Burger Bar',
              rating: 4.2,
              user_ratings_total: 95,
              types: ['restaurant'],
              address: 'Calle Falsa 789',
              main_photo: null,
            },
          },
        ]),
      });
    });

    await page.goto('/history');

    // Rellenamos el cuadro de búsqueda con "Pizz"
    const searchInput = page.getByPlaceholder('Buscar en historial...');
    await searchInput.fill('Pizz');

    // Comprobamos que el mes "ABRIL 2026" (que no tiene coincidencias) desaparece del DOM
    const abrilHeader = page.locator('.history-group-title', { hasText: 'ABRIL 2026' });
    await expect(abrilHeader).not.toBeVisible();

    // Comprobamos que el mes "MAYO 2026" sigue visible
    const mayoHeader = page.locator('.history-group-title', { hasText: 'MAYO 2026' });
    await expect(mayoHeader).toBeVisible();

    // Sólo se muestra la tarjeta de "Pizzería Bella Vista"
    const cards = page.locator('.restaurant-compact-card');
    await expect(cards).toHaveCount(1);
    await expect(cards.first().locator('.compact-name')).toHaveText('Pizzería Bella Vista');
  });
});
