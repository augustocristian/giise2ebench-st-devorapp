import { test, expect } from '@playwright/test';

test.describe('Pruebas de Inicio de Sesión - Base-Choice', () => {

  test.beforeEach(async ({ page }) => {
    // Interceptamos la carga del script de Google GSI para evitar que sobrescriba el mock
    await page.route('**/gsi/client', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/javascript',
        body: 'console.log("Mock Google GSI client script loaded");',
      });
    });

    // Inyectamos el mock del SDK de Google Identity Services antes de cargar la página
    await page.addInitScript(() => {
      (window as any).google = {
        accounts: {
          oauth2: {
            initTokenClient: (config: any) => {
              (window as any).mockGoogleTokenClient = config;
              return {
                requestAccessToken: () => {
                  // Simulamos la respuesta exitosa del popup de Google
                  if ((window as any).mockGoogleTokenClient?.callback) {
                    (window as any).mockGoogleTokenClient.callback({
                      access_token: 'fake_google_access_token',
                    });
                  }
                },
              };
            },
          },
        },
      };
    });

    // Interceptamos /api/me para evitar llamadas reales al cargar /home
    await page.route('**/api/me', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          username: 'testuser',
          email: 'test@test.com',
          nombre: 'Test',
          apellidos: 'User',
          ubicacion: 'Madrid',
          is_google: false,
        }),
      });
    });

    // Vamos a la página de login
    await page.goto('/login');
  });

  // ── 1. Campos vacíos / identificación sin contraseña (BASE, S3, S4, S5, S6) ──────
  test('debe mostrar error y no llamar a la API si no se ingresa la contraseña o si están vacíos (BASE, S3, S4, S5, S6)', async ({ page }) => {
    // Variable para comprobar si se hace la petición de login
    let loginRequestCalled = false;
    await page.route('**/api/login', async (route) => {
      loginRequestCalled = true;
      await route.fallback();
    });

    const submitBtn = page.locator('#login-submit-btn');
    const alertMessage = page.locator('role=alert');

    // 1.1. BASE: Correo existe, contraseña vacía
    await page.locator('#identifier').fill('ana@test.com');
    await submitBtn.click();
    await expect(alertMessage).toContainText('Rellene todos los campos');

    // 1.2. S3: Correo no existe, contraseña vacía
    await page.locator('#identifier').fill('noexiste@test.com');
    await submitBtn.click();
    await expect(alertMessage).toContainText('Rellene todos los campos');

    // 1.3. S4: Usuario existe, contraseña vacía
    await page.locator('#identifier').fill('testuser');
    await submitBtn.click();
    await expect(alertMessage).toContainText('Rellene todos los campos');

    // 1.4. S5: Usuario no existe, contraseña vacía
    await page.locator('#identifier').fill('noexisteuser');
    await submitBtn.click();
    await expect(alertMessage).toContainText('Rellene todos los campos');

    // 1.5. S6: Ambos vacíos
    await page.locator('#identifier').fill('');
    await submitBtn.click();
    await expect(alertMessage).toContainText('Rellene todos los campos');

    // Verificamos que no se realizó la llamada a la API
    expect(loginRequestCalled).toBe(false);
  });

  // ── 2. Inicio de sesión correcto (S7 - Happy Path) ─────────────────────────────
  test('debe iniciar sesión con credenciales correctas y redirigir a /home (S7 - Happy Path)', async ({ page }) => {
    // Interceptamos la llamada al endpoint de login
    await page.route('**/api/login', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        headers: {
          'Set-Cookie': 'access_token=fake_jwt_token; Path=/; HttpOnly; SameSite=Lax',
        },
        body: JSON.stringify({
          message: 'Login exitoso',
          user: {
            username: 'testuser',
            email: 'test@test.com',
            nombre: 'Test',
            apellidos: 'User',
            ubicacion: 'Madrid',
            is_google: false,
          },
        }),
      });
    });

    await page.locator('#identifier').fill('ana@test.com');
    await page.locator('#password').fill('Segura123');
    await page.locator('#login-submit-btn').click();

    // Verificamos que redirige a /home
    await expect(page).toHaveURL(/\/home$/);
  });

  // ── 3. Contraseña incorrecta (S8) ─────────────────────────────────────────────
  test('debe mostrar error si la contraseña ingresada es incorrecta (S8)', async ({ page }) => {
    // Interceptamos la llamada al endpoint de login para simular credenciales incorrectas
    await page.route('**/api/login', async (route) => {
      await route.fulfill({
        status: 401,
        contentType: 'application/json',
        body: JSON.stringify({
          detail: 'Credenciales incorrectas',
        }),
      });
    });

    await page.locator('#identifier').fill('ana@test.com');
    await page.locator('#password').fill('wrongpass');
    await page.locator('#login-submit-btn').click();

    // Verificamos que se muestra el error de credenciales incorrectas
    const alertMessage = page.locator('role=alert');
    await expect(alertMessage).toContainText('Credenciales incorrectas');
  });

  // ── 4. Inicio de sesión con Google (S2) ──────────────────────────────────────────
  test('debe iniciar sesión con Google y redirigir a /home (S2)', async ({ page }) => {
    // Interceptamos la llamada al endpoint de Google Auth del backend
    await page.route('**/api/auth/google', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        headers: {
          'Set-Cookie': 'access_token=fake_google_jwt_token; Path=/; HttpOnly; SameSite=Lax',
        },
        body: JSON.stringify({
          message: 'Login con Google exitoso',
          user: {
            username: 'googleuser',
            email: 'google@test.com',
            nombre: 'Google',
            apellidos: 'User',
            ubicacion: 'Madrid',
            is_google: true,
          },
        }),
      });
    });

    // Pulsamos el botón de iniciar sesión con Google
    await page.locator('#google-login-btn').click();

    // Comprobamos que redirige a /home
    await expect(page).toHaveURL(/\/home$/);
  });
});
