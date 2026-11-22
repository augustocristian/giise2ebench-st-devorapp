package epigijon.devorapp.e2e.functional.tests.e2e;

import epigijon.devorapp.e2e.functional.common.BaseLoggedClass;
import epigijon.devorapp.e2e.functional.pages.HistoryPage;
import epigijon.devorapp.e2e.functional.pages.LoginPage;
import epigijon.devorapp.e2e.functional.pages.SideMenuPage;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.Assertions;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.openqa.selenium.JavascriptExecutor;

/** Browser tests for {@code /history} with a mocked history endpoint (BASE, S2, S3, S5, S6). */
class TestHistoryView extends BaseLoggedClass {

    @BeforeAll
    static void createTestUser() throws Exception {
        long ts = System.currentTimeMillis();
        setupTestUser("histui" + (ts % 100000), "histui" + ts + "@devorapp.test", "Test1234!");
    }

    @AfterAll
    static void cleanupTestUser() {
        tearDownTestUser();
    }

    private void clearSessionAndLogin() {
        clearSession();
        driver.get(sutUrl + "/login");
    }

    private void injectHistoryMock(String jsonResponse) {
        ((JavascriptExecutor) driver).executeScript(
                "window.originalFetch = window.fetch; " +
                        "window.fetch = function(input, init) { " +
                        "  if (typeof input === 'string' && input.includes('/api/historial')) { " +
                        "    return Promise.resolve(new Response('" + jsonResponse.replace("'", "\\'")
                        + "', { status: 200, headers: { 'Content-Type': 'application/json' } })); " +
                        "  } " +
                        "  return window.originalFetch(input, init); " +
                        "};");
    }

    private void restoreFetch() {
        ((JavascriptExecutor) driver).executeScript(
                "if (window.originalFetch) { window.fetch = window.originalFetch; }");
    }

    private String getMockHistoryJson(String date1, String date2) {
        return "[" +
                "{\"id\":1,\"user_id\":\"uid\",\"place_id\":\"MOCK_PLACE_101\",\"fecha_acceso\":\"" + date1
                + "\"," +
                "\"restaurant\":{\"id\":\"MOCK_PLACE_101\",\"name\":\"Restaurante Uno\",\"rating\":4.5,\"user_ratings_total\":100,\"types\":[\"restaurant\"],\"address\":\"Calle Ficticia 123\",\"main_photo\":null,\"summary\":\"Excelente\",\"open_now\":true}},"
                +
                "{\"id\":2,\"user_id\":\"uid\",\"place_id\":\"MOCK_PLACE_102\",\"fecha_acceso\":\"" + date2
                + "\"," +
                "\"restaurant\":{\"id\":\"MOCK_PLACE_102\",\"name\":\"Restaurante Dos\",\"rating\":4.0,\"user_ratings_total\":50,\"types\":[\"restaurant\"],\"address\":\"Avenida Imaginaria 742\",\"main_photo\":null,\"summary\":\"Agradable\",\"open_now\":false}}"
                +
                "]";
    }

    private String getSingleMockEntryJson(String date) {
        return "[" +
                "{\"id\":1,\"user_id\":\"uid\",\"place_id\":\"MOCK_PLACE_101\",\"fecha_acceso\":\"" + date
                + "\"," +
                "\"restaurant\":{\"id\":\"MOCK_PLACE_101\",\"name\":\"Restaurante Uno\",\"rating\":4.5,\"user_ratings_total\":100,\"types\":[\"restaurant\"],\"address\":\"Calle Ficticia 123\",\"main_photo\":null,\"summary\":\"Excelente\",\"open_now\":true}}"
                +
                "]";
    }

    private HistoryPage loginGoToHistoryWithMock(String jsonResponse) throws Exception {
        clearSessionAndLogin();
        new LoginPage(driver, waiter)
                .enterIdentifier(testEmail)
                .enterPassword(testPassword)
                .submitLogin();

        injectHistoryMock(jsonResponse);

        new SideMenuPage(driver, waiter).open().goTo("history");

        return new HistoryPage(driver, waiter);
    }

    @Test
    @DisplayName("BASE - history page shows several month groups and multiple restaurant cards")
    void testBase_MultipleEntries() throws Exception {
        HistoryPage page = loginGoToHistoryWithMock(getMockHistoryJson("2026-05-15T12:00:00Z", "2026-06-15T12:00:00Z"));

        try {
            Assertions.assertEquals(2, page.getGroupCount(), "There must be 2 groups");

            // Only the first group starts expanded
            page.toggleGroup("JUNIO 2026");

            Assertions.assertEquals(2, page.getCardCount(), "2 restaurant cards must be visible");
        } finally {
            restoreFetch();
        }
    }

    @Test
    @DisplayName("Empty history (S2), 1 restaurant (S5) and 1 month with several (S3)")
    void testEmptyAndSingleCases() throws Exception {
        // S2: empty history
        HistoryPage pageEmpty = loginGoToHistoryWithMock("[]");
        try {
            Assertions.assertEquals(0, pageEmpty.getGroupCount(), "S2: there must be 0 groups");
            Assertions.assertEquals(0, pageEmpty.getCardCount(), "S2: there must be 0 cards");
        } finally {
            restoreFetch();
        }

        // S5: exactly 1 restaurant
        HistoryPage pageOne = loginGoToHistoryWithMock(getSingleMockEntryJson("2026-05-15T12:00:00Z"));
        try {
            Assertions.assertEquals(1, pageOne.getGroupCount(), "S5: there must be 1 group");
            Assertions.assertEquals(1, pageOne.getCardCount(), "S5: there must be 1 card");
        } finally {
            restoreFetch();
        }

        // S3: 1 month with several restaurants
        HistoryPage pageSameMonth = loginGoToHistoryWithMock(
                getMockHistoryJson("2026-05-15T12:00:00Z", "2026-05-20T12:00:00Z"));
        try {
            Assertions.assertEquals(1, pageSameMonth.getGroupCount(), "S3: there must be 1 group");
            Assertions.assertEquals(2, pageSameMonth.getCardCount(), "S3: there must be 2 cards");
        } finally {
            restoreFetch();
        }
    }

    @Test
    @DisplayName("S6 - searching in history filters cards; a non-matching term shows 0 cards")
    void testSearchFilters() throws Exception {
        HistoryPage page = loginGoToHistoryWithMock(getMockHistoryJson("2026-05-15T12:00:00Z", "2026-06-15T12:00:00Z"));
        try {
            page.toggleGroup("JUNIO 2026");
            Assertions.assertEquals(2, page.getCardCount(), "There must be 2 cards initially");

            page.search("Uno");
            Assertions.assertEquals(1, page.getGroupCount(), "There must be 1 group after searching 'Uno'");
            Assertions.assertEquals(1, page.getCardCount(), "There must be 1 card after searching 'Uno'");
            Assertions.assertEquals("Restaurante Uno", page.getCardNameAt(0),
                    "The visible card must be 'Restaurante Uno'");

            page.search("zzz_nada_xyzzy_no_match");
            Assertions.assertEquals(0, page.getGroupCount(), "There must be 0 groups after a search with no matches");
            Assertions.assertEquals(0, page.getCardCount(),
                    "There must be 0 cards after a search with no matches");
        } finally {
            restoreFetch();
        }
    }
}
