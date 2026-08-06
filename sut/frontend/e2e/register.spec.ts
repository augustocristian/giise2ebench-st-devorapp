import { test, expect } from '@playwright/test';

test.describe('Pruebas de Registro de Usuario - Condensadas', () => {

  test.beforeEach(async ({ page }) => {
    // Interceptamos la carga del script de Google GSI para evitar interferencias
    await page.route('**/gsi/client', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/javascript',
        body: 'console.log("Mock Google GSI client script loaded");',
      });
    });

    // Inyectamos mocks en la página
    await page.addInitScript(() => {
      // Mock de geolocalización usando Object.defineProperty (navigator.geolocation es de sólo lectura)
      Object.defineProperty(navigator, 'geolocation', {
        value: {
          getCurrentPosition: (success: Function, error?: Function, options?: any) => {
            success({
              coords: {
                latitude: 40.416775,
                longitude: -3.703790,
              }
            });
          }
        },
        configurable: true,
        writable: true
      });

      // Aceleramos los temporizadores para que las pruebas de polling e intervalos no tarden segundos
      const originalSetInterval = window.setInterval;
      (window as any).setInterval = (handler: TimerHandler, timeout?: number, ...args: any[]) => {
        if (timeout === 5000) {
          return originalSetInterval(handler, 100, ...args); // De 5s a 100ms
        }
        return originalSetInterval(handler, timeout, ...args);
      };

      const originalSetTimeout = window.setTimeout;
      (window as any).setTimeout = (handler: TimerHandler, timeout?: number, ...args: any[]) => {
        if (timeout === 2000) {
          return originalSetTimeout(handler, 50, ...args); // De 2s a 50ms
        }
        return originalSetTimeout(handler, timeout, ...args);
      };
    });

    // Interceptamos la API de verificación de disponibilidad (email y username)
    await page.route('**/api/check-availability*', async (route) => {
      const url = new URL(route.request().url());
      const email = url.searchParams.get('email') || '';
      const username = url.searchParams.get('username') || '';

      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          email_taken: email === 'used@test.com',
          username_taken: username === 'useduser',
        }),
      });
    });

    // Interceptamos la API de geocodificación de Google Maps (incluyendo CORS)
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
              formatted_address: 'Madrid, España',
            }
          ]
        })
      });
    });

    // Interceptamos el endpoint de creación de cuenta
    await page.route('**/api/register', async (route) => {
      if (route.request().method() !== 'POST') {
        return route.fallback();
      }
      const payload = JSON.parse(route.request().postData() || '{}');

      // Validaciones que realiza el backend sobre contraseña
      const hasLetter = /[A-Za-z]/.test(payload.password || '');
      const hasDigit = /\d/.test(payload.password || '');
      if (!hasLetter || !hasDigit) {
        await route.fulfill({
          status: 400,
          contentType: 'application/json',
          body: JSON.stringify({
            detail: 'La contraseña debe tener al menos 8 caracteres, una letra y un número',
          }),
        });
        return;
      }

      await route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify({
          message: 'Cuenta creada correctamente',
          user: {
            username: payload.username,
            email: payload.email,
            nombre: payload.nombre,
            apellidos: payload.apellidos,
            ubicacion: payload.ubicacion,
            is_google: false,
          },
        }),
      });
    });

    // Interceptamos el polling de verificación de correo
    // Devolvemos verificado=false en el primer intento para darle tiempo a Playwright a ver el mensaje,
    // y verificado=true en los siguientes intentos.
    let checkCount = 0;
    await page.route('**/api/check-verification/*', async (route) => {
      checkCount++;
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ verified: checkCount > 1 }),
      });
    });

    // Vamos a la página de registro
    await page.goto('/register');
  });

  // Función helper para rellenar los datos del paso 1
  async function fillStep1(page: any, data: {
    email?: string;
    username?: string;
    password?: string;
    nombre?: string;
    apellidos?: string;
  }) {
    if (data.email !== undefined) {
      await page.locator('#reg-email').fill(data.email);
    }
    if (data.username !== undefined) {
      await page.locator('#reg-username').fill(data.username);
    }
    if (data.password !== undefined) {
      await page.locator('#reg-password').fill(data.password);
    }
    if (data.nombre !== undefined) {
      await page.locator('#reg-nombre').fill(data.nombre);
    }
    if (data.apellidos !== undefined) {
      await page.locator('#reg-apellidos').fill(data.apellidos);
    }
  }

  // ── 1. Registro Exitoso - Caso BASE (BASE) ─────────────────────────────────────
  test('debe registrarse correctamente con datos válidos y redirigir a login (BASE)', async ({ page }) => {
    // Rellenamos paso 1
    await fillStep1(page, {
      email: 'ana@test.com',
      username: 'ana_test',
      password: 'Segura123',
      nombre: 'Ana',
      apellidos: 'García',
    });

    // Avanzamos al paso 2
    await page.locator('#register-continue-btn').click();

    // Comprobamos que estamos en el paso 2
    await expect(page.locator('text=Paso 2 de 2')).toBeVisible();

    // Seleccionamos ubicación usando el botón GPS
    await page.locator('#use-gps-btn').click();

    // Verificamos que se detecta la ubicación
    await expect(page.locator('.location-detected-name')).toContainText('Madrid, España');

    // Enviamos el formulario de registro
    await page.locator('#register-submit-btn').click();

    // Comprobamos la pantalla de "Verifica tu correo"
    await expect(page.locator('text=Verifica tu correo')).toBeVisible();

    // Debido a que aceleramos el setInterval/setTimeout, la verificación automática
    // sucederá casi de inmediato y nos redirigirá a la vista de login.
    await expect(page).toHaveURL(/\/login$/);
  });

  // ── 2. Validaciones de Identificación en Paso 1 (S2, S3, S4, S5, S6) ───────────
  test('debe validar el correo y nombre de usuario en el paso 1 (S2, S3, S4, S5, S6)', async ({ page }) => {
    // 2.1. S4: Correo vacío
    await fillStep1(page, {
      email: '',
      username: 'ana_test',
      password: 'Segura123',
      nombre: 'Ana',
      apellidos: 'García',
    });
    await page.locator('#register-continue-btn').click();
    await expect(page.locator('.message.error')).toContainText('El email es obligatorio.');
    await expect(page.locator('text=Paso 1 de 2')).toBeVisible();

    // 2.2. S2: Correo inválido
    await page.locator('#reg-email').fill('invalidemail');
    await page.locator('#register-continue-btn').click();
    await expect(page.locator('.message.error')).toContainText('Introduce un email válido.');

    // 2.3. S3: Correo en uso
    await page.locator('#reg-email').fill('used@test.com');
    await page.locator('#register-continue-btn').click();
    await expect(page.locator('#email-error')).toContainText('Este email ya está registrado.');

    // 2.4. S5: Nombre de usuario vacío
    await page.locator('#reg-email').fill('ana@test.com');
    await page.locator('#reg-username').fill('');
    await page.locator('#register-continue-btn').click();
    await expect(page.locator('.message.error')).toContainText('El nombre de usuario es obligatorio.');

    // 2.5. S6: Nombre de usuario en uso
    await page.locator('#reg-username').fill('useduser');
    await page.locator('#register-continue-btn').click();
    await expect(page.locator('#username-error')).toContainText('Este nombre de usuario ya está en uso.');
  });

  // ── 3. Validaciones de Datos Personales y Contraseña en Paso 1 (S7, S8, S9, S10) ──
  test('debe validar nombre, apellidos y contraseña en el paso 1 (S7, S8, S9, S10)', async ({ page }) => {
    // Rellenamos email y username correctos
    await fillStep1(page, {
      email: 'ana@test.com',
      username: 'ana_test',
    });

    // 3.1. S7: Nombre vacío
    await fillStep1(page, {
      nombre: '',
      apellidos: 'García',
      password: 'Segura123',
    });
    await page.locator('#register-continue-btn').click();
    await expect(page.locator('.message.error')).toContainText('El nombre es obligatorio.');

    // 3.2. S8: Apellidos vacíos
    await fillStep1(page, {
      nombre: 'Ana',
      apellidos: '',
    });
    await page.locator('#register-continue-btn').click();
    await expect(page.locator('.message.error')).toContainText('Los apellidos son obligatorios.');

    // 3.3. S9: Contraseña vacía
    await fillStep1(page, {
      apellidos: 'García',
      password: '',
    });
    await page.locator('#register-continue-btn').click();
    await expect(page.locator('.message.error')).toContainText('La contraseña es obligatoria.');

    // 3.4. S10: Contraseña corta (7 caracteres)
    await fillStep1(page, {
      password: 'Segu123',
    });
    await page.locator('#register-continue-btn').click();
    await expect(page.locator('.message.error')).toContainText('La contraseña debe tener al menos 8 caracteres.');
  });

  // ── 4. Validaciones de Ubicación y Contraseña en Paso 2 (S12, S13, S15, S16) ────
  test('debe validar ubicación y políticas de contraseña por backend en el paso 2 (S12, S13, S15, S16)', async ({ page }) => {
    // Rellenamos datos válidos pero contraseña sin letras (S13)
    await fillStep1(page, {
      email: 'ana@test.com',
      username: 'ana_test',
      password: '12345678',
      nombre: 'Ana',
      apellidos: 'García',
    });

    // Avanzamos al paso 2
    await page.locator('#register-continue-btn').click();
    await expect(page.locator('text=Paso 2 de 2')).toBeVisible();

    // 4.1. S16: Ubicación vacía
    await page.locator('#register-submit-btn').click();
    await expect(page.locator('.message.error')).toContainText('Debe seleccionar una ubicación válida de la lista');

    // 4.2. S15: Ubicación manual no seleccionada
    await page.locator('#reg-ubicacion').fill('Ubicación No Válida');
    await page.locator('#register-submit-btn').click();
    await expect(page.locator('.message.error')).toContainText('Debe seleccionar una ubicación válida de la lista');

    // 4.3. S13: Contraseña sin letras (error del backend)
    await page.locator('#use-gps-btn').click();
    await page.locator('#register-submit-btn').click();
    await expect(page.locator('.message.error')).toContainText('La contraseña debe tener al menos 8 caracteres, una letra y un número');

    // 4.4. S12: Contraseña sin números (error del backend)
    // Volvemos al paso 1 usando el botón de volver (o clickando en el paso anterior)
    await page.locator('#register-back-btn').click();
    await fillStep1(page, { password: 'PasswordNoNum' });
    await page.locator('#register-continue-btn').click();
    await page.locator('#use-gps-btn').click();
    await page.locator('#register-submit-btn').click();
    await expect(page.locator('.message.error')).toContainText('La contraseña debe tener al menos 8 caracteres, una letra y un número');
  });

  // ── 5. Registro Exitoso con Contraseña Larga (S11) ──────────────────────────────
  test('debe registrarse correctamente con una contraseña de 16 caracteres (S11)', async ({ page }) => {
    await fillStep1(page, {
      email: 'ana@test.com',
      username: 'ana_test',
      password: 'Segura1234567890', // longitud 16
      nombre: 'Ana',
      apellidos: 'García',
    });

    await page.locator('#register-continue-btn').click();
    await expect(page.locator('text=Paso 2 de 2')).toBeVisible();

    await page.locator('#use-gps-btn').click();
    await page.locator('#register-submit-btn').click();

    await expect(page.locator('text=Verifica tu correo')).toBeVisible();
    await expect(page).toHaveURL(/\/login$/);
  });

});
