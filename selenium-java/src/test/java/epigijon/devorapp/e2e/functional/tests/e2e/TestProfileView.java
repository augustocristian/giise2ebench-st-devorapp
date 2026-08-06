package epigijon.devorapp.e2e.functional.tests.e2e;

import epigijon.devorapp.e2e.functional.common.BaseLoggedClass;
import epigijon.devorapp.e2e.functional.pages.LoginPage;
import epigijon.devorapp.e2e.functional.pages.ProfilePage;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.Assertions;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.openqa.selenium.By;
import org.openqa.selenium.JavascriptExecutor;
import org.openqa.selenium.WebElement;
import org.openqa.selenium.support.ui.ExpectedConditions;
import org.openqa.selenium.support.ui.WebDriverWait;

import java.time.Duration;

/**
 * Browser tests for the DevorApp profile page ({@code /profile}).
 *
 * <p>Adapts {@code profile.spec.ts} (Playwright) to Selenium + JUnit 5.
 *
 * <p>Base-Choice coverage:
 * <ul>
 *   <li>BASE — profile data loads correctly and invalid location update is validated (Ubicación = Mal).</li>
 *   <li>S2–S4 — save personal info (Nombre = Si, Apellidos = Si) and valid location update (Ubicación = Bien).</li>
 *   <li>S5–S9 — email change validations and happy path.</li>
 *   <li>S10–S16 — password change validations and happy path.</li>
 *   <li>S17 — account deletion.</li>
 * </ul>
 */
class TestProfileView extends BaseLoggedClass {

    @BeforeAll
    static void createTestUser() throws Exception {
        long ts = System.currentTimeMillis();
        setupTestUser("profui" + (ts % 100000), "profui" + ts + "@devorapp.test", "Test1234!");
    }

    @AfterAll
    static void cleanupTestUser() {
        tearDownTestUser();
    }

    private void clearSessionAndLogin() {
        clearSession();
        driver.get(sutUrl + "/login");
    }

    /** Logs in and navigates to /profile. */
    private ProfilePage loginAndGoToProfile(String email, String password) throws Exception {
        clearSessionAndLogin();
        new LoginPage(driver, waiter)
                .enterIdentifier(email)
                .enterPassword(password)
                .submitLogin();
        driver.get(sutUrl + "/profile");
        ProfilePage page = new ProfilePage(driver, waiter);
        waiter.waitUntil(ExpectedConditions.textToBePresentInElementLocated(
                By.cssSelector(".location-info-card"), "UITester"), "Profile did not load");
        return page;
    }

    // ── 1. Carga inicial + Gestión de Información Personal y Ubicación (BASE, S2–S4) ───

    @Test
    @DisplayName("BASE, S2, S3, S4 — el perfil permite cargar y gestionar la información personal y la ubicación")
    void testCargarYGestionarInformacionPersonalYUbicacion() throws Exception {
        // Register a dedicated user to avoid cross-test pollution when mutating profile data
        long ts = System.currentTimeMillis();
        String localEmail    = "personalui" + ts + "@devorapp.test";
        String localUsername = "personalui" + (ts % 100000);
        String localPassword = "Test1234!";
        registerUserApi(localUsername, localEmail, localPassword);

        ProfilePage page = loginAndGoToProfile(localEmail, localPassword);

        // BASE: data is present
        String personalCardText = page.getCardText("Información Personal");
        String locationCardText = page.getCardText("Ubicación Preferida");
        Assertions.assertTrue(personalCardText.contains("UITester"), "BASE: personal card must contain name");
        Assertions.assertTrue(personalCardText.contains("Test"),     "BASE: personal card must contain surname");
        Assertions.assertTrue(locationCardText.contains("Gijón"),    "BASE: location card must contain preferred location");

        injectAutocompleteMock();

        // Cancel personal edit restores original values
        page.editPersonalInfo()
                .fillInputInCard("Información Personal", 0, "JuanModificado")
                .fillInputInCard("Información Personal", 1, "PérezModificado")
                .cancelPersonalInfo();
        Assertions.assertTrue(page.getCardText("Información Personal").contains("UITester"),
                "Cancel must restore original name");

        // S2 & S3: Save updated nombre/apellidos
        page.editPersonalInfo()
                .fillInputInCard("Información Personal", 0, "Juan")
                .fillInputInCard("Información Personal", 1, "Pérez")
                .savePersonalInfo();
        waiter.waitForToast("success");
        Assertions.assertTrue(page.hasSuccessToast(), "S2/S3: success toast must appear");
        page.dismissSuccessToast();
        personalCardText = page.getCardText("Información Personal");
        Assertions.assertTrue(personalCardText.contains("Juan"),  "S2: card must contain updated name");
        Assertions.assertTrue(personalCardText.contains("Pérez"), "S3: card must contain updated surname");

        // BASE: Type location manually without selecting → error (Ubicación = Mal)
        page.clickButtonInCard("Ubicación Preferida", "Cambiar")
                .fillInputInCard("Ubicación Preferida", 0, "aifgauif")
                .clickButtonInCard("Ubicación Preferida", "Guardar cambios");
        Assertions.assertTrue(page.getCardText("Ubicación Preferida").contains("Debes seleccionar una ubicación válida"),
                "BASE: manual-typed location must show inline error");

        // S4: Select location from autocomplete list (Ubicación = Bien)
        page.fillInputInCard("Ubicación Preferida", 0, "Barcelona, España");
        triggerAutocompletePlaceChanged();
        page.clickButtonInCard("Ubicación Preferida", "Guardar cambios");
        waiter.waitForToast("success");
        Assertions.assertTrue(page.hasSuccessToast(), "S4: success toast must appear after updating location");
        new WebDriverWait(driver, Duration.ofSeconds(10))
                .until(ExpectedConditions.textToBePresentInElementLocated(
                        By.xpath("//div[contains(@class,'location-info-card') and contains(.,'Ubicación Preferida')]"),
                        "Barcelona, España"));
    }

    // ── 2. Gestión de Correo y Contraseña (S5–S16) ──────────────────────────

    @Test
    @DisplayName("S5 a S16 — validación y cambio de correo electrónico y contraseña")
    void testGestionarCorreoYContrasena() throws Exception {
        long ts = System.currentTimeMillis();

        // ── Email section ───────────────────────────────────────────────────────────
        String emailUserEmail    = "tempemail" + ts + "@devorapp.test";
        String emailUserUsername = "tempemail" + (ts % 100000);
        String emailUserPassword = "Password123!";
        registerUserApi(emailUserUsername, emailUserEmail, emailUserPassword);

        ProfilePage page = loginAndGoToProfile(emailUserEmail, emailUserPassword);
        page.openEmailChange();

        // S7 & S9: required attributes
        WebElement emailInput = driver.findElement(By.cssSelector("input[type='email']"));
        WebElement passInput  = driver.findElement(By.id("email-password-input"));
        Assertions.assertEquals("true", emailInput.getAttribute("required"), "S7: email must be required");
        Assertions.assertEquals("true", passInput.getAttribute("required"),  "S9: password must be required");

        // S5: invalid email format (HTML5 validation)
        page.fillNewEmail("invalidemail").fillEmailPassword(emailUserPassword).submitEmailChange();
        Boolean isInvalid = (Boolean) ((JavascriptExecutor) driver).executeScript(
                "return !arguments[0].checkValidity();", emailInput);
        Assertions.assertTrue(isInvalid, "S5: HTML5 validity must fail for invalid email format");

        // S8: wrong password
        page.fillNewEmail("nuevo" + ts + "@correo.com").fillEmailPassword("WrongPassword!").submitEmailChange();
        waiter.waitForToast("error");
        Assertions.assertTrue(page.hasErrorToast(), "S8: error toast must appear for wrong password");
        page.dismissErrorToast();

        // S6: email already in use
        page.fillNewEmail(testEmail).fillEmailPassword(emailUserPassword).submitEmailChange();
        waiter.waitForToast("error");
        Assertions.assertTrue(page.hasErrorToast(), "S6: error toast must appear for email in use");
        page.dismissErrorToast();

        // Happy path: successful email change
        String newEmail = "newtempemail" + ts + "@devorapp.test";
        page.fillNewEmail(newEmail).fillEmailPassword(emailUserPassword).submitEmailChange();
        waiter.waitForToast("success");
        Assertions.assertTrue(page.hasSuccessToast(), "Success toast must appear");
        Assertions.assertTrue(page.getSuccessToastText().contains("confirmación"),
                "Toast must mention confirmation");
        Assertions.assertTrue(page.getCardText("Correo Electrónico").contains(emailUserEmail),
                "Card must still display original email");

        // ── Password section ────────────────────────────────────────────────────────
        long ts2 = System.currentTimeMillis();
        String passUserEmail    = "temppass" + ts2 + "@devorapp.test";
        String passUserUsername = "temppass" + (ts2 % 100000);
        String passUserPassword = "Password123!";
        registerUserApi(passUserUsername, passUserEmail, passUserPassword);

        page = loginAndGoToProfile(passUserEmail, passUserPassword);
        page.openPasswordChange();

        // S11 & S12: required attributes
        WebElement currentPassInput = driver.findElement(By.id("current-password-input"));
        WebElement newPassInput     = driver.findElement(By.id("new-password-input"));
        Assertions.assertEquals("true", currentPassInput.getAttribute("required"), "S11: current pass must be required");
        Assertions.assertEquals("true", newPassInput.getAttribute("required"),     "S12: new pass must be required");

        // S13: password too short (7 chars)
        page.fillPasswordChange(passUserPassword, "Short1!", "Short1!").submitPasswordChange();
        waiter.waitForToast("error");
        Assertions.assertTrue(page.hasErrorToast(), "S13: error toast for short password");
        Assertions.assertTrue(page.getErrorToastText().contains("8") ||
                              page.getErrorToastText().toLowerCase().contains("caracteres"), "S13: message content");
        page.dismissErrorToast();

        // S15: no numbers in new password
        page.fillPasswordChange(passUserPassword, "OnlyLettersPassword", "OnlyLettersPassword").submitPasswordChange();
        waiter.waitForToast("error");
        Assertions.assertTrue(page.hasErrorToast(), "S15: error toast for no-number password");
        page.dismissErrorToast();

        // S16: no letters in new password
        page.fillPasswordChange(passUserPassword, "1234567890", "1234567890").submitPasswordChange();
        waiter.waitForToast("error");
        Assertions.assertTrue(page.hasErrorToast(), "S16: error toast for no-letter password");
        page.dismissErrorToast();

        // S10: wrong old password
        page.fillPasswordChange("WrongPassword!", "NewPassword123!", "NewPassword123!").submitPasswordChange();
        waiter.waitForToast("error");
        Assertions.assertTrue(page.hasErrorToast(), "S10: error toast for wrong old password");
        page.dismissErrorToast();

        // S14: successful password change (16-char new password)
        page.fillPasswordChange(passUserPassword, "NewPassword12345!", "NewPassword12345!").submitPasswordChange();
        waiter.waitForToast("success");
        Assertions.assertTrue(page.hasSuccessToast(), "S14: success toast must appear");
    }

    // ── 3. Eliminar Cuenta (S17) ──────────────────────────────────────────────────────

    @Test
    @DisplayName("S17 — eliminación de cuenta tras validación de confirmación")
    void testEliminarCuenta() throws Exception {
        long ts = System.currentTimeMillis();
        String delEmail    = "delui" + ts + "@devorapp.test";
        String delUsername = "delui" + (ts % 100000);
        String delPassword = "Delete1234!";

        registerUserApi(delUsername, delEmail, delPassword);

        ProfilePage page = loginAndGoToProfile(delEmail, delPassword);
        page.openDeleteAccount();

        Assertions.assertFalse(page.isDeleteButtonEnabled(),
                "Delete button must be disabled before typing confirm phrase");

        page.fillDeleteConfirm("NO_CONFIRMAR");
        Assertions.assertFalse(page.isDeleteButtonEnabled(),
                "Delete button must remain disabled with incorrect phrase");

        page.fillDeleteConfirm("CONFIRMAR");
        Assertions.assertTrue(page.isDeleteButtonEnabled(),
                "Delete button must be enabled with CONFIRMAR");

        page.submitDeleteAccount();
        waiter.waitForToast("success");

        Assertions.assertAll(
                () -> Assertions.assertTrue(page.hasSuccessToast(),
                        "A success toast must appear after account deletion"),
                () -> {
                    new WebDriverWait(driver, Duration.ofSeconds(5))
                            .until(ExpectedConditions.urlContains("/login"));
                    Assertions.assertTrue(driver.getCurrentUrl().contains("/login"),
                            "After deletion the user must be redirected to /login");
                }
        );
    }
}