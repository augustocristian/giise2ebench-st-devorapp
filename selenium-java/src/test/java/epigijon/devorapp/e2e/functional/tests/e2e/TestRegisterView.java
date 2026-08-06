package epigijon.devorapp.e2e.functional.tests.e2e;

import epigijon.devorapp.e2e.functional.common.BaseLoggedClass;
import epigijon.devorapp.e2e.functional.pages.RegisterPage;
import org.junit.jupiter.api.Assertions;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.openqa.selenium.support.ui.WebDriverWait;

import java.time.Duration;

/**
 * Browser tests for the DevorApp registration flow.
 *
 * <p>Base-Choice coverage:
 * <ul>
 *   <li>BASE — successful registration with valid 9-char password (S7 happy path).</li>
 *   <li>S2–S10 — step-1 field validations (email, username, nombre, apellidos, password).</li>
 *   <li>S11–S16 — step-2 validations (location required, backend password policy: no-letter, no-number)
 *       plus successful registration with a 16-character password.</li>
 * </ul>
 */
class TestRegisterView extends BaseLoggedClass {

    private static final String BASE_PASSWORD  = "Segura123";
    private static final String BASE_NOMBRE    = "Ana";
    private static final String BASE_APELLIDOS = "García";

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
                           String password, String nombre, String apellidos) {
        reg.enterEmail(email)
           .enterUsername(username)
           .enterPassword(password)
           .enterNombre(nombre)
           .enterApellidos(apellidos);
    }

    private String getErrorMessageWithWait(RegisterPage reg) {
        new WebDriverWait(driver, Duration.ofSeconds(5))
                .until(d -> !reg.getErrorMessage().isEmpty());
        return reg.getErrorMessage();
    }

    // ── 1. Registro Exitoso - Caso BASE (BASE) ─────────────────────────────────────

    @Test
    @DisplayName("debe registrarse correctamente con datos válidos y redirigir a verifica correo (BASE)")
    void testRegistroExitosoBase() throws Exception {
        driver.get(sutUrl + "/register");
        RegisterPage reg = new RegisterPage(driver, waiter);

        long ts = System.currentTimeMillis();
        String email = "regbase" + ts + "@devorapp.test";
        String password = BASE_PASSWORD;
        registerEmailForCleanup(email, password);

        fillStep1(reg,
                email,
                "regbase" + (ts % 100000),
                password, BASE_NOMBRE, BASE_APELLIDOS);
        injectAutocompleteMock(); // inject BEFORE step 2 mounts so the component finds window.google immediately
        reg.clickContinue().waitForStep2();

        Assertions.assertTrue(reg.isOnStep2(), "Must advance to step 2");

        reg.enterUbicacion("Madrid, España");

        triggerAutocompletePlaceChanged();

        reg.clickSubmit();

        new WebDriverWait(driver, Duration.ofSeconds(10))
                .until(d -> reg.isVerifyEmailVisible());
        Assertions.assertTrue(reg.isVerifyEmailVisible(), "Verification screen must be shown");
    }

    // ── 2. Validaciones en Paso 1 (S2–S10) ───────────────────────────────────────────
    //    Condensa: correo vacío (S4), correo inválido (S2), correo en uso (S3),
    //              username vacío (S5), username en uso (S6),
    //              nombre vacío (S7), apellidos vacíos (S8),
    //              contraseña vacía (S9), contraseña corta (S10).

    @Test
    @DisplayName("debe validar todos los campos obligatorios en el paso 1 (S2–S10)")
    void testValidacionesPaso1() throws Exception {
        long ts = System.currentTimeMillis();
        String validEmail    = "valid" + ts + "@devorapp.test";
        String validUsername = "valid" + (ts % 100000);

        // S4: Correo vacío
        driver.get(sutUrl + "/register");
        RegisterPage reg = new RegisterPage(driver, waiter);
        fillStep1(reg, "", validUsername, BASE_PASSWORD, BASE_NOMBRE, BASE_APELLIDOS);
        reg.clickContinue();
        Assertions.assertTrue(reg.isOnStep1(), "S4: must stay on step 1");
        String errS4 = getErrorMessageWithWait(reg);
        Assertions.assertTrue(errS4.contains("email") ||
                              errS4.contains("obligatorio"), "S4: email error");

        // S2: Correo inválido
        driver.get(sutUrl + "/register");
        reg = new RegisterPage(driver, waiter);
        fillStep1(reg, "correosinformato", validUsername, BASE_PASSWORD, BASE_NOMBRE, BASE_APELLIDOS);
        reg.clickContinue();
        Assertions.assertTrue(reg.isOnStep1(), "S2: must stay on step 1");
        String errS2 = getErrorMessageWithWait(reg);
        Assertions.assertTrue(errS2.contains("email") ||
                              errS2.contains("válido"), "S2: invalid email error");

        // S3: Correo en uso
        driver.get(sutUrl + "/register");
        reg = new RegisterPage(driver, waiter);
        fillStep1(reg, testEmail, validUsername, BASE_PASSWORD, BASE_NOMBRE, BASE_APELLIDOS);
        reg.clickContinue();
        RegisterPage finalReg1 = reg;
        new WebDriverWait(driver, Duration.ofSeconds(5))
                .until(d -> !finalReg1.getEmailError().isEmpty());
        Assertions.assertTrue(reg.getEmailError().contains("registrado"), "S3: email in use error");

        // S5: Nombre de usuario vacío
        driver.get(sutUrl + "/register");
        reg = new RegisterPage(driver, waiter);
        fillStep1(reg, validEmail, "", BASE_PASSWORD, BASE_NOMBRE, BASE_APELLIDOS);
        reg.clickContinue();
        Assertions.assertTrue(reg.isOnStep1(), "S5: must stay on step 1");
        String errS5 = getErrorMessageWithWait(reg);
        Assertions.assertTrue(errS5.contains("usuario") ||
                              errS5.contains("obligatorio"), "S5: username error");

        // S6: Nombre de usuario en uso
        driver.get(sutUrl + "/register");
        reg = new RegisterPage(driver, waiter);
        fillStep1(reg, validEmail, testUsername, BASE_PASSWORD, BASE_NOMBRE, BASE_APELLIDOS);
        reg.clickContinue();
        RegisterPage finalReg2 = reg;
        new WebDriverWait(driver, Duration.ofSeconds(5))
                .until(d -> !finalReg2.getUsernameError().isEmpty());
        Assertions.assertTrue(reg.getUsernameError().contains("uso"), "S6: username in use error");

        // S7: Nombre vacío
        driver.get(sutUrl + "/register");
        reg = new RegisterPage(driver, waiter);
        fillStep1(reg, validEmail, validUsername, BASE_PASSWORD, "", BASE_APELLIDOS);
        reg.clickContinue();
        Assertions.assertTrue(reg.isOnStep1(), "S7: must stay on step 1");
        String errS7 = getErrorMessageWithWait(reg);
        Assertions.assertTrue(errS7.contains("nombre"), "S7: nombre error");

        // S8: Apellidos vacíos
        driver.get(sutUrl + "/register");
        reg = new RegisterPage(driver, waiter);
        fillStep1(reg, validEmail, validUsername, BASE_PASSWORD, BASE_NOMBRE, "");
        reg.clickContinue();
        Assertions.assertTrue(reg.isOnStep1(), "S8: must stay on step 1");
        // The UI may say "apellidos", "obligatorio", "requerido", etc. — just check any error is shown
        String errS8 = getErrorMessageWithWait(reg);
        Assertions.assertFalse(errS8.isEmpty(), "S8: apellidos error must be shown");

        // S9: Contraseña vacía
        driver.get(sutUrl + "/register");
        reg = new RegisterPage(driver, waiter);
        fillStep1(reg, validEmail, validUsername, "", BASE_NOMBRE, BASE_APELLIDOS);
        reg.clickContinue();
        Assertions.assertTrue(reg.isOnStep1(), "S9: must stay on step 1");
        String errS9 = getErrorMessageWithWait(reg);
        Assertions.assertTrue(errS9.contains("contraseña") ||
                              errS9.contains("obligatoria"), "S9: password empty error");

        // S10: Contraseña corta (6 chars)
        driver.get(sutUrl + "/register");
        reg = new RegisterPage(driver, waiter);
        fillStep1(reg, validEmail, validUsername, "Seg123", BASE_NOMBRE, BASE_APELLIDOS);
        reg.clickContinue();
        Assertions.assertTrue(reg.isOnStep1(), "S10: must stay on step 1");
        String errS10 = getErrorMessageWithWait(reg);
        Assertions.assertTrue(errS10.contains("8") ||
                              errS10.contains("caracteres"), "S10: short password error");
    }

    // ── 3. Validaciones de Paso 2 y Registro con Contraseña Larga (S11–S16) ──────────
    //    Condensa: ubicación vacía (S16), ubicación manual (S15),
    //              contraseña sin letras backend (S13), sin números backend (S12),
    //              registro exitoso con contraseña larga (S11).

    @Test
    @DisplayName("debe validar ubicación, política de contraseña backend (S12, S13, S15, S16) y registro exitoso con contraseña larga (S11)")
    void testValidacionesPaso2YPasswordLarga() throws Exception {
        long ts = System.currentTimeMillis();

        // S16: Ubicación vacía
        driver.get(sutUrl + "/register");
        RegisterPage reg = new RegisterPage(driver, waiter);
        fillStep1(reg, "regloc1" + ts + "@devorapp.test", "reglocone" + (ts % 10000), "12345678", BASE_NOMBRE, BASE_APELLIDOS);
        reg.clickContinue().waitForStep2();
        reg.clickSubmit();
        Assertions.assertTrue(reg.isOnStep2(), "S16: must stay on step 2");
        String errS16 = getErrorMessageWithWait(reg);
        Assertions.assertTrue(errS16.contains("ubicación") ||
                              errS16.contains("lista"), "S16: location empty error");

        // S15: Ubicación manual no seleccionada
        driver.get(sutUrl + "/register");
        reg = new RegisterPage(driver, waiter);
        fillStep1(reg, "regloc2" + ts + "@devorapp.test", "regloctwo" + (ts % 10000), "12345678", BASE_NOMBRE, BASE_APELLIDOS);
        reg.clickContinue().waitForStep2();
        reg.enterUbicacion("Ubicación No Válida");
        reg.clickSubmit();
        Assertions.assertTrue(reg.isOnStep2(), "S15: must stay on step 2");
        String errS15 = getErrorMessageWithWait(reg);
        Assertions.assertTrue(errS15.contains("ubicación") ||
                              errS15.contains("lista"), "S15: manual location error");

        // S13: Contraseña sin letras (error del backend)
        driver.get(sutUrl + "/register");
        reg = new RegisterPage(driver, waiter);
        fillStep1(reg, "regloc3" + ts + "@devorapp.test", "reglocthree" + (ts % 10000), "12345678", BASE_NOMBRE, BASE_APELLIDOS);
        injectAutocompleteMock(); // inject BEFORE step 2 mounts so the component finds window.google immediately
        reg.clickContinue().waitForStep2();
        reg.enterUbicacion("Gijón, España");
        triggerAutocompletePlaceChanged();
        reg.clickSubmit();
        String errS13 = getErrorMessageWithWait(reg);
        Assertions.assertTrue(errS13.toLowerCase().contains("letra") ||
                              errS13.toLowerCase().contains("contraseña") ||
                              errS13.toLowerCase().contains("password"),
                "S13: no-letter password backend error");

        // S12: Contraseña sin números (error del backend)
        driver.get(sutUrl + "/register");
        reg = new RegisterPage(driver, waiter);
        fillStep1(reg, "regloc4" + ts + "@devorapp.test", "reglocfour" + (ts % 10000), "PasswordNoNum", BASE_NOMBRE, BASE_APELLIDOS);
        injectAutocompleteMock(); // inject BEFORE step 2 mounts
        reg.clickContinue().waitForStep2();
        reg.enterUbicacion("Gijón, España");
        triggerAutocompletePlaceChanged();
        reg.clickSubmit();
        String errS12 = getErrorMessageWithWait(reg);
        Assertions.assertTrue(errS12.toLowerCase().contains("número") ||
                              errS12.toLowerCase().contains("number") ||
                              errS12.toLowerCase().contains("contraseña") ||
                              errS12.toLowerCase().contains("password"),
                "S12: no-number password backend error");

        // S11: Registro exitoso con contraseña larga (16 chars)
        driver.get(sutUrl + "/register");
        reg = new RegisterPage(driver, waiter);
        long ts2 = System.currentTimeMillis();
        String emailS11 = "reglong" + ts2 + "@devorapp.test";
        String passwordS11 = "Segura1234567890";
        registerEmailForCleanup(emailS11, passwordS11);

        fillStep1(reg,
                emailS11,
                "reglong" + (ts2 % 100000),
                passwordS11, BASE_NOMBRE, BASE_APELLIDOS);
        injectAutocompleteMock(); // inject BEFORE step 2 mounts so the component finds window.google immediately
        reg.clickContinue().waitForStep2();

        Assertions.assertTrue(reg.isOnStep2(), "S11: must advance to step 2");

        reg.enterUbicacion("Madrid, España");
        triggerAutocompletePlaceChanged();
        reg.clickSubmit();

        final RegisterPage finalRegS11 = reg;
        new WebDriverWait(driver, Duration.ofSeconds(10))
                .until(d -> finalRegS11.isVerifyEmailVisible());
        Assertions.assertTrue(reg.isVerifyEmailVisible(), "S11: verification screen must be shown");
    }
}