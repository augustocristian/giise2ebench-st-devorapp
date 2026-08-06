import { test, expect } from '@playwright/test';

test.describe('Pruebas de Menú Lateral - Base-Choice', () => {

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

    // Limpiamos localStorage antes de cada test para partir de estado limpio
    await page.addInitScript(() => {
      localStorage.removeItem('devorapp_theme');
      localStorage.removeItem('devorapp_fontsize');
    });

    // Navegamos a /home donde el menú lateral está disponible
    await page.goto('/home');

    // Abrimos el menú lateral pulsando el botón hamburguesa
    await page.click('button[aria-label="Abrir menú"]');

    // Esperamos a que el drawer esté visible
    await expect(page.locator('.sidemenu-drawer')).toBeVisible();
  });

  // ── BASE: Tema = Claro, Letra = M ─────────────────────────────────────────────
  test('debe aplicar Tema Claro y Letra M por defecto (BASE)', async ({ page }) => {
    // Pulsamos el botón "Claro"
    const themeToggle = page.locator('.sidemenu-toggle-group').first();
    await themeToggle.locator('button', { hasText: 'Claro' }).click();

    // Verificamos que el botón "Claro" está activo y "Oscuro" no
    await expect(themeToggle.locator('button', { hasText: 'Claro' })).toHaveClass(/active/);
    await expect(themeToggle.locator('button', { hasText: 'Oscuro' })).not.toHaveClass(/active/);

    // Verificamos que el atributo data-theme="light" se aplica en <html>
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');

    // Letra M: verificamos que el botón M está activo por defecto
    const fontToggle = page.locator('.sidemenu-toggle-group').nth(1);
    await expect(fontToggle.locator('button', { hasText: 'M' })).toHaveClass(/active/);

    // Verificamos que NO hay atributo data-font-size (M es el valor por defecto)
    await expect(page.locator('html')).not.toHaveAttribute('data-font-size');
  });

  // ── Caso 2: Tema = Oscuro, Letra = M ──────────────────────────────────────────
  test('debe aplicar Tema Oscuro y Letra M (Caso 2)', async ({ page }) => {
    // Pulsamos el botón "Oscuro"
    const themeToggle = page.locator('.sidemenu-toggle-group').first();
    await themeToggle.locator('button', { hasText: 'Oscuro' }).click();

    // Verificamos que el botón "Oscuro" está activo y "Claro" no
    await expect(themeToggle.locator('button', { hasText: 'Oscuro' })).toHaveClass(/active/);
    await expect(themeToggle.locator('button', { hasText: 'Claro' })).not.toHaveClass(/active/);

    // Verificamos que NO hay atributo data-theme (oscuro = por defecto, sin atributo)
    await expect(page.locator('html')).not.toHaveAttribute('data-theme');

    // Letra M: verificamos que el botón M está activo
    const fontToggle = page.locator('.sidemenu-toggle-group').nth(1);
    await expect(fontToggle.locator('button', { hasText: 'M' })).toHaveClass(/active/);
  });

  // ── Caso 3: Tema = Claro, Letra = S ───────────────────────────────────────────
  test('debe aplicar Tema Claro y Letra S (Caso 3)', async ({ page }) => {
    // Pulsamos el botón "Claro"
    const themeToggle = page.locator('.sidemenu-toggle-group').first();
    await themeToggle.locator('button', { hasText: 'Claro' }).click();

    // Verificamos que data-theme="light" se aplica
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');

    // Pulsamos el botón "S" de tamaño de letra
    const fontToggle = page.locator('.sidemenu-toggle-group').nth(1);
    await fontToggle.locator('button', { hasText: 'S' }).click();

    // Verificamos que el botón S está activo
    await expect(fontToggle.locator('button', { hasText: 'S' })).toHaveClass(/active/);
    await expect(fontToggle.locator('button', { hasText: 'M' })).not.toHaveClass(/active/);

    // Verificamos que data-font-size="S" se aplica en <html>
    await expect(page.locator('html')).toHaveAttribute('data-font-size', 'S');
  });

  // ── Caso 4: Tema = Claro, Letra = L ───────────────────────────────────────────
  test('debe aplicar Tema Claro y Letra L (Caso 4)', async ({ page }) => {
    // Pulsamos el botón "Claro"
    const themeToggle = page.locator('.sidemenu-toggle-group').first();
    await themeToggle.locator('button', { hasText: 'Claro' }).click();

    // Verificamos que data-theme="light" se aplica
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');

    // Pulsamos el botón "L" de tamaño de letra
    const fontToggle = page.locator('.sidemenu-toggle-group').nth(1);
    await fontToggle.locator('button', { hasText: 'L' }).click();

    // Verificamos que el botón L está activo
    await expect(fontToggle.locator('button', { hasText: 'L' })).toHaveClass(/active/);
    await expect(fontToggle.locator('button', { hasText: 'M' })).not.toHaveClass(/active/);

    // Verificamos que data-font-size="L" se aplica en <html>
    await expect(page.locator('html')).toHaveAttribute('data-font-size', 'L');
  });
});
