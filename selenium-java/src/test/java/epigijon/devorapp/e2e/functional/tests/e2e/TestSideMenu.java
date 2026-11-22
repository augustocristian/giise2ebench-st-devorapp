package epigijon.devorapp.e2e.functional.tests.e2e;

import epigijon.devorapp.e2e.functional.common.BaseLoggedClass;
import epigijon.devorapp.e2e.functional.pages.LoginPage;
import epigijon.devorapp.e2e.functional.pages.SideMenuPage;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.Assertions;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

/** Browser tests for the side menu theme and font-size toggles (BASE, S2-S4). */
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

    private SideMenuPage loginAndOpenMenu() throws Exception {
        clearSessionAndLogin();
        new LoginPage(driver, waiter)
                .enterIdentifier(testEmail)
                .enterPassword(testPassword)
                .submitLogin();
        return new SideMenuPage(driver, waiter).open();
    }

    @Test
    @DisplayName("BASE and S2 - light theme sets data-theme='light', dark theme removes it; font M active by default")
    void testThemeSelection() throws Exception {
        // BASE: light theme, default font M
        SideMenuPage menu = loginAndOpenMenu();
        menu.clickTheme("light");
        Assertions.assertAll(
                () -> Assertions.assertTrue(menu.isThemeActive("light"),
                        "BASE: light button must have the active class after clicking"),
                () -> Assertions.assertFalse(menu.isThemeActive("dark"),
                        "BASE: dark button must not be active when light is selected"),
                () -> Assertions.assertEquals("light", menu.getHtmlDataTheme(),
                        "BASE: <html> element must have data-theme='light'"),
                () -> Assertions.assertTrue(menu.isFontSizeActive("M"),
                        "BASE: M font-size must be active by default")
        );

        // S2: dark theme
        menu.clickTheme("dark");
        Assertions.assertAll(
                () -> Assertions.assertTrue(menu.isThemeActive("dark"),
                        "S2: dark button must have the active class after clicking"),
                () -> Assertions.assertFalse(menu.isThemeActive("light"),
                        "S2: light button must not be active"),
                () -> Assertions.assertEquals("", menu.getHtmlDataTheme(),
                        "S2: dark mode must have no data-theme attribute on <html>")
        );
    }

    @Test
    @DisplayName("S3 and S4 - font sizes S and L are applied with the light theme")
    void testFontSizeSelection() throws Exception {
        SideMenuPage menu = loginAndOpenMenu();
        menu.clickTheme("light");

        // S3: font S
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

        // S4: font L
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
