import { test, expect } from '@playwright/test';

// ── Datos de prueba reutilizables ─────────────────────────────────────────────

const LISTA_A = { id: 1, user_id: 'test-user-1', nombre: 'Mis Favoritos', icono: 'Heart' };
const LISTA_B = { id: 2, user_id: 'test-user-1', nombre: 'Para cenar', icono: 'Wine' };

const RESTAURANTES_LISTA_A = [
  {
    id: 10, lista_id: 1, place_id: 'place_a',
    restaurant: { id: 101, name: 'Pizzería Bella', rating: 4.5, user_ratings_total: 100, types: ['restaurant'], address: 'Calle A 1', main_photo: null },
  },
  {
    id: 11, lista_id: 1, place_id: 'place_b',
    restaurant: { id: 102, name: 'Taco Loco', rating: 4.0, user_ratings_total: 80, types: ['restaurant'], address: 'Calle B 2', main_photo: null },
  },
  {
    id: 12, lista_id: 1, place_id: 'place_c',
    restaurant: { id: 103, name: 'Burger Bar', rating: 3.8, user_ratings_total: 50, types: ['restaurant'], address: 'Calle C 3', main_photo: null },
  },
];

test.describe('Pruebas de Favoritos - Base-Choice', () => {

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
  });

  // ── BASE: Listas = Varios, Restaurantes = Varios, Búsqueda = No ───────────────
  test('debe mostrar varias listas y varios restaurantes sin búsqueda (BASE)', async ({ page }) => {
    // Mock de la lista de listas
    await page.route('**/api/favoritos/listas', async (route) => {
      if (route.request().method() === 'GET') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify([LISTA_A, LISTA_B]),
        });
      } else {
        await route.continue();
      }
    });

    // Mock del detalle de la Lista A (3 restaurantes)
    await page.route('**/api/favoritos/listas/1', async (route) => {
      if (route.request().method() === 'GET') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ lista: LISTA_A, restaurantes: RESTAURANTES_LISTA_A }),
        });
      } else {
        await route.continue();
      }
    });

    await page.goto('/favorites');

    // Verificamos que se muestran 2 listas
    const listCards = page.locator('.fav-list-card');
    await expect(listCards).toHaveCount(2);
    const countText = page.locator('span', { hasText: '2 listas' });
    await expect(countText).toBeVisible();

    // Pulsamos sobre la Lista A para entrar en el detalle
    await listCards.first().click();

    // Verificamos que se muestran los 3 restaurantes
    const restaurantCards = page.locator('.restaurant-compact-card');
    await expect(restaurantCards).toHaveCount(3);

    // Verificamos el nombre de la lista en el header de detalle
    const listTitle = page.locator('h2', { hasText: 'Mis Favoritos' });
    await expect(listTitle).toBeVisible();

    // Verificamos que el buscador interno está vacío
    const searchInput = page.getByPlaceholder('Buscar en esta lista...');
    await expect(searchInput).toHaveValue('');
  });

  // ── 2. Sin listas creadas (Caso 2) ───────────────────────────────────────────────
  test('debe mostrar estado vacío si no hay listas (Caso 2)', async ({ page }) => {
    await page.route('**/api/favoritos/listas', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([]),
      });
    });

    await page.goto('/favorites');

    // No hay tarjetas de listas
    const listCards = page.locator('.fav-list-card');
    await expect(listCards).toHaveCount(0);

    // Mensaje de estado vacío
    const emptyText = page.locator('p', { hasText: 'Aún no tienes listas' });
    await expect(emptyText).toBeVisible();
  });

  // ── 3. Listas y elementos unitarios (Caso 3, Caso 4, Caso 5) ─────────────────────────
  test('debe mostrar listas y elementos de manera unitaria (Caso 3, Caso 4, Caso 5)', async ({ page }) => {
    const listCards = page.locator('.fav-list-card');
    const restaurantCards = page.locator('.restaurant-compact-card');

    // 3.1. Caso 3: Listas = 1
    await page.route('**/api/favoritos/listas', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([LISTA_A]),
      });
    });

    await page.goto('/favorites');
    await expect(listCards).toHaveCount(1);
    const countText = page.locator('span', { hasText: '1 lista' });
    await expect(countText).toBeVisible();
    await expect(listCards.first()).toContainText('Mis Favoritos');

    // 3.2. Caso 4: Restaurantes en lista = 0
    await page.route('**/api/favoritos/listas', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([LISTA_A, LISTA_B]),
      });
    });
    await page.route('**/api/favoritos/listas/1', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ lista: LISTA_A, restaurantes: [] }),
      });
    });

    await page.goto('/favorites');
    await listCards.first().click();
    await expect(restaurantCards).toHaveCount(0);
    const emptyText = page.locator('p', { hasText: 'Esta lista está vacía' });
    await expect(emptyText).toBeVisible();

    // 3.3. Caso 5: Restaurantes en lista = 1
    await page.route('**/api/favoritos/listas/1', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ lista: LISTA_A, restaurantes: [RESTAURANTES_LISTA_A[0]] }),
      });
    });

    await page.goto('/favorites');
    await listCards.first().click();
    await expect(restaurantCards).toHaveCount(1);
    await expect(restaurantCards.first().locator('.compact-name')).toHaveText('Pizzería Bella');
  });

  // ── 4. Búsqueda dentro de lista (Caso 6) ─────────────────────────────────────────
  test('debe filtrar dinámicamente al buscar dentro de una lista (Caso 6)', async ({ page }) => {
    await page.route('**/api/favoritos/listas', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([LISTA_A]),
      });
    });

    await page.route('**/api/favoritos/listas/1', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ lista: LISTA_A, restaurantes: RESTAURANTES_LISTA_A }),
      });
    });

    await page.goto('/favorites');

    const listCards = page.locator('.fav-list-card');
    await listCards.first().click();

    const restaurantCards = page.locator('.restaurant-compact-card');
    await expect(restaurantCards).toHaveCount(3);

    const searchInput = page.getByPlaceholder('Buscar en esta lista...');
    await searchInput.fill('Pizz');

    await expect(restaurantCards).toHaveCount(1);
    await expect(restaurantCards.first().locator('.compact-name')).toHaveText('Pizzería Bella');
  });
});
