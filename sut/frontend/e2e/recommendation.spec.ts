import { test, expect } from '@playwright/test';

test.describe('Pruebas del Recomendador de Restaurantes - Base-Choice', () => {

  let lastSearchPayload: any = null;

  test.beforeEach(async ({ page }) => {
    // Escuchamos logs de la consola del navegador para diagnóstico
    page.on('console', msg => console.log('PAGE LOG:', msg.text()));

    // Reset del payload
    lastSearchPayload = null;

    // Interceptamos la carga del script de Google GSI
    await page.route('**/gsi/client', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/javascript',
        body: 'console.log("Mock Google GSI client script loaded");',
      });
    });

    // Interceptamos la carga del script de Google Maps API para evitar que cargue el script real y sobrescriba nuestro mock
    await page.route('**/maps/api/js*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/javascript',
        body: 'console.log("Mock Google Maps script loaded");',
      });
    });

    // Inyectamos el mock global de Google Maps Autocomplete con stubs para evitar crasheos de react-google-autocomplete
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
                  formatted_address: this.input ? this.input.value : 'Madrid, España',
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

    // Mock de perfil /api/me para indicar ubicación preferida
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

    // Mock de Google Geocoding API para la carga de moneda al detectar ubicación preferida
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

    // Mock del endpoint de búsqueda de recomendaciones
    await page.route('**/api/recommendations/search', async (route) => {
      if (route.request().method() !== 'POST') {
        return route.fallback();
      }
      lastSearchPayload = JSON.parse(route.request().postData() || '{}');

      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          results: [
            {
              id: "restaurante_mock_1",
              name: "Restaurante de Prueba 1",
              main_photo: null,
              rating: 4.5,
              user_ratings_total: 120,
              types: ["mexican_restaurant", "restaurant"],
              address: "Calle Falsa 123, Madrid",
              summary: "Un excelente lugar de comida mexicana.",
              opening_hours: {
                open_now: true
              },
              google_maps_uri: "https://maps.google.com/?q=Restaurante+de+Prueba+1",
              website_uri: "https://restauranteprueba1.com"
            },
            {
              id: "restaurante_mock_2",
              name: "Restaurante de Prueba 2",
              main_photo: null,
              rating: 4.0,
              user_ratings_total: 80,
              types: ["italian_restaurant", "restaurant"],
              address: "Calle Falsa 124, Madrid",
              summary: "Un excelente lugar de comida italiana.",
              opening_hours: {
                open_now: true
              },
              google_maps_uri: "https://maps.google.com/?q=Restaurante+de+Prueba+2",
              website_uri: "https://restauranteprueba2.com"
            }
          ],
          next_page_token: null
        })
      });
    });

    // Vamos a la página del recomendador
    await page.goto('/recommend-restaurants');
  });

  // Helper para añadir una etiqueta/cocina en el dropdown autocomplete
  async function addTag(page: any, query: string, label: string) {
    const input = page.getByPlaceholder('+ Añadir tipo de cocina...');
    await input.click();
    await input.fill(query);
    
    // Localizamos la opción del dropdown usando el selector de hermano adyacente para evitar falsos positivos en el DOM
    const option = page.locator('input[placeholder="+ Añadir tipo de cocina..."] + div > div').filter({ hasText: label }).first();
    await expect(option).toBeVisible();
    await option.click();
    
    // Esperamos a que el chip de la etiqueta seleccionada aparezca en la UI para asegurar que se añadió correctamente
    const chip = page.locator('span', { hasText: label }).first();
    await expect(chip).toBeVisible();
  }

  // Helper para rellenar los valores BASE comunes de los filtros
  async function setupBaseFilters(page: any) {
    // 1. Etiquetas: Varias (Mexicano e Italiano)
    await addTag(page, 'Mexicano', 'Mexicano');
    await addTag(page, 'Italiano', 'Italiano');

    // 2. Precio: Varios (Moderado €€ y Caro €€€)
    await page.locator('button', { hasText: '€€' }).first().click();
    await page.locator('button', { hasText: '€€€' }).first().click();

    // 3. Sin precio: Sí
    await page.getByLabel('Incluir sitios sin precio confirmado').setChecked(true);

    // 4. Abierto: Sí
    await page.getByLabel('Solo lugares abiertos ahora').setChecked(true);

    // 5. Ubicación: Preferida (Seleccionada por defecto, pero forzamos por seguridad)
    await page.getByLabel('Usar ubicación preferida').check();
  }

  // ── 1. Caso BASE: Búsqueda con filtros base y ubicación preferida (BASE) ──────────
  test('debe buscar con todos los filtros base y ubicación preferida correctamente (BASE)', async ({ page }) => {
    // 1. Configuramos filtros base comunes
    await setupBaseFilters(page);

    // 2. Enviar búsqueda
    await page.locator('button', { hasText: 'Buscar recomendaciones' }).click({ noWaitAfter: true });

    // 3. Validamos que la petición se envió con todos los filtros BASE y la ubicación preferida
    await expect.poll(() => lastSearchPayload).not.toBeNull();
    expect(lastSearchPayload.categories).toContain('mexican_restaurant');
    expect(lastSearchPayload.categories).toContain('italian_restaurant');
    expect(lastSearchPayload.prices).toContain('PRICE_LEVEL_MODERATE');
    expect(lastSearchPayload.prices).toContain('PRICE_LEVEL_EXPENSIVE');
    expect(lastSearchPayload.include_unconfirmed_price).toBe(true);
    expect(lastSearchPayload.open_now).toBe(true);
    expect(lastSearchPayload.location).toBe('Madrid, España');

    // 4. Validamos que los resultados se listan en pantalla
    await expect(page.locator('text=Sugerencias para ti')).toBeVisible();
    await expect(page.locator('.suggestion-card')).toHaveCount(2);
    await expect(page.locator('text=Restaurante de Prueba 1')).toBeVisible();
    await expect(page.locator('text=Restaurante de Prueba 2')).toBeVisible();
  });

  // ── 2. Búsqueda sin filtros y con 0 resultados (S2, S4, S10) ───────────────────
  test('debe buscar sin filtros seleccionados y manejar la respuesta vacía (S2, S4, S10)', async ({ page }) => {
    // Interceptamos la llamada para este test devolviendo un array vacío
    await page.route('**/api/recommendations/search', async (route) => {
      lastSearchPayload = JSON.parse(route.request().postData() || '{}');
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          results: [],
          next_page_token: null
        })
      });
    });

    // Enviar búsqueda directamente (sin añadir categorías o precios, con ubicación preferida por defecto)
    await page.locator('button', { hasText: 'Buscar recomendaciones' }).click({ noWaitAfter: true });

    // Validamos la petición al backend
    await expect.poll(() => lastSearchPayload).not.toBeNull();
    expect(lastSearchPayload.categories).toEqual([]); // S2 (Etiquetas = 0)
    expect(lastSearchPayload.prices).toEqual([]); // S4 (Precio = 0)
    expect(lastSearchPayload.location).toBe('Madrid, España');

    // Verificamos que no se renderiza ninguna tarjeta y la sección de títulos está oculta (S10)
    await expect(page.locator('.suggestion-card')).toHaveCount(0);
    await expect(page.locator('text=Sugerencias para ti')).not.toBeVisible();
  });

  // ── 3. Búsqueda con filtros simples y 1 resultado (S3, S5, S11) ───────────────────
  test('debe buscar con filtros simples y mostrar un único resultado (S3, S5, S11)', async ({ page }) => {
    // Interceptamos la llamada para este test devolviendo 1 restaurante
    await page.route('**/api/recommendations/search', async (route) => {
      lastSearchPayload = JSON.parse(route.request().postData() || '{}');
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          results: [
            {
              id: "restaurante_mock_1",
              name: "Restaurante de Prueba 1",
              main_photo: null,
              rating: 4.5,
              user_ratings_total: 120,
              types: ["mexican_restaurant", "restaurant"],
              address: "Calle Falsa 123, Madrid",
              summary: "Un excelente lugar de comida mexicana.",
              opening_hours: {
                open_now: true
              },
              google_maps_uri: "https://maps.google.com/?q=Restaurante+de+Prueba+1",
              website_uri: "https://restauranteprueba1.com"
            }
          ],
          next_page_token: null
        })
      });
    });

    // Exactamente 1 etiqueta
    await addTag(page, 'Mexicano', 'Mexicano'); // S3 (Etiquetas = 1)

    // Precio: 1 (Económico €)
    await page.locator('button', { hasText: '€' }).first().click(); // S5 (Precio = 1)

    // Enviar búsqueda
    await page.locator('button', { hasText: 'Buscar recomendaciones' }).click({ noWaitAfter: true });

    // Validamos la petición al backend
    await expect.poll(() => lastSearchPayload).not.toBeNull();
    expect(lastSearchPayload.categories).toEqual(['mexican_restaurant']);
    expect(lastSearchPayload.prices).toEqual(['PRICE_LEVEL_INEXPENSIVE']);

    // Verificamos que se muestra exactamente 1 tarjeta (S11)
    await expect(page.locator('.suggestion-card')).toHaveCount(1);
    await expect(page.locator('text=Restaurante de Prueba 1')).toBeVisible();
  });

  // ── 4. Exclusión de filtros booleanos y error de ubicación alternativa (S6, S7, S9) ──
  test('debe validar la exclusión de booleanos y el bloqueo de ubicación alternativa vacía (S6, S7, S9)', async ({ page }) => {
    // Configurar filtros base para tags y precios
    await addTag(page, 'Mexicano', 'Mexicano');
    await addTag(page, 'Italiano', 'Italiano');
    await page.locator('button', { hasText: '€€' }).first().click();
    await page.locator('button', { hasText: '€€€' }).first().click();

    // Desmarcamos "Incluir sitios sin precio confirmado" (S6: Sin precio = No)
    await page.getByLabel('Incluir sitios sin precio confirmado').setChecked(false);

    // Desmarcamos "Solo lugares abiertos ahora" (S7: Abierto = No)
    await page.getByLabel('Solo lugares abiertos ahora').setChecked(false);

    // Seleccionamos escoger otra ubicación
    await page.getByLabel('Escoger otra ubicación').check();

    // Aseguramos que el input está visible
    const autocompleteInput = page.getByPlaceholder('Ej. Madrid, Barcelona...');
    await expect(autocompleteInput).toBeVisible();

    // Dejamos el input vacío (S9: Ubicación = Otra No Válida) y hacemos clic en Buscar
    await page.locator('button', { hasText: 'Buscar recomendaciones' }).click({ noWaitAfter: true });

    // Comprobamos el mensaje de error de validación en pantalla
    const errorMsg = page.locator('.message.error');
    await expect(errorMsg).toContainText('Por favor, selecciona o introduce una ubicación.');

    // Verificamos que no se realizó ninguna petición de búsqueda al backend
    expect(lastSearchPayload).toBeNull();
  });

  // ── 5. Búsqueda en ubicación alternativa y Caso BASE / Resultados Varios (S8) ──
  test('debe buscar correctamente con filtros completos, ubicación alternativa y mostrar múltiples resultados (S8)', async ({ page }) => {
    // 1. Configuramos filtros base comunes
    await setupBaseFilters(page);

    // 2. Desmarcamos la ubicación preferida y seleccionamos otra ubicación
    await page.getByLabel('Escoger otra ubicación').check();

    // Esperamos a que el input esté visible
    const autocompleteInput = page.getByPlaceholder('Ej. Madrid, Barcelona...');
    await expect(autocompleteInput).toBeVisible();

    // Rellenamos el input
    await autocompleteInput.fill('Barcelona, España');

    // Esperamos a que la instancia del mock esté en el window
    await page.waitForFunction(() => (window as any).mockAutocompleteInstance !== undefined);

    // Simulamos la llamada al listener 'place_changed' de Google Maps
    await page.evaluate(() => {
      const instance = (window as any).mockAutocompleteInstance;
      if (instance && instance.listeners['place_changed']) {
        instance.listeners['place_changed'].forEach((cb: Function) => cb());
      }
    });

    // Enviar búsqueda
    await page.locator('button', { hasText: 'Buscar recomendaciones' }).click({ noWaitAfter: true });

    // Validamos que la petición se envió con todos los filtros BASE y la ubicación alternativa (S8)
    await expect.poll(() => lastSearchPayload).not.toBeNull();
    expect(lastSearchPayload.categories).toContain('mexican_restaurant');
    expect(lastSearchPayload.categories).toContain('italian_restaurant');
    expect(lastSearchPayload.prices).toContain('PRICE_LEVEL_MODERATE');
    expect(lastSearchPayload.prices).toContain('PRICE_LEVEL_EXPENSIVE');
    expect(lastSearchPayload.include_unconfirmed_price).toBe(true);
    expect(lastSearchPayload.open_now).toBe(true);
    expect(lastSearchPayload.location).toBe('Barcelona, España');

    // Validamos que los resultados se listan en pantalla (Varios outputs)
    await expect(page.locator('text=Sugerencias para ti')).toBeVisible();
    await expect(page.locator('.suggestion-card')).toHaveCount(2);
    await expect(page.locator('text=Restaurante de Prueba 1')).toBeVisible();
    await expect(page.locator('text=Restaurante de Prueba 2')).toBeVisible();
  });

});
