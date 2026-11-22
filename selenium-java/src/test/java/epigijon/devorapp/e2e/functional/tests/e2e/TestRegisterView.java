package epigijon.devorapp.e2e.functional.tests.e2e;

import epigijon.devorapp.e2e.functional.common.BaseLoggedClass;
import epigijon.devorapp.e2e.functional.pages.RegisterPage;
import org.junit.jupiter.api.Assertions;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.openqa.selenium.support.ui.WebDriverWait;

import java.time.Duration;

/** Browser tests for the registration flow (BASE, S2-S16). */
class TestRegisterView extends BaseLoggedClass {

    private static final String BASE_PASSWORD  = "Segura123";
    private static final String BASE_FIRST_NAME    = "Ana";
    private static final String BASE_LAST_NAME = "García";

    @org.junit.jupiter.api.BeforeAll
    static void prepareDuplicateUser() throws Exception {
        setupTestUser("dupuser" + (System.currentTimeMillis() % 100000),
                      "dup.email." + System.currentTimeMillis() + "@devorapp.test",
                      BASE_PASSWORD);
    }

    @org.junit.jupiter.api.AfterAll
    static void cleanupTestUser() {
        tearDownTestUser();
    }

    private void fillStep1(RegisterPage reg, String email, String username,
                           String password, String firstName, String lastName) {
        reg.enterEmail(email)
           .enterUsername(username)
           .enterPassword(password)
           .enterFirstName(firstName)
           .enterLastName(lastName);
    }

    private String getErrorMessageWithWait(RegisterPage reg) {
        new WebDriverWait(driver, Duration.ofSeconds(5))
                .until(d -> !reg.getErrorMessage().isEmpty());
        return reg.getErrorMessage();
    }

    // BASE

    @Test
    @DisplayName("Registers with valid data and shows the verify-email screen (BASE)")
    void testSuccessfulRegistrationBase() throws Exception {
        driver.get(sutUrl + "/register");
        RegisterPage reg = new RegisterPage(driver, waiter);

        long ts = System.currentTimeMillis();
        String email = "regbase" + ts + "@devorapp.test";
        String password = BASE_PASSWORD;
        registerEmailForCleanup(email, password);

        fillStep1(reg,
                email,
                "regbase" + (ts % 100000),
                password, BASE_FIRST_NAME, BASE_LAST_NAME);
        injectAutocompleteMock(); // before step 2 mounts so the component finds window.google
        reg.clickContinue().waitForStep2();

        Assertions.assertTrue(reg.isOnStep2(), "Must advance to step 2");

        reg.enterLocation("Madrid, España");

        triggerAutocompletePlaceChanged();

        reg.clickSubmit();

        new WebDriverWait(driver, Duration.ofSeconds(10))
                .until(d -> reg.isVerifyEmailVisible());
        Assertions.assertTrue(reg.isVerifyEmailVisible(), "Verification screen must be shown");
    }

    // S2-S10: step 1 validations

    @Test
    @DisplayName("Validates all required fields in step 1 (S2-S10)")
    void testStep1Validations() throws Exception {
        long ts = System.currentTimeMillis();
        String validEmail    = "valid" + ts + "@devorapp.test";
        String validUsername = "valid" + (ts % 100000);

        // S4: empty email
        driver.get(sutUrl + "/register");
        RegisterPage reg = new RegisterPage(driver, waiter);
        fillStep1(reg, "", validUsername, BASE_PASSWORD, BASE_FIRST_NAME, BASE_LAST_NAME);
        reg.clickContinue();
        Assertions.assertTrue(reg.isOnStep1(), "S4: must stay on step 1");
        String errS4 = getErrorMessageWithWait(reg);
        Assertions.assertTrue(errS4.contains("email") ||
                              errS4.contains("obligatorio"), "S4: email error");

        // S2: invalid email
        driver.get(sutUrl + "/register");
        reg = new RegisterPage(driver, waiter);
        fillStep1(reg, "correosinformato", validUsername, BASE_PASSWORD, BASE_FIRST_NAME, BASE_LAST_NAME);
        reg.clickContinue();
        Assertions.assertTrue(reg.isOnStep1(), "S2: must stay on step 1");
        String errS2 = getErrorMessageWithWait(reg);
        Assertions.assertTrue(errS2.contains("email") ||
                              errS2.contains("válido"), "S2: invalid email error");

        // S3: email already in use
        driver.get(sutUrl + "/register");
        reg = new RegisterPage(driver, waiter);
        fillStep1(reg, testEmail, validUsername, BASE_PASSWORD, BASE_FIRST_NAME, BASE_LAST_NAME);
        reg.clickContinue();
        RegisterPage finalReg1 = reg;
        new WebDriverWait(driver, Duration.ofSeconds(5))
                .until(d -> !finalReg1.getEmailError().isEmpty());
        Assertions.assertTrue(reg.getEmailError().contains("registrado"), "S3: email in use error");

        // S5: empty username
        driver.get(sutUrl + "/register");
        reg = new RegisterPage(driver, waiter);
        fillStep1(reg, validEmail, "", BASE_PASSWORD, BASE_FIRST_NAME, BASE_LAST_NAME);
        reg.clickContinue();
        Assertions.assertTrue(reg.isOnStep1(), "S5: must stay on step 1");
        String errS5 = getErrorMessageWithWait(reg);
        Assertions.assertTrue(errS5.contains("usuario") ||
                              errS5.contains("obligatorio"), "S5: username error");

        // S6: username already in use
        driver.get(sutUrl + "/register");
        reg = new RegisterPage(driver, waiter);
        fillStep1(reg, validEmail, testUsername, BASE_PASSWORD, BASE_FIRST_NAME, BASE_LAST_NAME);
        reg.clickContinue();
        RegisterPage finalReg2 = reg;
        new WebDriverWait(driver, Duration.ofSeconds(5))
                .until(d -> !finalReg2.getUsernameError().isEmpty());
        Assertions.assertTrue(reg.getUsernameError().contains("uso"), "S6: username in use error");

        // S7: empty first name
        driver.get(sutUrl + "/register");
        reg = new RegisterPage(driver, waiter);
        fillStep1(reg, validEmail, validUsername, BASE_PASSWORD, "", BASE_LAST_NAME);
        reg.clickContinue();
        Assertions.assertTrue(reg.isOnStep1(), "S7: must stay on step 1");
        String errS7 = getErrorMessageWithWait(reg);
        Assertions.assertTrue(errS7.contains("nombre"), "S7: first name error");

        // S8: empty last name
        driver.get(sutUrl + "/register");
        reg = new RegisterPage(driver, waiter);
        fillStep1(reg, validEmail, validUsername, BASE_PASSWORD, BASE_FIRST_NAME, "");
        reg.clickContinue();
        Assertions.assertTrue(reg.isOnStep1(), "S8: must stay on step 1");
        // Wording varies; only require that some error is shown
        String errS8 = getErrorMessageWithWait(reg);
        Assertions.assertFalse(errS8.isEmpty(), "S8: last name error must be shown");

        // S9: empty password
        driver.get(sutUrl + "/register");
        reg = new RegisterPage(driver, waiter);
        fillStep1(reg, validEmail, validUsername, "", BASE_FIRST_NAME, BASE_LAST_NAME);
        reg.clickContinue();
        Assertions.assertTrue(reg.isOnStep1(), "S9: must stay on step 1");
        String errS9 = getErrorMessageWithWait(reg);
        Assertions.assertTrue(errS9.contains("contraseña") ||
                              errS9.contains("obligatoria"), "S9: password empty error");

        // S10: short password (6 chars)
        driver.get(sutUrl + "/register");
        reg = new RegisterPage(driver, waiter);
        fillStep1(reg, validEmail, validUsername, "Seg123", BASE_FIRST_NAME, BASE_LAST_NAME);
        reg.clickContinue();
        Assertions.assertTrue(reg.isOnStep1(), "S10: must stay on step 1");
        String errS10 = getErrorMessageWithWait(reg);
        Assertions.assertTrue(errS10.contains("8") ||
                              errS10.contains("caracteres"), "S10: short password error");
    }

    // S11-S16: step 2 validations and long password

    @Test
    @DisplayName("Validates location (S15, S16), backend password policy (S12, S13) and registers with a long password (S11)")
    void testStep2ValidationsAndLongPassword() throws Exception {
        long ts = System.currentTimeMillis();

        // S16: empty location
        driver.get(sutUrl + "/register");
        RegisterPage reg = new RegisterPage(driver, waiter);
        fillStep1(reg, "regloc1" + ts + "@devorapp.test", "reglocone" + (ts % 10000), "12345678", BASE_FIRST_NAME, BASE_LAST_NAME);
        reg.clickContinue().waitForStep2();
        reg.clickSubmit();
        Assertions.assertTrue(reg.isOnStep2(), "S16: must stay on step 2");
        String errS16 = getErrorMessageWithWait(reg);
        Assertions.assertTrue(errS16.contains("ubicación") ||
                              errS16.contains("lista"), "S16: location empty error");

        // S15: manually typed location, not picked from the list
        driver.get(sutUrl + "/register");
        reg = new RegisterPage(driver, waiter);
        fillStep1(reg, "regloc2" + ts + "@devorapp.test", "regloctwo" + (ts % 10000), "12345678", BASE_FIRST_NAME, BASE_LAST_NAME);
        reg.clickContinue().waitForStep2();
        reg.enterLocation("Ubicación No Válida");
        reg.clickSubmit();
        Assertions.assertTrue(reg.isOnStep2(), "S15: must stay on step 2");
        String errS15 = getErrorMessageWithWait(reg);
        Assertions.assertTrue(errS15.contains("ubicación") ||
                              errS15.contains("lista"), "S15: manual location error");

        // S13: password without letters (backend error)
        driver.get(sutUrl + "/register");
        reg = new RegisterPage(driver, waiter);
        fillStep1(reg, "regloc3" + ts + "@devorapp.test", "reglocthree" + (ts % 10000), "12345678", BASE_FIRST_NAME, BASE_LAST_NAME);
        injectAutocompleteMock(); // before step 2 mounts so the component finds window.google
        reg.clickContinue().waitForStep2();
        reg.enterLocation("Gijón, España");
        triggerAutocompletePlaceChanged();
        reg.clickSubmit();
        String errS13 = getErrorMessageWithWait(reg);
        Assertions.assertTrue(errS13.toLowerCase().contains("letra") ||
                              errS13.toLowerCase().contains("contraseña") ||
                              errS13.toLowerCase().contains("password"),
                "S13: no-letter password backend error");

        // S12: password without numbers (backend error)
        driver.get(sutUrl + "/register");
        reg = new RegisterPage(driver, waiter);
        fillStep1(reg, "regloc4" + ts + "@devorapp.test", "reglocfour" + (ts % 10000), "PasswordNoNum", BASE_FIRST_NAME, BASE_LAST_NAME);
        injectAutocompleteMock(); // before step 2 mounts so the component finds window.google
        reg.clickContinue().waitForStep2();
        reg.enterLocation("Gijón, España");
        triggerAutocompletePlaceChanged();
        reg.clickSubmit();
        String errS12 = getErrorMessageWithWait(reg);
        Assertions.assertTrue(errS12.toLowerCase().contains("número") ||
                              errS12.toLowerCase().contains("number") ||
                              errS12.toLowerCase().contains("contraseña") ||
                              errS12.toLowerCase().contains("password"),
                "S12: no-number password backend error");

        // S11: successful registration with a long password (16 chars)
        driver.get(sutUrl + "/register");
        reg = new RegisterPage(driver, waiter);
        long ts2 = System.currentTimeMillis();
        String emailS11 = "reglong" + ts2 + "@devorapp.test";
        String passwordS11 = "Segura1234567890";
        registerEmailForCleanup(emailS11, passwordS11);

        fillStep1(reg,
                emailS11,
                "reglong" + (ts2 % 100000),
                passwordS11, BASE_FIRST_NAME, BASE_LAST_NAME);
        injectAutocompleteMock(); // before step 2 mounts so the component finds window.google
        reg.clickContinue().waitForStep2();

        Assertions.assertTrue(reg.isOnStep2(), "S11: must advance to step 2");

        reg.enterLocation("Madrid, España");
        triggerAutocompletePlaceChanged();
        reg.clickSubmit();

        final RegisterPage finalRegS11 = reg;
        new WebDriverWait(driver, Duration.ofSeconds(10))
                .until(d -> finalRegS11.isVerifyEmailVisible());
        Assertions.assertTrue(reg.isVerifyEmailVisible(), "S11: verification screen must be shown");
    }
}