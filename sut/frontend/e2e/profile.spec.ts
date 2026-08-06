import { test, expect } from '@playwright/test';

test.describe('Pruebas de Perfil - Condensadas', () => {

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

    // Interceptamos la carga de Google Maps Autocomplete API
    await page.route('**/maps/api/js*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/javascript',
        body: 'console.log("Mock Google Maps script loaded");',
      });
    });

    // Inyectamos el mock global de Google Maps Autocomplete
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
                  formatted_address: this.input ? this.input.value : 'Barcelona, España',
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

    // Mock de perfil /api/me para simular sesión iniciada con un usuario tradicional
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

    // Navegar a la página de perfil
    await page.goto('/profile');
  });

  // ── 1. Carga inicial de datos de perfil (BASE) ───────────────────────────────────
  test('debe cargar la información del perfil del usuario correctamente (BASE)', async ({ page }) => {
    const personalCard = page.locator('.location-info-card', { hasText: 'Información Personal' });
    const locationCard = page.locator('.location-info-card', { hasText: 'Ubicación Preferida' });

    await expect(personalCard).toContainText('Test');
    await expect(personalCard).toContainText('User');
    await expect(locationCard).toContainText('Madrid, España');
  });

  // ── 2. Información Personal y Ubicación (Condensa S2, S3, S4, Caso 2, 18) ────────
  test('debe permitir gestionar la información personal y la ubicación preferida (S2, S3, S4, Caso 2, 18)', async ({ page }) => {
    const personalCard = page.locator('.location-info-card', { hasText: 'Información Personal' });
    const locationCard = page.locator('.location-info-card', { hasText: 'Ubicación Preferida' });

    // 2.1. Caso 2: Cancelar edición personal
    await personalCard.locator('button', { hasText: 'Editar' }).click();
    await personalCard.locator('input').nth(0).fill('JuanModificado');
    await personalCard.locator('input').nth(1).fill('PérezModificado');
    await personalCard.locator('button', { hasText: 'Cancelar' }).click();
    await expect(personalCard).toContainText('Test');
    await expect(personalCard).toContainText('User');

    // Interceptamos la petición de actualización del perfil para las pruebas de éxito
    await page.route(url => url.pathname.endsWith('/api/profile'), async (route) => {
      if (route.request().method() === 'PATCH') {
        const payload = JSON.parse(route.request().postData() || '{}');
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            user: {
              username: 'testuser',
              email: 'test@test.com',
              nombre: payload.nombre || 'Test',
              apellidos: payload.apellidos || 'User',
              ubicacion: payload.ubicacion || 'Madrid, España',
              is_google: false,
            }
          }),
        });
      } else {
        await route.continue();
      }
    });

    // 1.3. S2 & S3: Editar nombre y apellidos correctamente
    await personalCard.locator('button', { hasText: 'Editar' }).click();
    await personalCard.locator('input').nth(0).fill('Juan');
    await personalCard.locator('input').nth(1).fill('Pérez');
    await personalCard.locator('button', { hasText: 'Guardar cambios' }).click();

    await expect(page.locator('.toast.success').last()).toBeVisible();
    await expect(page.locator('.toast.success').last()).toContainText('Perfil actualizado correctamente');
    await expect(personalCard).toContainText('Juan');
    await expect(personalCard).toContainText('Pérez');
    
    // Ocultar toast de éxito para evitar solapamientos visuales
    await page.locator('.toast.success').last().click();

    // 1.4. 18 (Ubicación Si - Mal): Escribir ubicación manual sin seleccionarla de la lista
    await locationCard.locator('button', { hasText: 'Cambiar' }).click();
    const autocompleteInput = locationCard.locator('input');
    await autocompleteInput.fill('aifgauif');
    await locationCard.locator('button', { hasText: 'Guardar cambios' }).click();
    
    const locationErrorText = locationCard.locator('span', { hasText: 'Debes seleccionar una ubicación válida' });
    await expect(locationErrorText).toBeVisible();

    // 1.5. S4: Editar ubicación seleccionando de la lista (Si - Bien)
    await autocompleteInput.fill('Barcelona, España');

    // Esperamos a que la instancia del autocompletado esté disponible y forzamos el trigger del evento 'place_changed'
    await page.waitForFunction(() => (window as any).mockAutocompleteInstance !== undefined);
    await page.evaluate(() => {
      const instance = (window as any).mockAutocompleteInstance;
      if (instance && instance.listeners['place_changed']) {
        instance.listeners['place_changed'].forEach((cb: Function) => cb());
      }
    });

    await locationCard.locator('button', { hasText: 'Guardar cambios' }).click();

    await expect(page.locator('.toast.success').last()).toBeVisible();
    await expect(locationCard).toContainText('Barcelona, España');
  });

  // ── 2. Gestión de Correo (Condensa S5, S6, S7, S8, S9, Caso 3) ───────────────────
  test('debe validar y permitir cambiar el correo electrónico', async ({ page }) => {
    // Interceptamos la actualización de email y decidimos la respuesta según el payload
    await page.route('**/api/profile/email', async (route) => {
      if (route.request().method() === 'PATCH') {
        const payload = JSON.parse(route.request().postData() || '{}');
        
        if (payload.password === 'WrongPassword') {
          await route.fulfill({
            status: 401,
            contentType: 'application/json',
            body: JSON.stringify({ detail: 'Contraseña incorrecta.' }),
          });
        } else if (payload.new_email === 'used@test.com') {
          await route.fulfill({
            status: 400,
            contentType: 'application/json',
            body: JSON.stringify({ detail: 'Este correo ya está registrado.' }),
          });
        } else {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({ message: 'Confirmación enviada' }),
          });
        }
      } else {
        await route.continue();
      }
    });

    const emailCard = page.locator('.location-info-card', { hasText: 'Correo Electrónico' });
    await emailCard.locator('button', { hasText: 'Cambiar' }).click();

    // 2.1. S7 & S9: Campos obligatorios (required)
    const emailInput = emailCard.locator('input[type="email"]');
    const passInput = emailCard.locator('#email-password-input');
    await expect(emailInput).toHaveAttribute('required', '');
    await expect(passInput).toHaveAttribute('required', '');

    // 2.2. S5: Correo no válido (No REGEX)
    await emailInput.fill('invalidemail');
    await passInput.fill('Password123');
    await emailCard.locator('button', { hasText: 'Cambiar correo' }).click();

    const isInvalid = await emailInput.evaluate((el: HTMLInputElement) => !el.checkValidity());
    expect(isInvalid).toBe(true);
    await expect(emailCard.locator('button', { hasText: 'Cancelar' })).toBeVisible();

    // 2.3. S8: Contraseña para cambiar correo incorrecta
    await emailInput.fill('nuevo@correo.com');
    await passInput.fill('WrongPassword');
    await emailCard.locator('button', { hasText: 'Cambiar correo' }).click();
    await expect(page.locator('.toast.error').last()).toBeVisible();
    await expect(page.locator('.toast.error').last()).toContainText('Contraseña incorrecta');
    await page.locator('.toast.error').last().click(); // Limpiar toast

    // 2.4. S6: Correo en uso
    await emailInput.fill('used@test.com');
    await passInput.fill('Password123');
    await emailCard.locator('button', { hasText: 'Cambiar correo' }).click();
    await expect(page.locator('.toast.error').last()).toBeVisible();
    await expect(page.locator('.toast.error').last()).toContainText('ya está registrado');
    await page.locator('.toast.error').last().click(); // Limpiar toast

    // 2.5. Caso 3: Cambiar email correctamente (Happy Path)
    await emailInput.fill('nuevo@correo.com');
    await passInput.fill('Password123');
    await emailCard.locator('button', { hasText: 'Cambiar correo' }).click();

    await expect(page.locator('.toast.success').last()).toBeVisible();
    await expect(page.locator('.toast.success').last()).toContainText('Se ha enviado un correo de confirmación');
    await expect(emailCard).toContainText('test@test.com'); // El correo en la tarjeta sigue siendo el original
  });

  // ── 3. Seguridad/Contraseña (Condensa S10, S11, S12, S13, S14, S15, S16) ─────────
  test('debe validar y permitir cambiar la contraseña', async ({ page }) => {
    // Interceptamos actualización de contraseña decidiendo la respuesta según el payload
    await page.route('**/api/profile/password', async (route) => {
      if (route.request().method() === 'PATCH') {
        const payload = JSON.parse(route.request().postData() || '{}');
        
        if (payload.old_password === 'WrongPassword') {
          await route.fulfill({
            status: 400,
            contentType: 'application/json',
            body: JSON.stringify({ detail: 'La contraseña actual es incorrecta.' }),
          });
        } else if (payload.new_password === 'Short1') {
          await route.fulfill({
            status: 400,
            contentType: 'application/json',
            body: JSON.stringify({ detail: 'La contraseña debe tener al menos 8 caracteres.' }),
          });
        } else if (payload.new_password === 'NuevaPasswordSinNum') {
          await route.fulfill({
            status: 400,
            contentType: 'application/json',
            body: JSON.stringify({ detail: 'La contraseña debe tener al menos un número.' }),
          });
        } else if (payload.new_password === '12345678') {
          await route.fulfill({
            status: 400,
            contentType: 'application/json',
            body: JSON.stringify({ detail: 'La contraseña debe tener al menos una letra.' }),
          });
        } else {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({ message: 'Contraseña actualizada' }),
          });
        }
      } else {
        await route.continue();
      }
    });

    const passwordCard = page.locator('.location-info-card', { hasText: 'Seguridad' });
    await passwordCard.locator('button', { hasText: 'Cambiar contraseña' }).click();

    const currentPassInput = passwordCard.locator('#current-password-input');
    const newPassInput = passwordCard.locator('#new-password-input');
    const confirmPassInput = passwordCard.locator('#confirm-password-input');

    // 3.1. S11 & S12: Requeridos
    await expect(currentPassInput).toHaveAttribute('required', '');
    await expect(newPassInput).toHaveAttribute('required', '');

    // 3.2. S13: Nueva contraseña muy corta (Longitud 7)
    await currentPassInput.fill('Actual123');
    await newPassInput.fill('Short1');
    await confirmPassInput.fill('Short1');
    await passwordCard.locator('button', { hasText: 'Actualizar contraseña' }).click();
    await expect(page.locator('.toast.error').last()).toBeVisible();
    await expect(page.locator('.toast.error').last()).toContainText('al menos 8 caracteres');
    await page.locator('.toast.error').last().click(); // Limpiar toast

    // 3.3. S15: Contraseña nueva sin números
    await newPassInput.fill('NuevaPasswordSinNum');
    await confirmPassInput.fill('NuevaPasswordSinNum');
    await passwordCard.locator('button', { hasText: 'Actualizar contraseña' }).click();
    await expect(page.locator('.toast.error').last()).toBeVisible();
    await expect(page.locator('.toast.error').last()).toContainText('al menos un número');
    await page.locator('.toast.error').last().click(); // Limpiar toast

    // 3.4. S16: Contraseña nueva sin letras
    await newPassInput.fill('12345678');
    await confirmPassInput.fill('12345678');
    await passwordCard.locator('button', { hasText: 'Actualizar contraseña' }).click();
    await expect(page.locator('.toast.error').last()).toBeVisible();
    await expect(page.locator('.toast.error').last()).toContainText('al menos una letra');
    await page.locator('.toast.error').last().click(); // Limpiar toast

    // 3.5. S10: Contraseña antigua incorrecta
    await currentPassInput.fill('WrongPassword');
    await newPassInput.fill('Nueva123');
    await confirmPassInput.fill('Nueva123');
    await passwordCard.locator('button', { hasText: 'Actualizar contraseña' }).click();
    await expect(page.locator('.toast.error').last()).toBeVisible();
    await expect(page.locator('.toast.error').last()).toContainText('actual es incorrecta');
    await page.locator('.toast.error').last().click(); // Limpiar toast

    // 3.6. S14: Cambiar contraseña correctamente (Nueva Longitud 16)
    await currentPassInput.fill('Actual123');
    await newPassInput.fill('NuevaPassword1234');
    await confirmPassInput.fill('NuevaPassword1234');
    await passwordCard.locator('button', { hasText: 'Actualizar contraseña' }).click();

    await expect(page.locator('.toast.success').last()).toBeVisible();
    await expect(page.locator('.toast.success').last()).toContainText('Contraseña actualizada correctamente');
  });

  // ── 4. Eliminar Cuenta (Condensa S17) ──────────────────────────────────────────
  test('debe eliminar la cuenta tras escribir CONFIRMAR y redirigir a login (S17)', async ({ page }) => {
    await page.route(url => url.pathname.endsWith('/api/profile'), async (route) => {
      if (route.request().method() === 'DELETE') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ message: 'Cuenta eliminada' }),
        });
      } else {
        await route.continue();
      }
    });

    const dangerCard = page.locator('.location-info-card', { hasText: 'Zona de Peligro' });
    await dangerCard.locator('button', { hasText: 'Eliminar cuenta permanentemente' }).click();

    const submitBtn = dangerCard.locator('button', { hasText: 'Eliminar permanentemente' });
    await expect(submitBtn).toBeDisabled();

    await dangerCard.locator('#delete-confirm-input').fill('CONFIRMAR');
    await expect(submitBtn).toBeEnabled();
    await submitBtn.click();

    await expect(page.locator('.toast.success').last()).toBeVisible();
    await expect(page.locator('.toast.success').last()).toContainText('Cuenta eliminada correctamente');
    await expect(page).toHaveURL(/\/login/, { timeout: 3000 });
  });

});
