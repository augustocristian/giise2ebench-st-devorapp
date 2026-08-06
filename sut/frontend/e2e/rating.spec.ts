import { test, expect } from '@playwright/test';

test.describe('Pruebas de Valoración - Base-Choice', () => {

  let lastRatingPayload: any = null;

  test.beforeEach(async ({ page }) => {
    // Escuchamos logs de la consola del navegador para diagnóstico
    page.on('console', msg => console.log('PAGE LOG:', msg.text()));

    // Reset del payload
    lastRatingPayload = null;

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

    // Mock del historial para devolver un restaurante "Sin reseñar"
    await page.route('**/api/historial', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          {
            id: 1,
            user_id: 'test-user-1',
            place_id: 'place_base_choice',
            fecha_acceso: '2026-05-28T10:00:00Z',
            restaurant: {
              name: 'Restaurante Base Choice',
              rating: 4.5,
              user_ratings_total: 120,
              types: ['restaurant'],
              address: 'Calle de la Prueba 123',
              main_photo: null,
            },
          },
        ]),
      });
    });

    // Mock de mis valoraciones (vacío inicialmente para que el badge de reseña aparezca como "Sin reseñar")
    await page.route('**/api/valoraciones', async (route) => {
      if (route.request().method() === 'POST') {
        lastRatingPayload = JSON.parse(route.request().postData() || '{}');
        await route.fulfill({
          status: 201,
          contentType: 'application/json',
          body: JSON.stringify({
            id: 101,
            place_id: lastRatingPayload.place_id,
            calidad: lastRatingPayload.calidad,
            precio: lastRatingPayload.precio,
            higiene: lastRatingPayload.higiene,
            trato: lastRatingPayload.trato,
            comentario: lastRatingPayload.comentario,
            fecha: new Date().toISOString(),
          }),
        });
      } else if (route.request().method() === 'GET') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify([]),
        });
      } else {
        await route.fallback();
      }
    });

    // Mock de obtener valoración individual
    await page.route('**/api/valoraciones/place_base_choice', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({}),
      });
    });

    // Navegar a la página del historial
    await page.goto('/history');
  });

  // Helper para abrir el modal de valoración de un restaurante específico
  async function openRatingModal(page: any) {
    // Localizamos la tarjeta por el nombre del restaurante
    const card = page.locator('.restaurant-compact-card', { hasText: 'Restaurante Base Choice' });
    await expect(card).toBeVisible();

    // Hacemos clic en el botón de tres puntos (ItemMenu) de la tarjeta
    const menuBtn = card.locator('button').first();
    await menuBtn.click();

    // Hacemos clic en "Valorar restaurante"
    const ratingBtn = page.locator('button', { hasText: 'Valorar restaurante' });
    await expect(ratingBtn).toBeVisible();
    await ratingBtn.click();

    // Verificamos que se muestre el contenido del modal
    await expect(page.locator('.valuation-content')).toBeVisible();
  }

  // Helper para seleccionar la puntuación (estrellas) de un aspecto
  async function selectStars(page: any, aspect: string, rating: number) {
    if (rating <= 0) return;
    const aspectRow = page.locator('.aspect-row-premium', { hasText: aspect });
    const starsContainer = aspectRow.locator('div').last();
    const star = starsContainer.locator('svg').nth(rating - 1);
    await star.click();
  }

  // Helper común para rellenar los valores base en el modal
  async function fillBaseRatings(page: any, {
    calidad = 5,
    precio = 5,
    higiene = 5,
    trato = 5,
    comentario = 'Excelente servicio y comida deliciosa',
  } = {}) {
    await selectStars(page, 'calidad', calidad);
    await selectStars(page, 'precio', precio);
    await selectStars(page, 'higiene', higiene);
    await selectStars(page, 'trato', trato);

    const textarea = page.locator('textarea.textarea-premium');
    if (comentario) {
      await textarea.fill(comentario);
    } else {
      await textarea.fill('');
    }
  }

  // ── 1. Guardar valoración completa - Caso BASE (BASE) ─────────────────────────────
  test('debe guardar la valoración con todos los aspectos al máximo y comentario (BASE)', async ({ page }) => {
    await openRatingModal(page);
    await fillBaseRatings(page);

    const submitBtn = page.locator('button.btn-submit-valuation');
    await expect(submitBtn).toBeEnabled();
    await submitBtn.click();

    // Comprobamos la llamada a la API
    await expect.poll(() => lastRatingPayload).not.toBeNull();
    expect(lastRatingPayload.calidad).toBe(5);
    expect(lastRatingPayload.precio).toBe(5);
    expect(lastRatingPayload.higiene).toBe(5);
    expect(lastRatingPayload.trato).toBe(5);
    expect(lastRatingPayload.comentario).toBe('Excelente servicio y comida deliciosa');

    // El modal debe cerrarse y mostrarse la notificación de éxito
    await expect(page.locator('.valuation-content')).not.toBeVisible();
    await expect(page.locator('.toast.success')).toBeVisible();
  });

  // ── 2. Validación de 0 estrellas deshabilitada (S2, S5, S8, S11) ─────────────────
  test('debe deshabilitar el botón de enviar si algún aspecto tiene 0 estrellas (S2, S5, S8, S11)', async ({ page }) => {
    const submitBtn = page.locator('button.btn-submit-valuation');

    // 2.1. S2: Calidad = 0
    await openRatingModal(page);
    await fillBaseRatings(page, { calidad: 0 });
    await expect(submitBtn).toBeDisabled();

    // 2.2. S5: Precio = 0
    await page.goto('/history');
    await openRatingModal(page);
    await fillBaseRatings(page, { precio: 0 });
    await expect(submitBtn).toBeDisabled();

    // 2.3. S8: Higiene = 0
    await page.goto('/history');
    await openRatingModal(page);
    await fillBaseRatings(page, { higiene: 0 });
    await expect(submitBtn).toBeDisabled();

    // 2.4. S11: Trato = 0
    await page.goto('/history');
    await openRatingModal(page);
    await fillBaseRatings(page, { trato: 0 });
    await expect(submitBtn).toBeDisabled();
  });

  // ── 3. Puntuaciones variables de Calidad y Precio (S3, S4, S6, S7) ───────────────
  test('debe guardar la valoración con diferentes puntuaciones de calidad y precio (S3, S4, S6, S7)', async ({ page }) => {
    const submitBtn = page.locator('button.btn-submit-valuation');

    // 3.1. Sub-caso A: Calidad = 1, Precio = 3
    await openRatingModal(page);
    await fillBaseRatings(page, { calidad: 1, precio: 3 });
    await expect(submitBtn).toBeEnabled();
    await submitBtn.click();
    await expect.poll(() => lastRatingPayload).not.toBeNull();
    expect(lastRatingPayload.calidad).toBe(1);
    expect(lastRatingPayload.precio).toBe(3);
    expect(lastRatingPayload.higiene).toBe(5);
    expect(lastRatingPayload.trato).toBe(5);

    // Esperamos a que se oculte el modal tras enviar
    await expect(page.locator('.valuation-content')).not.toBeVisible();
    lastRatingPayload = null; // Reset payload

    // 3.2. Sub-caso B: Calidad = 3, Precio = 1
    await page.goto('/history');
    await openRatingModal(page);
    await fillBaseRatings(page, { calidad: 3, precio: 1 });
    await expect(submitBtn).toBeEnabled();
    await submitBtn.click();
    await expect.poll(() => lastRatingPayload).not.toBeNull();
    expect(lastRatingPayload.calidad).toBe(3);
    expect(lastRatingPayload.precio).toBe(1);
    expect(lastRatingPayload.higiene).toBe(5);
    expect(lastRatingPayload.trato).toBe(5);
  });

  // ── 4. Puntuaciones variables de Higiene y Trato (S9, S10, S12, S13) ──────────────
  test('debe guardar la valoración con diferentes puntuaciones de higiene y trato (S9, S10, S12, S13)', async ({ page }) => {
    const submitBtn = page.locator('button.btn-submit-valuation');

    // 4.1. Sub-caso A: Higiene = 1, Trato = 3
    await openRatingModal(page);
    await fillBaseRatings(page, { higiene: 1, trato: 3 });
    await expect(submitBtn).toBeEnabled();
    await submitBtn.click();
    await expect.poll(() => lastRatingPayload).not.toBeNull();
    expect(lastRatingPayload.calidad).toBe(5);
    expect(lastRatingPayload.precio).toBe(5);
    expect(lastRatingPayload.higiene).toBe(1);
    expect(lastRatingPayload.trato).toBe(3);

    // Esperamos a que se oculte el modal tras enviar
    await expect(page.locator('.valuation-content')).not.toBeVisible();
    lastRatingPayload = null; // Reset payload

    // 4.2. Sub-caso B: Higiene = 3, Trato = 1
    await page.goto('/history');
    await openRatingModal(page);
    await fillBaseRatings(page, { higiene: 3, trato: 1 });
    await expect(submitBtn).toBeEnabled();
    await submitBtn.click();
    await expect.poll(() => lastRatingPayload).not.toBeNull();
    expect(lastRatingPayload.calidad).toBe(5);
    expect(lastRatingPayload.precio).toBe(5);
    expect(lastRatingPayload.higiene).toBe(3);
    expect(lastRatingPayload.trato).toBe(1);
  });

  // ── 5. Guardar valoración sin comentario (S14) ───────────────────────────────────
  test('debe guardar la valoración si se deja el comentario vacío (S14)', async ({ page }) => {
    await openRatingModal(page);
    await fillBaseRatings(page, { comentario: '' });

    const submitBtn = page.locator('button.btn-submit-valuation');
    await expect(submitBtn).toBeEnabled();
    await submitBtn.click();

    await expect.poll(() => lastRatingPayload).not.toBeNull();
    expect(lastRatingPayload.calidad).toBe(5);
    expect(lastRatingPayload.precio).toBe(5);
    expect(lastRatingPayload.higiene).toBe(5);
    expect(lastRatingPayload.trato).toBe(5);
    expect(lastRatingPayload.comentario || '').toBe('');
  });

});

