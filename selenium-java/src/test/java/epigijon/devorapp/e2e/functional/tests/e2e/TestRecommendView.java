package epigijon.devorapp.e2e.functional.tests.e2e;

import epigijon.devorapp.e2e.functional.common.BaseLoggedClass;
import epigijon.devorapp.e2e.functional.common.TestId;
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
 * Browser tests for {@code /recommend-restaurants} (BASE, S2-S11). They hit the real backend, so
 * result counts are only asserted where the search endpoint is mocked (S10, S11).
 */
class TestRecommendView extends BaseLoggedClass {

    private static final String MEXICAN = "mexican_restaurant";
    private static final String ITALIAN = "italian_restaurant";

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

    private RecommendPage loginAndGoToRecommend() throws Exception {
        clearSessionAndLogin();
        new LoginPage(driver, waiter)
                .enterIdentifier(testEmail)
                .enterPassword(testPassword)
                .submitLogin();
        driver.get(sutUrl + "/recommend-restaurants");
        return new RecommendPage(driver, waiter);
    }

    @Test
    @DisplayName("BASE and S8 - search with base filters, preferred and alternative location")
    void testBase_SearchWithBaseFiltersAndAlternativeLocation() throws Exception {
        // BASE: preferred location + several categories + several prices
        RecommendPage page = loginAndGoToRecommend();
        page.addCategory("Mexicano", MEXICAN);
        page.addCategory("Italiano", ITALIAN);
        page.clickPrice(1);
        page.clickPrice(2);
        page.setIncludeNoPrice(true);
        page.setOpenNow(true);
        page.selectPreferredLocation();
        page.search();
        Assertions.assertFalse(page.hasErrorMessage(),
                "BASE: search with base filters must not produce a validation error");

        // S8: alternative location (needs the autocomplete mock)
        page = loginAndGoToRecommend();
        page.addCategory("Mexicano", MEXICAN);
        page.addCategory("Italiano", ITALIAN);
        page.clickPrice(1);
        page.clickPrice(2);

        injectAutocompleteMock();
        page.selectOtherLocation("Barcelona, España");

        triggerAutocompletePlaceChanged();

        page.search();
        Assertions.assertFalse(page.hasErrorMessage(),
                "S8: search with custom location and multiple filters must not produce an error");
    }

    @Test
    @DisplayName("S2, S3, S4, S5, S6, S7 - optional filters: no categories/prices, one category, one price, booleans off")
    void testOptionalFilters() throws Exception {
        // S2 + S4: no categories, no prices
        RecommendPage page = loginAndGoToRecommend();
        page.selectPreferredLocation();
        page.search();
        Assertions.assertFalse(page.hasErrorMessage(),
                "S2/S4: searching without categories or prices must not block with an error");

        // S6 + S7: uncheck "no price" and "open now"
        driver.get(sutUrl + "/recommend-restaurants");
        page = new RecommendPage(driver, waiter);
        page.addCategory("Italiano", ITALIAN);
        page.setIncludeNoPrice(false);
        page.setOpenNow(false);
        page.selectPreferredLocation();
        page.search();
        Assertions.assertFalse(page.hasErrorMessage(),
                "S6/S7: unchecking boolean filters must not produce a validation error");

        // S3: 1 category, several prices
        driver.get(sutUrl + "/recommend-restaurants");
        page = new RecommendPage(driver, waiter);
        page.addCategory("Mexicano", MEXICAN);
        page.clickPrice(1);
        page.clickPrice(2);
        page.selectPreferredLocation();
        page.search();
        Assertions.assertFalse(page.hasErrorMessage(),
                "S3: searching with 1 category and multiple prices must not produce an error");

        // S5: several categories, 1 price
        driver.get(sutUrl + "/recommend-restaurants");
        page = new RecommendPage(driver, waiter);
        page.addCategory("Mexicano", MEXICAN);
        page.addCategory("Italiano", ITALIAN);
        page.clickPrice(1);
        page.selectPreferredLocation();
        page.search();
        Assertions.assertFalse(page.hasErrorMessage(),
                "S5: searching with multiple categories and 1 price must not produce an error");
    }

    @Test
    @DisplayName("S9, S10, S11 - empty other-location validation (S9), 0 results (S10) and 1 result (S11)")
    void testS9_EmptyOtherLocation() throws Exception {
        // S9: empty alternative location
        RecommendPage pageS9 = loginAndGoToRecommend();
        pageS9.addCategory("Mexicano", MEXICAN);
        pageS9.selectOtherLocation("");
        pageS9.search();

        Assertions.assertAll(
                () -> Assertions.assertTrue(pageS9.hasErrorMessage(),
                        "Searching without a location when 'other location' is selected must show an error"),
                () -> Assertions.assertTrue(
                        pageS9.getErrorMessage().toLowerCase().contains("ubicación") ||
                        pageS9.getErrorMessage().toLowerCase().contains("localiz"),
                        "Error message must mention location"));

        // S10: 0 results (fetch mock)
        driver.get(sutUrl + "/recommend-restaurants");
        RecommendPage pageS10 = new RecommendPage(driver, waiter);
        pageS10.addCategory("Mexicano", MEXICAN);
        pageS10.selectPreferredLocation();

        ((JavascriptExecutor) driver).executeScript(
            "window.originalFetch = window.fetch; " +
            "window.fetch = function(input, init) { " +
            "  if (typeof input === 'string' && input.includes('/api/v1/recommendations/search')) { " +
            "    return Promise.resolve(new Response(JSON.stringify({ results: [], next_page_token: null }), { status: 200, headers: { 'Content-Type': 'application/json' } })); " +
            "  } " +
            "  return window.originalFetch(input, init); " +
            "};"
        );

        pageS10.search();
        new WebDriverWait(driver, Duration.ofSeconds(5))
                .until(d -> d.findElements(TestId.of("recommend-result-card")).size() == 0);
        Assertions.assertEquals(0, pageS10.getResultCount(), "S10: result count must be 0");
        ((JavascriptExecutor) driver).executeScript("window.fetch = window.originalFetch;");

        // S11: 1 result (fetch mock)
        driver.get(sutUrl + "/recommend-restaurants");
        RecommendPage pageS11 = new RecommendPage(driver, waiter);
        pageS11.addCategory("Mexicano", MEXICAN);
        pageS11.selectPreferredLocation();

        ((JavascriptExecutor) driver).executeScript(
            "window.originalFetch = window.fetch; " +
            "window.fetch = function(input, init) { " +
            "  if (typeof input === 'string' && input.includes('/api/v1/recommendations/search')) { " +
            "    return Promise.resolve(new Response(JSON.stringify({ " +
            "      results: [{ id: 'test_place_11', name: 'Restaurante S11', rating: 4.0, user_ratings_total: 10, types: ['restaurant'], address: 'Calle 11', main_photo: null, summary: 'S11', open_now: true }], " +
            "      next_page_token: null " +
            "    }), { status: 200, headers: { 'Content-Type': 'application/json' } })); " +
            "  } " +
            "  return window.originalFetch(input, init); " +
            "};"
        );

        pageS11.search();
        new WebDriverWait(driver, Duration.ofSeconds(5))
                .until(d -> d.findElements(TestId.of("recommend-result-card")).size() == 1);
        Assertions.assertEquals(1, pageS11.getResultCount(), "S11: result count must be 1");
        ((JavascriptExecutor) driver).executeScript("window.fetch = window.originalFetch;");
    }
}
