package epigijon.devorapp.e2e.functional.tests.e2e;

import epigijon.devorapp.e2e.functional.common.BaseLoggedClass;
import epigijon.devorapp.e2e.functional.pages.LoginPage;
import epigijon.devorapp.e2e.functional.pages.SideMenuPage;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.Assertions;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

/**
 * Browser tests for the DevorApp side menu drawer.
 *
 * <p>Adapts {@code sidemenu.spec.ts} (Playwright) to Selenium + JUnit 5.
 * The side menu is accessed from {@code /home} via the hamburger button.
 *
 * <p>Base-Choice coverage:
 * <ul>
 *   <li>BASE / S2 — tema claro (BASE) activa data-theme='light'; tema oscuro (S2) elimina el atributo.
 *                     La letra M está activa por defecto en ambos casos.</li>
 *   <li>S3 / S4   — letra S y letra L se aplican correctamente junto con tema claro.</li>
 * </ul>
 */
class TestSideMenu extends BaseLoggedClass {

    @BeforeAll
    static void createTestUser() throws Exception {
        long ts = System.currentTimeMillis();
        setupTestUser("menuui" + (ts % 100000), "menuui" + ts + "@devorapp.test", "Test1234!");
    }

    @AfterAll
    static void cleanupTestUser() {
        tearDownTestUser();
    }

    private void clearSessionAndLogin() {
        clearSession();
        driver.get(sutUrl + "/login");
    }

    /** Logs in, navigates to /home, and opens the side menu. */
    private SideMenuPage loginAndOpenMenu() throws Exception {
        clearSessionAndLogin();
        new LoginPage(driver, waiter)
                .enterIdentifier(testEmail)
                .enterPassword(testPassword)
                .submitLogin();
        return new SideMenuPage(driver, waiter).open();
    }

    // ── 1. BASE + S2: selección de tema (Claro y Oscuro) ─────────────────────────

    @Test
    @DisplayName("BASE y S2 — el tema Claro activa data-theme='light' y el Oscuro lo elimina; letra M activa por defecto")
    void testSeleccionTema() throws Exception {
        // BASE: tema Claro, letra M por defecto
        SideMenuPage menu = loginAndOpenMenu();
        menu.clickTheme("Claro");
        Assertions.assertAll(
                () -> Assertions.assertTrue(menu.isThemeActive("Claro"),
                        "BASE: 'Claro' button must have the active class after clicking"),
                () -> Assertions.assertFalse(menu.isThemeActive("Oscuro"),
                        "BASE: 'Oscuro' button must not be active when 'Claro' is selected"),
                () -> Assertions.assertEquals("light", menu.getHtmlDataTheme(),
                        "BASE: <html> element must have data-theme='light'"),
                () -> Assertions.assertTrue(menu.isFontSizeActive("M"),
                        "BASE: M font-size must be active by default")
        );

        // S2: tema Oscuro
        menu.clickTheme("Oscuro");
        Assertions.assertAll(
                () -> Assertions.assertTrue(menu.isThemeActive("Oscuro"),
                        "S2: 'Oscuro' button must have the active class after clicking"),
                () -> Assertions.assertFalse(menu.isThemeActive("Claro"),
                        "S2: 'Claro' button must not be active"),
                () -> Assertions.assertEquals("", menu.getHtmlDataTheme(),
                        "S2: dark mode must have no data-theme attribute on <html>")
        );
    }

    // ── 2. S3 + S4: selección de tamaño de letra (S y L) ────────────────────

    @Test
    @DisplayName("S3 y S4 — la letra S y la letra L se aplican correctamente con tema Claro")
    void testSeleccionTamanoLetra() throws Exception {
        SideMenuPage menu = loginAndOpenMenu();
        menu.clickTheme("Claro");

        // S3: letra S
        menu.clickFontSize("S");
        Assertions.assertAll(
                () -> Assertions.assertEquals("light", menu.getHtmlDataTheme(),
                        "S3: data-theme must be 'light'"),
                () -> Assertions.assertTrue(menu.isFontSizeActive("S"),
                        "S3: 'S' font-size button must be active"),
                () -> Assertions.assertFalse(menu.isFontSizeActive("M"),
                        "S3: 'M' font-size button must not be active"),
                () -> Assertions.assertEquals("S", menu.getHtmlDataFontSize(),
                        "S3: data-font-size must be 'S'")
        );

        // S4: letra L
        menu.clickFontSize("L");
        Assertions.assertAll(
                () -> Assertions.assertEquals("light", menu.getHtmlDataTheme(),
                        "S4: data-theme must still be 'light'"),
                () -> Assertions.assertTrue(menu.isFontSizeActive("L"),
                        "S4: 'L' font-size button must be active"),
                () -> Assertions.assertFalse(menu.isFontSizeActive("M"),
                        "S4: 'M' font-size button must not be active"),
                () -> Assertions.assertEquals("L", menu.getHtmlDataFontSize(),
                        "S4: data-font-size must be 'L'")
        );
    }
}