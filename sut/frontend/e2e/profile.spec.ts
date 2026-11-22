import { test, expect } from '@playwright/test';

// Mocked session user (shared by the /api/v1/me mock and the assertions)
const USER = {
  username: 'testuser',
  email: 'test@test.com',
  first_name: 'Test',
  last_name: 'User',
  location: 'Springfield, USA',
  is_google: false,
};

const NEW_LOCATION = 'Shelbyville, USA';

// Backend error text from the mocks; the UI shows it in an error toast
const API_ERRORS = {
  wrongEmailPassword: 'Incorrect password.',
  emailTaken: 'This email is already registered.',
  wrongCurrentPassword: 'The current password is incorrect.',
  tooShort: 'The password must have at least 8 characters.',
  noDigit: 'The password must have at least one digit.',
  noLetter: 'The password must have at least one letter.',
};

test.describe('Profile tests - condensed', () => {

  test.beforeEach(async ({ page }) => {
    // Forward browser console logs for diagnostics
    page.on('console', msg => console.log('PAGE LOG:', msg.text()));

    // Stub the Google GSI script
    await page.route('**/gsi/client', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/javascript',
        body: 'console.log("Mock Google GSI client script loaded");',
      });
    });

    // Stub the Google Maps Autocomplete script
    await page.route('**/maps/api/js*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/javascript',
        body: 'console.log("Mock Google Maps script loaded");',
      });
    });

    // Global Google Maps Autocomplete mock
    await page.addInitScript((fallbackPlace: string) => {
      (window as any).google = {
        maps: {
          places: {
            Autocomplete: class {
              listeners: Record<string, Function[]> = {};
              input: HTMLInputElement;
              constructor(input: HTMLInputElement) {
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
                  formatted_address: this.input ? this.input.value : fallbackPlace,
                };
              }
              setTypes() {}
              setBounds() {}
              setFields() {}
              setComponentRestrictions() {}
              getBounds() { return {}; }
              getFields() { return []; }
              setOptions() {}
            }
          }
        }
      };
    }, NEW_LOCATION);

    // Mock /api/v1/me: logged-in traditional (non-Google) user
    await page.route('**/api/v1/me', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(USER),
      });
    });

    await page.goto('/profile');
  });

  // ── 1. Initial profile load (BASE) ──
  test('should load the user profile information correctly (BASE)', async ({ page }) => {
    const personalCard = page.getByTestId('profile-card-personal');
    const locationCard = page.getByTestId('profile-card-location');

    await expect(personalCard).toContainText(USER.first_name);
    await expect(personalCard).toContainText(USER.last_name);
    await expect(locationCard).toContainText(USER.location);
  });

  // ── 2. Personal information and location (S2, S3, S4, Case 2, 18) ──
  test('should manage personal information and preferred location (S2, S3, S4, Case 2, 18)', async ({ page }) => {
    const personalCard = page.getByTestId('profile-card-personal');
    const locationCard = page.getByTestId('profile-card-location');

    // 2.1. Case 2: cancel personal edit
    await page.getByTestId('profile-personal-edit').click();
    await page.getByTestId('profile-personal-first-name').fill('EditedFirst');
    await page.getByTestId('profile-personal-last-name').fill('EditedLast');
    await page.getByTestId('profile-personal-cancel').click();
    await expect(personalCard).toContainText(USER.first_name);
    await expect(personalCard).toContainText(USER.last_name);

    // Mock the profile update for the success flows
    await page.route(url => url.pathname.endsWith('/api/v1/profile'), async (route) => {
      if (route.request().method() === 'PATCH') {
        const payload = JSON.parse(route.request().postData() || '{}');
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            user: {
              ...USER,
              first_name: payload.first_name || USER.first_name,
              last_name: payload.last_name || USER.last_name,
              location: payload.location || USER.location,
            }
          }),
        });
      } else {
        await route.continue();
      }
    });

    // 2.2. S2 & S3: edit first and last name successfully
    await page.getByTestId('profile-personal-edit').click();
    await page.getByTestId('profile-personal-first-name').fill('John');
    await page.getByTestId('profile-personal-last-name').fill('Doe');
    await page.getByTestId('profile-personal-save').click();

    await expect(page.getByTestId('toast-success').last()).toBeVisible();
    await expect(personalCard).toContainText('John');
    await expect(personalCard).toContainText('Doe');

    // Dismiss the success toast to avoid overlap
    await page.getByTestId('toast-success').last().click();

    // 2.3. Case 18 (location: typed, not selected): free text without picking from the list
    await page.getByTestId('profile-location-edit').click();
    const autocompleteInput = page.getByTestId('profile-location-input');
    await autocompleteInput.fill('aifgauif');
    await page.getByTestId('profile-location-save').click();

    await expect(page.getByTestId('profile-location-error')).toBeVisible();

    // 2.4. S4: edit the location by selecting from the list
    await autocompleteInput.fill(NEW_LOCATION);

    // Wait for the autocomplete instance and fire its 'place_changed' event
    await page.waitForFunction(() => (window as any).mockAutocompleteInstance !== undefined);
    await page.evaluate(() => {
      const instance = (window as any).mockAutocompleteInstance;
      if (instance && instance.listeners['place_changed']) {
        instance.listeners['place_changed'].forEach((cb: Function) => cb());
      }
    });

    await page.getByTestId('profile-location-save').click();

    await expect(page.getByTestId('toast-success').last()).toBeVisible();
    await expect(locationCard).toContainText(NEW_LOCATION);
  });

  // ── 3. Email management (S5, S6, S7, S8, S9, Case 3) ──
  test('should validate and allow changing the email', async ({ page }) => {
    // Mock the email update; the response depends on the payload
    await page.route('**/api/v1/profile/email', async (route) => {
      if (route.request().method() === 'PATCH') {
        const payload = JSON.parse(route.request().postData() || '{}');

        if (payload.password === 'WrongPassword') {
          await route.fulfill({
            status: 401,
            contentType: 'application/json',
            body: JSON.stringify({ detail: API_ERRORS.wrongEmailPassword }),
          });
        } else if (payload.new_email === 'used@test.com') {
          await route.fulfill({
            status: 409,
            contentType: 'application/json',
            body: JSON.stringify({ detail: API_ERRORS.emailTaken }),
          });
        } else {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({ message: 'Confirmation sent' }),
          });
        }
      } else {
        await route.continue();
      }
    });

    const emailCard = page.getByTestId('profile-card-email');
    await page.getByTestId('profile-email-edit').click();

    // 3.1. S7 & S9: required fields
    const emailInput = page.getByTestId('profile-email-input');
    const passInput = page.getByTestId('profile-email-password');
    await expect(emailInput).toHaveAttribute('required', '');
    await expect(passInput).toHaveAttribute('required', '');

    // 3.2. S5: invalid email format
    await emailInput.fill('invalidemail');
    await passInput.fill('Password123');
    await page.getByTestId('profile-email-submit').click();

    const isInvalid = await emailInput.evaluate((el: HTMLInputElement) => !el.checkValidity());
    expect(isInvalid).toBe(true);
    await expect(page.getByTestId('profile-email-cancel')).toBeVisible();

    // 3.3. S8: wrong password
    await emailInput.fill('new@example.com');
    await passInput.fill('WrongPassword');
    await page.getByTestId('profile-email-submit').click();
    await expect(page.getByTestId('toast-error').last()).toBeVisible();
    await expect(page.getByTestId('toast-error').last()).toContainText(API_ERRORS.wrongEmailPassword);
    await page.getByTestId('toast-error').last().click(); // Dismiss toast

    // 3.4. S6: email already in use
    await emailInput.fill('used@test.com');
    await passInput.fill('Password123');
    await page.getByTestId('profile-email-submit').click();
    await expect(page.getByTestId('toast-error').last()).toBeVisible();
    await expect(page.getByTestId('toast-error').last()).toContainText(API_ERRORS.emailTaken);
    await page.getByTestId('toast-error').last().click(); // Dismiss toast

    // 3.5. Case 3: change the email successfully (happy path)
    await emailInput.fill('new@example.com');
    await passInput.fill('Password123');
    await page.getByTestId('profile-email-submit').click();

    await expect(page.getByTestId('toast-success').last()).toBeVisible();
    // The card still shows the original email until the change is confirmed
    await expect(emailCard).toContainText(USER.email);
  });

  // ── 4. Security / password (S10, S11, S12, S13, S14, S15, S16) ──
  test('should validate and allow changing the password', async ({ page }) => {
    // Mock the password update; the response depends on the payload
    await page.route('**/api/v1/profile/password', async (route) => {
      if (route.request().method() === 'PATCH') {
        const payload = JSON.parse(route.request().postData() || '{}');

        if (payload.old_password === 'WrongPassword') {
          await route.fulfill({
            status: 422,
            contentType: 'application/json',
            body: JSON.stringify({ detail: API_ERRORS.wrongCurrentPassword }),
          });
        } else if (payload.new_password === 'Short1') {
          await route.fulfill({
            status: 422,
            contentType: 'application/json',
            body: JSON.stringify({ detail: API_ERRORS.tooShort }),
          });
        } else if (payload.new_password === 'NewPasswordNoDigits') {
          await route.fulfill({
            status: 422,
            contentType: 'application/json',
            body: JSON.stringify({ detail: API_ERRORS.noDigit }),
          });
        } else if (payload.new_password === '12345678') {
          await route.fulfill({
            status: 422,
            contentType: 'application/json',
            body: JSON.stringify({ detail: API_ERRORS.noLetter }),
          });
        } else {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({ message: 'Password updated' }),
          });
        }
      } else {
        await route.continue();
      }
    });

    await page.getByTestId('profile-security-edit').click();

    const currentPassInput = page.getByTestId('profile-security-current');
    const newPassInput = page.getByTestId('profile-security-new');
    const confirmPassInput = page.getByTestId('profile-security-confirm');
    const submitBtn = page.getByTestId('profile-security-submit');
    const errorToast = page.getByTestId('toast-error').last();

    // 4.1. S11 & S12: required fields
    await expect(currentPassInput).toHaveAttribute('required', '');
    await expect(newPassInput).toHaveAttribute('required', '');

    // 4.2. S13: new password too short
    await currentPassInput.fill('Current123');
    await newPassInput.fill('Short1');
    await confirmPassInput.fill('Short1');
    await submitBtn.click();
    await expect(errorToast).toBeVisible();
    await expect(errorToast).toContainText(API_ERRORS.tooShort);
    await errorToast.click(); // Dismiss toast

    // 4.3. S15: new password without digits
    await newPassInput.fill('NewPasswordNoDigits');
    await confirmPassInput.fill('NewPasswordNoDigits');
    await submitBtn.click();
    await expect(errorToast).toBeVisible();
    await expect(errorToast).toContainText(API_ERRORS.noDigit);
    await errorToast.click(); // Dismiss toast

    // 4.4. S16: new password without letters
    await newPassInput.fill('12345678');
    await confirmPassInput.fill('12345678');
    await submitBtn.click();
    await expect(errorToast).toBeVisible();
    await expect(errorToast).toContainText(API_ERRORS.noLetter);
    await errorToast.click(); // Dismiss toast

    // 4.5. S10: wrong current password
    await currentPassInput.fill('WrongPassword');
    await newPassInput.fill('New12345');
    await confirmPassInput.fill('New12345');
    await submitBtn.click();
    await expect(errorToast).toBeVisible();
    await expect(errorToast).toContainText(API_ERRORS.wrongCurrentPassword);
    await errorToast.click(); // Dismiss toast

    // 4.6. S14: change the password successfully (new length 17)
    await currentPassInput.fill('Current123');
    await newPassInput.fill('NewPassword123456');
    await confirmPassInput.fill('NewPassword123456');
    await submitBtn.click();

    await expect(page.getByTestId('toast-success').last()).toBeVisible();
  });

  // ── 5. Delete account (S17) ──
  test('should delete the account after typing the confirmation word and redirect to login (S17)', async ({ page }) => {
    await page.route(url => url.pathname.endsWith('/api/v1/profile'), async (route) => {
      if (route.request().method() === 'DELETE') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ message: 'Account deleted' }),
        });
      } else {
        await route.continue();
      }
    });

    await page.getByTestId('profile-danger-open').click();

    const submitBtn = page.getByTestId('profile-danger-submit');
    await expect(submitBtn).toBeDisabled();

    // The confirmation word is part of the app copy (UI is Spanish)
    await page.getByTestId('profile-danger-confirm-input').fill('CONFIRMAR');
    await expect(submitBtn).toBeEnabled();
    await submitBtn.click();

    await expect(page.getByTestId('toast-success').last()).toBeVisible();
    await expect(page).toHaveURL(/\/login/, { timeout: 3000 });
  });

});
