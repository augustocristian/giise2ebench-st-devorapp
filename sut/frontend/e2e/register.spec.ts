import { test, expect, type Page } from '@playwright/test';

// Backend error text from the mock; also asserted in the UI
const PASSWORD_POLICY_ERROR = 'Password must have at least 8 characters, a letter and a digit';
const LOCATION_NAME = 'Springfield, USA';

// App-side validation messages (UI copy is Spanish)
const MSG = {
  emailRequired: 'El email es obligatorio.',
  emailInvalid: 'Introduce un email válido.',
  emailTaken: 'Este email ya está registrado.',
  usernameRequired: 'El nombre de usuario es obligatorio.',
  usernameTaken: 'Este nombre de usuario ya está en uso.',
  firstNameRequired: 'El nombre es obligatorio.',
  lastNameRequired: 'Los apellidos son obligatorios.',
  passwordRequired: 'La contraseña es obligatoria.',
  passwordTooShort: 'La contraseña debe tener al menos 8 caracteres.',
  locationRequired: 'Debe seleccionar una ubicación válida de la lista',
};

test.describe('User registration tests - condensed', () => {

  test.beforeEach(async ({ page }) => {
    // Stub the Google GSI script to avoid interference
    await page.route('**/gsi/client', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/javascript',
        body: 'console.log("Mock Google GSI client script loaded");',
      });
    });

    await page.addInitScript(() => {
      // Mock geolocation (navigator.geolocation is read-only, hence defineProperty)
      Object.defineProperty(navigator, 'geolocation', {
        value: {
          getCurrentPosition: (success: Function) => {
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

      // Speed up timers so polling flows do not take seconds
      const originalSetInterval = window.setInterval;
      (window as any).setInterval = (handler: TimerHandler, timeout?: number, ...args: any[]) => {
        if (timeout === 5000) {
          return originalSetInterval(handler, 100, ...args); // 5s -> 100ms
        }
        return originalSetInterval(handler, timeout, ...args);
      };

      const originalSetTimeout = window.setTimeout;
      (window as any).setTimeout = (handler: TimerHandler, timeout?: number, ...args: any[]) => {
        if (timeout === 2000) {
          return originalSetTimeout(handler, 50, ...args); // 2s -> 50ms
        }
        return originalSetTimeout(handler, timeout, ...args);
      };
    });

    // Mock the availability check (email and username)
    await page.route('**/api/v1/users/availability*', async (route) => {
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

    // Mock the Google Maps geocoding API (including CORS)
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
              formatted_address: LOCATION_NAME,
            }
          ]
        })
      });
    });

    // Mock the account creation endpoint
    await page.route('**/api/v1/users', async (route) => {
      if (route.request().method() !== 'POST') {
        return route.fallback();
      }
      const payload = JSON.parse(route.request().postData() || '{}');

      // Password rules enforced by the backend
      const hasLetter = /[A-Za-z]/.test(payload.password || '');
      const hasDigit = /\d/.test(payload.password || '');
      if (!hasLetter || !hasDigit) {
        await route.fulfill({
          status: 422,
          contentType: 'application/json',
          body: JSON.stringify({
            detail: PASSWORD_POLICY_ERROR,
          }),
        });
        return;
      }

      await route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify({
          message: 'Account created',
          user: {
            username: payload.username,
            email: payload.email,
            first_name: payload.first_name,
            last_name: payload.last_name,
            location: payload.location,
            is_google: false,
          },
        }),
      });
    });

    // Mock the email verification polling: unverified on the first poll so the
    // verification screen is observable, verified afterwards.
    let checkCount = 0;
    await page.route('**/api/v1/email-verification*', async (route) => {
      checkCount++;
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ verified: checkCount > 1 }),
      });
    });

    await page.goto('/register');
  });

  // Helper to fill step 1
  async function fillStep1(page: Page, data: {
    email?: string;
    username?: string;
    password?: string;
    firstName?: string;
    lastName?: string;
  }) {
    if (data.email !== undefined) {
      await page.getByTestId('register-email').fill(data.email);
    }
    if (data.username !== undefined) {
      await page.getByTestId('register-username').fill(data.username);
    }
    if (data.password !== undefined) {
      await page.getByTestId('register-password').fill(data.password);
    }
    if (data.firstName !== undefined) {
      await page.getByTestId('register-first-name').fill(data.firstName);
    }
    if (data.lastName !== undefined) {
      await page.getByTestId('register-last-name').fill(data.lastName);
    }
  }

  // ── 1. Successful registration - BASE ──
  test('should register with valid data and redirect to login (BASE)', async ({ page }) => {
    await fillStep1(page, {
      email: 'ana@test.com',
      username: 'ana_test',
      password: 'Secure123',
      firstName: 'Ana',
      lastName: 'Garcia',
    });

    await page.getByTestId('register-continue').click();

    // Step 2 is shown (step 2 is the only step wrapped in the form)
    await expect(page.getByTestId('register-form')).toBeVisible();

    await page.getByTestId('register-gps').click();
    await expect(page.getByTestId('register-location-name')).toContainText(LOCATION_NAME);

    await page.getByTestId('register-submit').click();

    await expect(page.getByTestId('register-verify-title')).toBeVisible();

    // Timers are sped up, so verification completes almost immediately and redirects to login
    await expect(page).toHaveURL(/\/login$/);
  });

  // ── 2. Identity validation in step 1 (S2, S3, S4, S5, S6) ──
  test('should validate email and username in step 1 (S2, S3, S4, S5, S6)', async ({ page }) => {
    const stepError = page.getByTestId('register-step-error');

    // 2.1. S4: empty email
    await fillStep1(page, {
      email: '',
      username: 'ana_test',
      password: 'Secure123',
      firstName: 'Ana',
      lastName: 'Garcia',
    });
    await page.getByTestId('register-continue').click();
    await expect(stepError).toContainText(MSG.emailRequired);
    await expect(page.getByTestId('register-step1')).toBeVisible();

    // 2.2. S2: invalid email
    await page.getByTestId('register-email').fill('invalidemail');
    await page.getByTestId('register-continue').click();
    await expect(stepError).toContainText(MSG.emailInvalid);

    // 2.3. S3: email already in use
    await page.getByTestId('register-email').fill('used@test.com');
    await page.getByTestId('register-continue').click();
    await expect(page.getByTestId('register-email-error')).toContainText(MSG.emailTaken);

    // 2.4. S5: empty username
    await page.getByTestId('register-email').fill('ana@test.com');
    await page.getByTestId('register-username').fill('');
    await page.getByTestId('register-continue').click();
    await expect(stepError).toContainText(MSG.usernameRequired);

    // 2.5. S6: username already in use
    await page.getByTestId('register-username').fill('useduser');
    await page.getByTestId('register-continue').click();
    await expect(page.getByTestId('register-username-error')).toContainText(MSG.usernameTaken);
  });

  // ── 3. Personal data and password validation in step 1 (S7, S8, S9, S10) ──
  test('should validate first name, last name and password in step 1 (S7, S8, S9, S10)', async ({ page }) => {
    const stepError = page.getByTestId('register-step-error');

    // Valid email and username
    await fillStep1(page, {
      email: 'ana@test.com',
      username: 'ana_test',
    });

    // 3.1. S7: empty first name
    await fillStep1(page, {
      firstName: '',
      lastName: 'Garcia',
      password: 'Secure123',
    });
    await page.getByTestId('register-continue').click();
    await expect(stepError).toContainText(MSG.firstNameRequired);

    // 3.2. S8: empty last name
    await fillStep1(page, {
      firstName: 'Ana',
      lastName: '',
    });
    await page.getByTestId('register-continue').click();
    await expect(stepError).toContainText(MSG.lastNameRequired);

    // 3.3. S9: empty password
    await fillStep1(page, {
      lastName: 'Garcia',
      password: '',
    });
    await page.getByTestId('register-continue').click();
    await expect(stepError).toContainText(MSG.passwordRequired);

    // 3.4. S10: short password (7 characters)
    await fillStep1(page, {
      password: 'Secu123',
    });
    await page.getByTestId('register-continue').click();
    await expect(stepError).toContainText(MSG.passwordTooShort);
  });

  // ── 4. Location and backend password validation in step 2 (S12, S13, S15, S16) ──
  test('should validate location and backend password policy in step 2 (S12, S13, S15, S16)', async ({ page }) => {
    const messageError = page.getByTestId('register-message-error');

    // Valid data but a password without letters (S13)
    await fillStep1(page, {
      email: 'ana@test.com',
      username: 'ana_test',
      password: '12345678',
      firstName: 'Ana',
      lastName: 'Garcia',
    });

    await page.getByTestId('register-continue').click();
    await expect(page.getByTestId('register-form')).toBeVisible();

    // 4.1. S16: empty location
    await page.getByTestId('register-submit').click();
    await expect(messageError).toContainText(MSG.locationRequired);

    // 4.2. S15: typed location not picked from the list
    await page.getByTestId('register-location').fill('Not A Valid Location');
    await page.getByTestId('register-submit').click();
    await expect(messageError).toContainText(MSG.locationRequired);

    // 4.3. S13: password without letters (backend error)
    await page.getByTestId('register-gps').click();
    await page.getByTestId('register-submit').click();
    await expect(messageError).toContainText(PASSWORD_POLICY_ERROR);

    // 4.4. S12: password without digits (backend error); back to step 1 first
    await page.getByTestId('register-back').click();
    await fillStep1(page, { password: 'PasswordNoDigits' });
    await page.getByTestId('register-continue').click();
    await page.getByTestId('register-gps').click();
    await page.getByTestId('register-submit').click();
    await expect(messageError).toContainText(PASSWORD_POLICY_ERROR);
  });

  // ── 5. Successful registration with a long password (S11) ──
  test('should register with a 16-character password (S11)', async ({ page }) => {
    await fillStep1(page, {
      email: 'ana@test.com',
      username: 'ana_test',
      password: 'Secure1234567890', // length 16
      firstName: 'Ana',
      lastName: 'Garcia',
    });

    await page.getByTestId('register-continue').click();
    await expect(page.getByTestId('register-form')).toBeVisible();

    await page.getByTestId('register-gps').click();
    await page.getByTestId('register-submit').click();

    await expect(page.getByTestId('register-verify-title')).toBeVisible();
    await expect(page).toHaveURL(/\/login$/);
  });

});
