package epigijon.devorapp.e2e.functional.tests.e2e;

import com.google.gson.JsonObject;
import epigijon.devorapp.e2e.functional.common.BaseLoggedClass;
import epigijon.devorapp.e2e.functional.pages.FavoritesPage;
import epigijon.devorapp.e2e.functional.pages.LoginPage;
import epigijon.devorapp.e2e.functional.pages.SideMenuPage;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.Assertions;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.openqa.selenium.By;
import org.openqa.selenium.JavascriptExecutor;

import java.io.IOException;

/**
 * Browser tests for the DevorApp favorites page ({@code /favorites}).
 *
 * <p>
 * Base-Choice coverage:
 * <ul>
 * <li>BASE — multiple lists, 0 restaurants, with search filter.</li>
 * <li>S2 — 0 lists created (empty state general).</li>
 * <li>S3 — 1 list, 0 restaurants, with search filter.</li>
 * <li>S4 — multiple lists, 1 restaurant, with search filter.</li>
 * <li>S5 — multiple lists, multiple restaurants, with search filter.</li>
 * <li>S6 — multiple lists, 0 restaurants, no search filter.</li>
 * </ul>
 */
class TestFavoritesView extends BaseLoggedClass {

    private static final String PLACE_A = "ChIJN1t_tDeuEmsRUsoyG83frY4";
    private static final String PLACE_B = "ChIJdd4hrwug2EcRmSrV3Vo6llI";

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

    private void injectFavoritesMock(String listasJson, String detailJson) {
        ((JavascriptExecutor) driver).executeScript(
                "window.mockFavoritesListas = JSON.parse('" + listasJson.replace("'", "\\'") + "');" +
                        "window.mockFavoritesDetail = JSON.parse('" + detailJson.replace("'", "\\'") + "');" +
                        "window.originalFetch = window.fetch; " +
                        "window.fetch = function(input, init) { " +
                        "  if (typeof input === 'string') { " +
                        "    if (input.includes('/api/favoritos/listas/')) { " +
                        "      return Promise.resolve(new Response(JSON.stringify(window.mockFavoritesDetail), { status: 200, headers: { 'Content-Type': 'application/json' } })); "
                        +
                        "    } " +
                        "    if (input.includes('/api/favoritos/listas')) { " +
                        "      return Promise.resolve(new Response(JSON.stringify(window.mockFavoritesListas), { status: 200, headers: { 'Content-Type': 'application/json' } })); "
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

    private FavoritesPage loginGoToHomeAndInjectMock(String listasJson, String detailJson) throws Exception {
        clearSessionAndLogin();
        new LoginPage(driver, waiter)
                .enterIdentifier(testEmail)
                .enterPassword(testPassword)
                .submitLogin();

        injectFavoritesMock(listasJson, detailJson);

        new SideMenuPage(driver, waiter).open();
        new org.openqa.selenium.support.ui.WebDriverWait(driver, java.time.Duration.ofSeconds(5))
                .until(org.openqa.selenium.support.ui.ExpectedConditions.elementToBeClickable(
                        By.xpath("//button[contains(.,'Favoritos')]")))
                .click();

        return new FavoritesPage(driver, waiter);
    }

    private String getMockListasJson(int count) {
        StringBuilder sb = new StringBuilder("[");
        for (int i = 1; i <= count; i++) {
            if (i > 1)
                sb.append(",");
            sb.append("{\"id\":").append(i)
                    .append(",\"user_id\":\"uid\",\"nombre\":\"Lista ").append(i)
                    .append("\",\"icono\":\"Heart\"}");
        }
        sb.append("]");
        return sb.toString();
    }

    private String getMockDetailJson(int listId, String listName, int restaurantCount) {
        StringBuilder sb = new StringBuilder();
        sb.append("{\"lista\":{\"id\":").append(listId)
                .append(",\"user_id\":\"uid\",\"nombre\":\"").append(listName)
                .append("\",\"icono\":\"Heart\"},\"restaurantes\":[");

        String[] placeIds = { PLACE_A, PLACE_B };
        String[] names = { "Restaurante Uno", "Restaurante Dos" };

        for (int i = 0; i < restaurantCount; i++) {
            if (i > 0)
                sb.append(",");
            sb.append("{\"id\":").append(i + 1)
                    .append(",\"lista_id\":").append(listId)
                    .append(",\"place_id\":\"").append(placeIds[i % placeIds.length])
                    .append("\",\"restaurant\":{")
                    .append("\"id\":\"").append(placeIds[i % placeIds.length])
                    .append("\",\"name\":\"").append(names[i % names.length])
                    .append("\",\"rating\":4.5,\"user_ratings_total\":100,\"address\":\"Calle Falsa ").append(i + 1)
                    .append("\",\"main_photo\":null,\"types\":[\"restaurant\"]}}");
        }
        sb.append("]}");
        return sb.toString();
    }

    // ── 1. BASE: varias listas, 0 restaurantes, con búsqueda
    // ──────────────────────

    @Test
    @DisplayName("BASE — varias listas, 0 restaurantes, con búsqueda")
    void testBase_BusquedaListas() throws Exception {
        String listasJson = getMockListasJson(2);
        String detailJson = getMockDetailJson(1, "Lista 1", 0);

        FavoritesPage page = loginGoToHomeAndInjectMock(listasJson, detailJson);
        try {
            Assertions.assertEquals(2, page.getListCount(), "Debe haber 2 listas visibles");

            page.openListByName("Lista 1");
            Assertions.assertEquals(0, page.getRestaurantCount(), "La lista debe estar vacía");

            page.searchWithin("pizza");
            Assertions.assertEquals(0, page.getRestaurantCount(), "La lista filtrada debe seguir vacía");
        } finally {
            restoreFetch();
        }
    }

    // ── 2. S2, S3 y S6: vacíos, listas unitarias/múltiples
    // ────────────────────────

    @Test
    @DisplayName("S2, S3, S6 — gestión de estados vacíos y búsqueda")
    void testCasosVacio() throws Exception {
        // S2: 0 listas -> empty state
        FavoritesPage pageEmpty = loginGoToHomeAndInjectMock("[]", "{}");
        try {
            Assertions.assertEquals(0, pageEmpty.getListCount(), "S2: debe haber 0 listas");
            Assertions.assertTrue(pageEmpty.isEmptyStateVisible(), "S2: el texto de estado vacío debe ser visible");
        } finally {
            restoreFetch();
        }

        // S3: 1 lista, 0 restaurantes, con búsqueda
        String listasJson3 = getMockListasJson(1);
        String detailJson3 = getMockDetailJson(1, "Lista 1", 0);
        FavoritesPage pageS3 = loginGoToHomeAndInjectMock(listasJson3, detailJson3);
        try {
            Assertions.assertEquals(1, pageS3.getListCount(), "S3: debe haber 1 lista");
            pageS3.openListByName("Lista 1");
            pageS3.searchWithin("pizza");
            Assertions.assertEquals(0, pageS3.getRestaurantCount(), "S3: la lista filtrada debe estar vacía");
        } finally {
            restoreFetch();
        }

        // S6: varias listas, 0 restaurantes, sin búsqueda
        String listasJson6 = getMockListasJson(2);
        String detailJson6 = getMockDetailJson(1, "Lista 1", 0);
        FavoritesPage pageS6 = loginGoToHomeAndInjectMock(listasJson6, detailJson6);
        try {
            Assertions.assertEquals(2, pageS6.getListCount(), "S6: debe haber 2 listas");
            pageS6.openListByName("Lista 1");
            Assertions.assertTrue(pageS6.isDetailEmptyStateVisible(), "S6: el texto de lista vacía debe ser visible");
            Assertions.assertEquals(0, pageS6.getRestaurantCount(), "S6: debe haber 0 restaurantes");
        } finally {
            restoreFetch();
        }
    }

    // ── 3. S4 y S5: listas con restaurantes y búsquedas ──────────────────────────

    @Test
    @DisplayName("S4, S5 — listas con restaurantes y búsquedas")
    void testCasosConRestaurantes() throws Exception {
        // S4: varias listas, 1 restaurante, con búsqueda
        String listasJson4 = getMockListasJson(2);
        String detailJson4 = getMockDetailJson(1, "Lista 1", 1);
        FavoritesPage pageS4 = loginGoToHomeAndInjectMock(listasJson4, detailJson4);
        try {
            pageS4.openListByName("Lista 1");
            Assertions.assertEquals(1, pageS4.getRestaurantCount(), "S4: debe haber 1 restaurante inicialmente");

            // Buscar coincidencia
            pageS4.searchWithin("Uno");
            Assertions.assertEquals(1, pageS4.getRestaurantCount(), "S4: debe seguir habiendo 1 restaurante");

            // Buscar sin coincidencia
            pageS4.searchWithin("zzz_no_match");
            Assertions.assertEquals(0, pageS4.getRestaurantCount(),
                    "S4: debe haber 0 restaurantes tras búsqueda fallida");
        } finally {
            restoreFetch();
        }

        // S5: varias listas, varios restaurantes, con búsqueda
        String listasJson5 = getMockListasJson(2);
        String detailJson5 = getMockDetailJson(1, "Lista 1", 2);
        FavoritesPage pageS5 = loginGoToHomeAndInjectMock(listasJson5, detailJson5);
        try {
            pageS5.openListByName("Lista 1");
            Assertions.assertEquals(2, pageS5.getRestaurantCount(), "S5: debe haber 2 restaurantes inicialmente");

            // Buscar coincidencia parcial
            pageS5.searchWithin("Dos");
            Assertions.assertEquals(1, pageS5.getRestaurantCount(),
                    "S5: debe haber 1 restaurante visible al filtrar por 'Dos'");

            // Buscar sin coincidencia
            pageS5.searchWithin("zzz_no_match");
            Assertions.assertEquals(0, pageS5.getRestaurantCount(),
                    "S5: debe haber 0 restaurantes tras búsqueda fallida");
        } finally {
            restoreFetch();
        }
    }
}