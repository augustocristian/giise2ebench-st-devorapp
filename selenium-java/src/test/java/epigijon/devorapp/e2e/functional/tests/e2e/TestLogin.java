package epigijon.devorapp.e2e.functional.tests.e2e;

import epigijon.devorapp.e2e.functional.common.BaseLoggedClass;
import epigijon.devorapp.e2e.functional.pages.LoginPage;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.Assertions;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

/**
 * Browser tests for the DevorApp login page.
 *
 * <p>Base-Choice coverage:
 * <ul>
 *   <li>BASE — valid credentials redirect to /home (S7 - Happy Path).</li>
 *   <li>S3–S6 — empty identifier and/or password trigger a validation error (BASE, S3, S4, S5, S6).</li>
 *   <li>S8 — wrong password shows an error and stays on /login.</li>
 * </ul>
 */
class TestLogin extends BaseLoggedClass {

    private static final String PASSWORD = "Test1234!";

    @BeforeAll
    static void createTestUser() throws Exception {
        long ts = System.currentTimeMillis();
        String username = "tst" + ts;
        if (username.length() > 30) username = username.substring(username.length() - 30);
        setupTestUser(username, "testui" + ts + "@devorapp.test", PASSWORD);
    }

    @AfterAll
    static void cleanupTestUser() {
        tearDownTestUser();
    }

    private void clearSessionAndLogin() {
        clearSession();
        driver.get(sutUrl + "/login");
    }

    // ── Tests ─────────────────────────────────────────────────────────────────────

    /**
     * S7 — valid credentials redirect the user to /home.
     *
     * <p>Combines:
     * <ul>
     *   <li>S7: Standard login using existing email and correct password.</li>
     * </ul>
     */
    @Test
    @DisplayName("Valid credentials redirect the user to the home page (S7)")
    void testSuccessfulLogin() throws Exception {
        // S7 - Happy path (email/password)
        clearSessionAndLogin();
        String url = new LoginPage(driver, waiter)
                .enterIdentifier(testEmail)
                .enterPassword(PASSWORD)
                .submitLogin()
                .getCurrentUrl();

        Assertions.assertTrue(url.contains("/home"),
                "After login the URL must contain /home (S7)");
    }

    /**
     * BASE, S3–S6, S8 — empty fields and wrong password are rejected with an error.
     *
     * <p>Combines:
     * <ul>
     *   <li>BASE: existing email, empty password → error.</li>
     *   <li>S3: non-existing email, empty password → error.</li>
     *   <li>S4: existing username, empty password → error.</li>
     *   <li>S5: non-existing username, empty password → error.</li>
     *   <li>S6: both fields empty → error.</li>
     *   <li>S8: correct identifier, wrong password → error.</li>
     * </ul>
     */
    @Test
    @DisplayName("Empty fields (BASE, S3–S6) and wrong password (S8) trigger validation errors")
    void testLoginValidationErrors() throws Exception {
        // 1. BASE: existing email, empty password
        clearSessionAndLogin();
        LoginPage page = new LoginPage(driver, waiter)
                .enterIdentifier(testEmail)
                .enterPassword("");

        page.submitLoginExpectingFailure();
        Assertions.assertTrue(page.hasErrorMessage(),
                "Error message must show for empty password (BASE)");

        // 2. S3: non-existing email, empty password
        clearSessionAndLogin();
        page = new LoginPage(driver, waiter)
                .enterIdentifier("nonexistent@devorapp.test")
                .enterPassword("");

        page.submitLoginExpectingFailure();
        Assertions.assertTrue(page.hasErrorMessage(),
                "Error message must show for non-existing email and empty password (S3)");

        // 3. S4: existing username, empty password
        clearSessionAndLogin();
        page = new LoginPage(driver, waiter)
                .enterIdentifier(testUsername)
                .enterPassword("");

        page.submitLoginExpectingFailure();
        Assertions.assertTrue(page.hasErrorMessage(),
                "Error message must show for existing username and empty password (S4)");

        // 4. S5: non-existing username, empty password
        clearSessionAndLogin();
        page = new LoginPage(driver, waiter)
                .enterIdentifier("nonexistentuser")
                .enterPassword("");

        page.submitLoginExpectingFailure();
        Assertions.assertTrue(page.hasErrorMessage(),
                "Error message must show for non-existing username and empty password (S5)");

        // 5. S6: both fields empty
        clearSessionAndLogin();
        page = new LoginPage(driver, waiter)
                .enterIdentifier("")
                .enterPassword("");

        page.submitLoginExpectingFailure();
        Assertions.assertTrue(page.hasErrorMessage(),
                "Error message must show when both fields are empty (S6)");

        // 6. S8: correct identifier, wrong password
        clearSessionAndLogin();
        final LoginPage finalPage = new LoginPage(driver, waiter)
                .enterIdentifier(testEmail)
                .enterPassword("WrongPassword99!")
                .submitLoginExpectingFailure();

        Assertions.assertAll(
                () -> Assertions.assertTrue(finalPage.hasErrorMessage(),
                        "An error message must be visible after a failed login (S8)"),
                () -> Assertions.assertTrue(driver.getCurrentUrl().contains("/login"),
                        "The URL must remain on /login after a failed attempt (S8)")
        );
    }
}