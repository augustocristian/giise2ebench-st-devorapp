package epigijon.devorapp.e2e.functional.tests.e2e;

import epigijon.devorapp.e2e.functional.common.BaseLoggedClass;
import epigijon.devorapp.e2e.functional.pages.LoginPage;
import epigijon.devorapp.e2e.functional.pages.RecommendPage;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.Assertions;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.openqa.selenium.JavascriptExecutor;
import org.openqa.selenium.support.ui.WebDriverWait;

import java.time.Duration;

/**
 * Browser tests for the DevorApp recommendation search page
 * ({@code /recommend-restaurants}).
 *
 * <p>Adapts {@code recommendation.spec.ts} (Playwright) to Selenium + JUnit 5.
 * Unlike the Playwright version (which mocks the backend), these tests call
 * the <em>real</em> backend API. Result counts are therefore not asserted to
 * exact numbers; instead we assert structural/functional behaviour.
 *
 * <p>Base-Choice coverage:
 * <ul>
 *   <li>BASE — search with base filters (categories + prices + ubicación preferida) works.</li>
 *   <li>S2 — no categories selected → request is still sent without error.</li>
 *   <li>S4 — no price selected → request is still sent without error.</li>
 *   <li>S6 — "Sin precio" unchecked → does not block search.</li>
 *   <li>S7 — "Abierto ahora" unchecked → does not block search.</li>
 *   <li>S8 — another valid location is chosen → search completes without error.</li>
 *   <li>S9 — other-location selected but left empty → error message shown.</li>
 * </ul>
 */
class TestRecommendView extends BaseLoggedClass {

    @BeforeAll
    static void createTestUser() throws Exception {
        long ts = System.currentTimeMillis();
        setupTestUser("recui" + (ts % 100000), "recui" + ts + "@devorapp.test", "Test1234!");
    }

    @AfterAll
    static void cleanupTestUser() {
        tearDownTestUser();
    }

    private void clearSessionAndLogin() {
        clearSession();
        driver.get(sutUrl + "/login");
    }

    /** Logs in and navigates to /recommend-restaurants. */
    private RecommendPage loginAndGoToRecommend() throws Exception {
        clearSessionAndLogin();
        new LoginPage(driver, waiter)
                .enterIdentifier(testEmail)
                .enterPassword(testPassword)
                .submitLogin();
        driver.get(sutUrl + "/recommend-restaurants");
        return new RecommendPage(driver, waiter);
    }

    // ── 1. BASE + S8: búsqueda con filtros base (ubicación preferida y alternativa) ────

    @Test
    @DisplayName("BASE — búsqueda con filtros base y ubicación preferida/alternativa (BASE, S8)")
    void testBase_BusquedaFiltrosBaseYUbicacionAlternativa() throws Exception {
        // BASE: preferred location + multiple categories + multiple prices
        RecommendPage page = loginAndGoToRecommend();
        page.addCategory("Mexicano", "Mexicano");
        page.addCategory("Italiano", "Italiano");
        page.clickPrice("€");
        page.clickPrice("€€");
        page.setIncludeNoPrice(true);
        page.setOpenNow(true);
        page.selectPreferredLocation();
        page.search();
        Assertions.assertFalse(page.hasErrorMessage(),
                "BASE: search with base filters must not produce a validation error");

        // S8: alternate location (autocomplete mock needed)
        page = loginAndGoToRecommend();
        page.addCategory("Mexicano",  "Mexicano");
        page.addCategory("Italiano",  "Italiano");
        page.clickPrice("€");
        page.clickPrice("€€");

        injectAutocompleteMock();
        page.selectOtherLocation("Barcelona, España");

        triggerAutocompletePlaceChanged();

        page.search();
        Assertions.assertFalse(page.hasErrorMessage(),
                "S8: search with custom location and multiple filters must not produce an error");
    }

    // ── 2. S2, S4, S6, S7: filtros opcionales sin categorías ni precio, booleanos en falso ─

    @Test
    @DisplayName("S2, S4, S6, S7 — búsqueda sin categorías ni precio y con booleanos en false")
    void testFiltrosOpcionales() throws Exception {
        // S2 + S4: no categories, no prices → search without frontend error
        RecommendPage page = loginAndGoToRecommend();
        page.selectPreferredLocation();
        page.search();
        Assertions.assertFalse(page.hasErrorMessage(),
                "S2/S4: searching without categories or prices must not block with an error");

        // S6 + S7: uncheck "sin precio" and "abierto ahora" — user is still logged in
        driver.get(sutUrl + "/recommend-restaurants");
        page = new RecommendPage(driver, waiter);
        page.addCategory("Italiano", "Italiano");
        page.setIncludeNoPrice(false);
        page.setOpenNow(false);
        page.selectPreferredLocation();
        page.search();
        Assertions.assertFalse(page.hasErrorMessage(),
                "S6/S7: unchecking boolean filters must not produce a validation error");

        // S3: 1 category, multiple prices
        driver.get(sutUrl + "/recommend-restaurants");
        page = new RecommendPage(driver, waiter);
        page.addCategory("Mexicano", "Mexicano");
        page.clickPrice("€");
        page.clickPrice("€€");
        page.selectPreferredLocation();
        page.search();
        Assertions.assertFalse(page.hasErrorMessage(),
                "S3: searching with 1 category and multiple prices must not produce an error");

        // S5: multiple categories, 1 price
        driver.get(sutUrl + "/recommend-restaurants");
        page = new RecommendPage(driver, waiter);
        page.addCategory("Mexicano", "Mexicano");
        page.addCategory("Italiano", "Italiano");
        page.clickPrice("€");
        page.selectPreferredLocation();
        page.search();
        Assertions.assertFalse(page.hasErrorMessage(),
                "S5: searching with multiple categories and 1 price must not produce an error");
    }

    // ── 3. S9: ubicación alternativa vacía → error de validación ──────────────────────

    @Test
    @DisplayName("S9, S10, S11 — validación de otra ubicación vacía (S9), y control de resultados 0 (S10) y 1 (S11)")
    void testS9_OtraUbicacionVacia() throws Exception {
        // 1. S9: empty alternate location
        RecommendPage pageS9 = loginAndGoToRecommend();
        pageS9.addCategory("Mexicano", "Mexicano");
        pageS9.selectOtherLocation(""); // empty location
        pageS9.search();

        Assertions.assertAll(
                () -> Assertions.assertTrue(pageS9.hasErrorMessage(),
                        "Searching without a location when 'otra ubicación' is selected must show an error"),
                () -> Assertions.assertTrue(
                        pageS9.getErrorMessage().toLowerCase().contains("ubicación") ||
                        pageS9.getErrorMessage().toLowerCase().contains("localiz"),
                        "Error message must mention location"));

        // 2. S10: 0 results (using fetch mock)
        driver.get(sutUrl + "/recommend-restaurants");
        RecommendPage pageS10 = new RecommendPage(driver, waiter);
        pageS10.addCategory("Mexicano", "Mexicano");
        pageS10.selectPreferredLocation();

        // Inject fetch mock for 0 results
        ((JavascriptExecutor) driver).executeScript(
            "window.originalFetch = window.fetch; " +
            "window.fetch = function(input, init) { " +
            "  if (typeof input === 'string' && input.includes('/api/recommendations/search')) { " +
            "    return Promise.resolve(new Response(JSON.stringify({ results: [], next_page_token: null }), { status: 200, headers: { 'Content-Type': 'application/json' } })); " +
            "  } " +
            "  return window.originalFetch(input, init); " +
            "};"
        );

        pageS10.search();
        // Wait a bit to ensure UI handles it and verify result count is 0
        new WebDriverWait(driver, Duration.ofSeconds(5))
                .until(d -> d.findElements(org.openqa.selenium.By.cssSelector(".suggestion-card")).size() == 0);
        Assertions.assertEquals(0, pageS10.getResultCount(), "S10: result count must be 0");
        // Restore fetch
        ((JavascriptExecutor) driver).executeScript("window.fetch = window.originalFetch;");

        // 3. S11: 1 result (using fetch mock)
        driver.get(sutUrl + "/recommend-restaurants");
        RecommendPage pageS11 = new RecommendPage(driver, waiter);
        pageS11.addCategory("Mexicano", "Mexicano");
        pageS11.selectPreferredLocation();

        // Inject fetch mock for 1 result
        ((JavascriptExecutor) driver).executeScript(
            "window.originalFetch = window.fetch; " +
            "window.fetch = function(input, init) { " +
            "  if (typeof input === 'string' && input.includes('/api/recommendations/search')) { " +
            "    return Promise.resolve(new Response(JSON.stringify({ " +
            "      results: [{ id: 'test_place_11', name: 'Restaurante S11', rating: 4.0, user_ratings_total: 10, types: ['restaurant'], address: 'Calle 11', main_photo: null, summary: 'S11', open_now: true }], " +
            "      next_page_token: null " +
            "    }), { status: 200, headers: { 'Content-Type': 'application/json' } })); " +
            "  } " +
            "  return window.originalFetch(input, init); " +
            "};"
        );

        pageS11.search();
        // Wait for card to appear
        new WebDriverWait(driver, Duration.ofSeconds(5))
                .until(d -> d.findElements(org.openqa.selenium.By.cssSelector(".suggestion-card")).size() == 1);
        Assertions.assertEquals(1, pageS11.getResultCount(), "S11: result count must be 1");
        // Restore fetch
        ((JavascriptExecutor) driver).executeScript("window.fetch = window.originalFetch;");
    }
}