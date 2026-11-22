package epigijon.devorapp.e2e.functional.tests.e2e;

import epigijon.devorapp.e2e.functional.common.BaseLoggedClass;
import epigijon.devorapp.e2e.functional.pages.FavoritesPage;
import epigijon.devorapp.e2e.functional.pages.LoginPage;
import epigijon.devorapp.e2e.functional.pages.SideMenuPage;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.Assertions;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.openqa.selenium.JavascriptExecutor;

/** Browser tests for {@code /favorites} with mocked list endpoints (BASE, S2-S6). */
class TestFavoritesView extends BaseLoggedClass {

    private static final String PLACE_A = "MOCK_PLACE_101";
    private static final String PLACE_B = "MOCK_PLACE_102";

    @BeforeAll
    static void createTestUser() throws Exception {
        long ts = System.currentTimeMillis();
        setupTestUser("favui" + (ts % 100000), "favui" + ts + "@devorapp.test", "Test1234!");
    }

    @AfterAll
    static void cleanupTestUser() {
        tearDownTestUser();
    }

    private void clearSessionAndLogin() {
        clearSession();
        driver.get(sutUrl + "/login");
    }

    private void injectFavoritesMock(String listsJson, String detailJson) {
        ((JavascriptExecutor) driver).executeScript(
                "window.mockFavoritesLists = JSON.parse('" + listsJson.replace("'", "\\'") + "');" +
                        "window.mockFavoritesDetail = JSON.parse('" + detailJson.replace("'", "\\'") + "');" +
                        "window.originalFetch = window.fetch; " +
                        "window.fetch = function(input, init) { " +
                        "  if (typeof input === 'string') { " +
                        "    if (input.includes('/api/v1/favorites/lists/')) { " +
                        "      return Promise.resolve(new Response(JSON.stringify(window.mockFavoritesDetail), { status: 200, headers: { 'Content-Type': 'application/json' } })); "
                        +
                        "    } " +
                        "    if (input.includes('/api/v1/favorites/lists')) { " +
                        "      return Promise.resolve(new Response(JSON.stringify(window.mockFavoritesLists), { status: 200, headers: { 'Content-Type': 'application/json' } })); "
                        +
                        "    } " +
                        "  } " +
                        "  return window.originalFetch(input, init); " +
                        "};");
    }

    private void restoreFetch() {
        ((JavascriptExecutor) driver).executeScript(
                "if (window.originalFetch) { window.fetch = window.originalFetch; }");
    }

    private FavoritesPage loginGoToFavoritesWithMock(String listsJson, String detailJson) throws Exception {
        clearSessionAndLogin();
        new LoginPage(driver, waiter)
                .enterIdentifier(testEmail)
                .enterPassword(testPassword)
                .submitLogin();

        injectFavoritesMock(listsJson, detailJson);

        new SideMenuPage(driver, waiter).open().goTo("favorites");

        return new FavoritesPage(driver, waiter);
    }

    private String getMockListsJson(int count) {
        StringBuilder sb = new StringBuilder("[");
        for (int i = 1; i <= count; i++) {
            if (i > 1)
                sb.append(",");
            sb.append("{\"id\":").append(i)
                    .append(",\"user_id\":\"uid\",\"name\":\"Lista ").append(i)
                    .append("\",\"icon\":\"Heart\"}");
        }
        sb.append("]");
        return sb.toString();
    }

    private String getMockDetailJson(int listId, String listName, int restaurantCount) {
        StringBuilder sb = new StringBuilder();
        sb.append("{\"list\":{\"id\":").append(listId)
                .append(",\"user_id\":\"uid\",\"name\":\"").append(listName)
                .append("\",\"icon\":\"Heart\"},\"restaurants\":[");

        String[] placeIds = { PLACE_A, PLACE_B };
        String[] names = { "Restaurante Uno", "Restaurante Dos" };

        for (int i = 0; i < restaurantCount; i++) {
            if (i > 0)
                sb.append(",");
            sb.append("{\"id\":").append(i + 1)
                    .append(",\"list_id\":").append(listId)
                    .append(",\"place_id\":\"").append(placeIds[i % placeIds.length])
                    .append("\",\"restaurant\":{")
                    .append("\"id\":\"").append(placeIds[i % placeIds.length])
                    .append("\",\"name\":\"").append(names[i % names.length])
                    .append("\",\"rating\":4.5,\"user_ratings_total\":100,\"address\":\"Calle Ficticia ").append(i + 1)
                    .append("\",\"main_photo\":null,\"types\":[\"restaurant\"]}}");
        }
        sb.append("]}");
        return sb.toString();
    }

    @Test
    @DisplayName("BASE - several lists, 0 restaurants, with search")
    void testBase_ListSearch() throws Exception {
        FavoritesPage page = loginGoToFavoritesWithMock(getMockListsJson(2), getMockDetailJson(1, "Lista 1", 0));
        try {
            Assertions.assertEquals(2, page.getListCount(), "2 lists must be visible");

            page.openListByName("Lista 1");
            Assertions.assertEquals(0, page.getRestaurantCount(), "The list must be empty");

            page.searchWithin("pizza");
            Assertions.assertEquals(0, page.getRestaurantCount(), "The filtered list must stay empty");
        } finally {
            restoreFetch();
        }
    }

    @Test
    @DisplayName("S2, S3, S6 - empty states and search")
    void testEmptyCases() throws Exception {
        // S2: 0 lists -> empty state
        FavoritesPage pageEmpty = loginGoToFavoritesWithMock("[]", "{}");
        try {
            Assertions.assertEquals(0, pageEmpty.getListCount(), "S2: there must be 0 lists");
            Assertions.assertTrue(pageEmpty.isEmptyStateVisible(), "S2: the empty-state element must be visible");
        } finally {
            restoreFetch();
        }

        // S3: 1 list, 0 restaurants, with search
        FavoritesPage pageS3 = loginGoToFavoritesWithMock(getMockListsJson(1), getMockDetailJson(1, "Lista 1", 0));
        try {
            Assertions.assertEquals(1, pageS3.getListCount(), "S3: there must be 1 list");
            pageS3.openListByName("Lista 1");
            pageS3.searchWithin("pizza");
            Assertions.assertEquals(0, pageS3.getRestaurantCount(), "S3: the filtered list must be empty");
        } finally {
            restoreFetch();
        }

        // S6: several lists, 0 restaurants, no search
        FavoritesPage pageS6 = loginGoToFavoritesWithMock(getMockListsJson(2), getMockDetailJson(1, "Lista 1", 0));
        try {
            Assertions.assertEquals(2, pageS6.getListCount(), "S6: there must be 2 lists");
            pageS6.openListByName("Lista 1");
            Assertions.assertTrue(pageS6.isDetailEmptyStateVisible(), "S6: the empty-list element must be visible");
            Assertions.assertEquals(0, pageS6.getRestaurantCount(), "S6: there must be 0 restaurants");
        } finally {
            restoreFetch();
        }
    }

    @Test
    @DisplayName("S4, S5 - lists with restaurants and searches")
    void testCasesWithRestaurants() throws Exception {
        // S4: several lists, 1 restaurant, with search
        FavoritesPage pageS4 = loginGoToFavoritesWithMock(getMockListsJson(2), getMockDetailJson(1, "Lista 1", 1));
        try {
            pageS4.openListByName("Lista 1");
            Assertions.assertEquals(1, pageS4.getRestaurantCount(), "S4: there must be 1 restaurant initially");

            pageS4.searchWithin("Uno");
            Assertions.assertEquals(1, pageS4.getRestaurantCount(), "S4: there must still be 1 restaurant");

            pageS4.searchWithin("zzz_no_match");
            Assertions.assertEquals(0, pageS4.getRestaurantCount(),
                    "S4: there must be 0 restaurants after a failed search");
        } finally {
            restoreFetch();
        }

        // S5: several lists, several restaurants, with search
        FavoritesPage pageS5 = loginGoToFavoritesWithMock(getMockListsJson(2), getMockDetailJson(1, "Lista 1", 2));
        try {
            pageS5.openListByName("Lista 1");
            Assertions.assertEquals(2, pageS5.getRestaurantCount(), "S5: there must be 2 restaurants initially");

            pageS5.searchWithin("Dos");
            Assertions.assertEquals(1, pageS5.getRestaurantCount(),
                    "S5: there must be 1 restaurant visible when filtering by 'Dos'");

            pageS5.searchWithin("zzz_no_match");
            Assertions.assertEquals(0, pageS5.getRestaurantCount(),
                    "S5: there must be 0 restaurants after a failed search");
        } finally {
            restoreFetch();
        }
    }
}
