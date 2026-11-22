import { test, expect } from '@playwright/test';

// Error text from the mocked backend; also asserted in the UI
const INVALID_CREDENTIALS = 'Invalid credentials';
// App-side validation message (UI copy is Spanish)
const FILL_ALL_FIELDS = 'Rellene todos los campos';

test.describe('Login tests - Base-Choice', () => {

  test.beforeEach(async ({ page }) => {
    // Stub the Google GSI script so it cannot overwrite the mock
    await page.route('**/gsi/client', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/javascript',
        body: 'console.log("Mock Google GSI client script loaded");',
      });
    });

    // Mock the Google Identity Services SDK before the page loads
    await page.addInitScript(() => {
      (window as any).google = {
        accounts: {
          oauth2: {
            initTokenClient: (config: any) => {
              (window as any).mockGoogleTokenClient = config;
              return {
                requestAccessToken: () => {
                  // Simulate a successful Google popup response
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

    // Mock /api/v1/me so /home does not hit the real API
    await page.route('**/api/v1/me', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          username: 'testuser',
          email: 'test@test.com',
          first_name: 'Test',
          last_name: 'User',
          location: 'Springfield',
          is_google: false,
        }),
      });
    });

    // Go to the login page
    await page.goto('/login');
  });

  // ── 1. Empty fields / identifier without password (BASE, S3, S4, S5, S6) ──
  test('should show an error and not call the API when the password is missing or both fields are empty (BASE, S3, S4, S5, S6)', async ({ page }) => {
    // Tracks whether a login request is sent
    let loginRequestCalled = false;
    await page.route('**/api/v1/sessions', async (route) => {
      loginRequestCalled = true;
      await route.fallback();
    });

    const submitBtn = page.getByTestId('login-submit');
    const alertMessage = page.getByTestId('login-message-error');

    // 1.1. BASE: existing email, empty password
    await page.getByTestId('login-identifier').fill('ana@test.com');
    await submitBtn.click();
    await expect(alertMessage).toContainText(FILL_ALL_FIELDS);

    // 1.2. S3: unknown email, empty password
    await page.getByTestId('login-identifier').fill('noexiste@test.com');
    await submitBtn.click();
    await expect(alertMessage).toContainText(FILL_ALL_FIELDS);

    // 1.3. S4: existing username, empty password
    await page.getByTestId('login-identifier').fill('testuser');
    await submitBtn.click();
    await expect(alertMessage).toContainText(FILL_ALL_FIELDS);

    // 1.4. S5: unknown username, empty password
    await page.getByTestId('login-identifier').fill('noexisteuser');
    await submitBtn.click();
    await expect(alertMessage).toContainText(FILL_ALL_FIELDS);

    // 1.5. S6: both empty
    await page.getByTestId('login-identifier').fill('');
    await submitBtn.click();
    await expect(alertMessage).toContainText(FILL_ALL_FIELDS);

    // The API must not have been called
    expect(loginRequestCalled).toBe(false);
  });

  // ── 2. Successful login (S7 - Happy Path) ──
  test('should log in with valid credentials and redirect to /home (S7 - Happy Path)', async ({ page }) => {
    // Mock the login endpoint
    await page.route('**/api/v1/sessions', async (route) => {
      await route.fulfill({
        status: 201,
        contentType: 'application/json',
        headers: {
          'Set-Cookie': 'access_token=fake_jwt_token; Path=/; HttpOnly; SameSite=Lax',
        },
        body: JSON.stringify({
          message: 'Login successful',
          user: {
            username: 'testuser',
            email: 'test@test.com',
            first_name: 'Test',
            last_name: 'User',
            location: 'Springfield',
            is_google: false,
          },
        }),
      });
    });

    await page.getByTestId('login-identifier').fill('ana@test.com');
    await page.getByTestId('login-password').fill('Segura123');
    await page.getByTestId('login-submit').click();

    // Redirects to /home
    await expect(page).toHaveURL(/\/home$/);
  });

  // ── 3. Wrong password (S8) ──
  test('should show an error when the password is wrong (S8)', async ({ page }) => {
    // Mock the login endpoint to reject the credentials
    await page.route('**/api/v1/sessions', async (route) => {
      await route.fulfill({
        status: 401,
        contentType: 'application/json',
        body: JSON.stringify({
          detail: INVALID_CREDENTIALS,
        }),
      });
    });

    await page.getByTestId('login-identifier').fill('ana@test.com');
    await page.getByTestId('login-password').fill('wrongpass');
    await page.getByTestId('login-submit').click();

    // The backend error is shown
    await expect(page.getByTestId('login-message-error')).toContainText(INVALID_CREDENTIALS);
  });

  // ── 4. Google login (S2) ──
  test('should log in with Google and redirect to /home (S2)', async ({ page }) => {
    // Mock the backend Google auth endpoint
    await page.route('**/api/v1/sessions/google', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        headers: {
          'Set-Cookie': 'access_token=fake_google_jwt_token; Path=/; HttpOnly; SameSite=Lax',
        },
        body: JSON.stringify({
          message: 'Google login successful',
          user: {
            username: 'googleuser',
            email: 'google@test.com',
            first_name: 'Google',
            last_name: 'User',
            location: 'Springfield',
            is_google: true,
          },
        }),
      });
    });

    // Click the Google login button
    await page.getByTestId('login-google').click();

    // Redirects to /home
    await expect(page).toHaveURL(/\/home$/);
  });
});
