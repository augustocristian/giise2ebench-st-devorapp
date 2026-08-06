package epigijon.devorapp.e2e.functional.tests.e2e;

import com.google.gson.JsonObject;
import epigijon.devorapp.e2e.functional.common.BaseLoggedClass;
import epigijon.devorapp.e2e.functional.pages.HistoryPage;
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
 * Browser tests for the DevorApp history page ({@code /history}).
 *
 * <p>
 * Adapts {@code history.spec.ts} (Playwright) to Selenium + JUnit 5.
 * History entries are created via the API so the browser tests can verify
 * grouping by month, card counts, and the search/filter behaviour.
 *
 * <p>
 * Base-Choice coverage:
 * <ul>
 * <li>BASE — multiple months, multiple restaurants, no search filter.</li>
 * <li>S2 — empty history shows 0 groups and 0 cards.</li>
 * <li>S3 — 1 month with multiple restaurants.</li>
 * <li>S5 — exactly 1 restaurant in history.</li>
 * <li>S6 — search term filters cards and hides non-matching months.</li>
 * </ul>
 */
class TestHistoryView extends BaseLoggedClass {

    private static final String PLACE_A = "ChIJN1t_tDeuEmsRUsoyG83frY4";
    private static final String PLACE_B = "ChIJdd4hrwug2EcRmSrV3Vo6llI";

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

    private void injectHistorialMock(String jsonResponse) {
        ((org.openqa.selenium.JavascriptExecutor) driver).executeScript(
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
        ((org.openqa.selenium.JavascriptExecutor) driver).executeScript(
                "if (window.originalFetch) { window.fetch = window.originalFetch; }");
    }

    private String getMockHistorialJson(String date1, String date2) {
        return "[" +
                "{\"id\":1,\"user_id\":\"uid\",\"place_id\":\"ChIJN1t_tDeuEmsRUsoyG83frY4\",\"fecha_acceso\":\"" + date1
                + "\"," +
                "\"restaurant\":{\"id\":\"ChIJN1t_tDeuEmsRUsoyG83frY4\",\"name\":\"Restaurante Uno\",\"rating\":4.5,\"user_ratings_total\":100,\"types\":[\"restaurant\"],\"address\":\"Calle Falsa 123\",\"main_photo\":null,\"summary\":\"Excelente\",\"open_now\":true}},"
                +
                "{\"id\":2,\"user_id\":\"uid\",\"place_id\":\"ChIJdd4hrwug2EcRmSrV3Vo6llI\",\"fecha_acceso\":\"" + date2
                + "\"," +
                "\"restaurant\":{\"id\":\"ChIJdd4hrwug2EcRmSrV3Vo6llI\",\"name\":\"Restaurante Dos\",\"rating\":4.0,\"user_ratings_total\":50,\"types\":[\"restaurant\"],\"address\":\"Avenida Siempreviva 742\",\"main_photo\":null,\"summary\":\"Agradable\",\"open_now\":false}}"
                +
                "]";
    }

    private String getSingleMockEntryJson(String date) {
        return "[" +
                "{\"id\":1,\"user_id\":\"uid\",\"place_id\":\"ChIJN1t_tDeuEmsRUsoyG83frY4\",\"fecha_acceso\":\"" + date
                + "\"," +
                "\"restaurant\":{\"id\":\"ChIJN1t_tDeuEmsRUsoyG83frY4\",\"name\":\"Restaurante Uno\",\"rating\":4.5,\"user_ratings_total\":100,\"types\":[\"restaurant\"],\"address\":\"Calle Falsa 123\",\"main_photo\":null,\"summary\":\"Excelente\",\"open_now\":true}}"
                +
                "]";
    }

    private HistoryPage loginGoToHomeAndInjectMock(String jsonResponse) throws Exception {
        clearSessionAndLogin();
        new LoginPage(driver, waiter)
                .enterIdentifier(testEmail)
                .enterPassword(testPassword)
                .submitLogin();

        injectHistorialMock(jsonResponse);

        new SideMenuPage(driver, waiter).open();
        new org.openqa.selenium.support.ui.WebDriverWait(driver, java.time.Duration.ofSeconds(5))
                .until(org.openqa.selenium.support.ui.ExpectedConditions.elementToBeClickable(
                        By.xpath("//button[contains(.,'Historial')]")))
                .click();

        return new HistoryPage(driver, waiter);
    }

    // ── BASE: múltiples entradas en historial
    // ──────────────────────────────────────────

    @Test
    @DisplayName("BASE — history page shows at least 1 group and multiple restaurant cards")
    void testBase_MultiplesEntradas() throws Exception {
        String mockJson = getMockHistorialJson("2026-05-15T12:00:00Z", "2026-06-15T12:00:00Z");
        HistoryPage page = loginGoToHomeAndInjectMock(mockJson);

        try {
            Assertions.assertEquals(2, page.getGroupCount(), "Debe haber 2 grupos");

            // Expand the second group (JUNIO 2026 is collapsed by default since MAYO 2026
            // is index 0 in mock)
            page.toggleGroup("JUNIO 2026");

            Assertions.assertEquals(2, page.getCardCount(), "Debe haber 2 tarjetas de restaurante visibles");
        } finally {
            restoreFetch();
        }
    }

    // ── S2, S3 y S5 condensados: vacío, 1 mes varios restaurantes, 1 restaurante
    // ────

    @Test
    @DisplayName("debe gestionar historial vacío (S2), con 1 restaurante (S5) y 1 mes con varios (S3)")
    void testCasosVacioYUnitario() throws Exception {
        // S2: empty history
        HistoryPage pageEmpty = loginGoToHomeAndInjectMock("[]");
        try {
            Assertions.assertEquals(0, pageEmpty.getGroupCount(), "S2: debe haber 0 grupos");
            Assertions.assertEquals(0, pageEmpty.getCardCount(), "S2: debe haber 0 tarjetas");
        } finally {
            restoreFetch();
        }

        // S5: exactly 1 restaurant entry (S5)
        String oneEntryJson = getSingleMockEntryJson("2026-05-15T12:00:00Z");
        HistoryPage pageOne = loginGoToHomeAndInjectMock(oneEntryJson);
        try {
            Assertions.assertEquals(1, pageOne.getGroupCount(), "S5: debe haber 1 grupo");
            Assertions.assertEquals(1, pageOne.getCardCount(), "S5: debe haber 1 tarjeta");
        } finally {
            restoreFetch();
        }

        // S3: 1 month with multiple restaurants (S3)
        String sameMonthJson = getMockHistorialJson("2026-05-15T12:00:00Z", "2026-05-20T12:00:00Z");
        HistoryPage pageSameMonth = loginGoToHomeAndInjectMock(sameMonthJson);
        try {
            Assertions.assertEquals(1, pageSameMonth.getGroupCount(), "S3: debe haber 1 grupo");
            Assertions.assertEquals(2, pageSameMonth.getCardCount(), "S3: debe haber 2 tarjetas");
        } finally {
            restoreFetch();
        }
    }

    // ── S6: búsqueda filtra por nombre
    // ────────────────────────────────────────────

    @Test
    @DisplayName("S6 — searching in history filters cards; a non-matching term shows 0 cards")
    void testBusquedaFiltros() throws Exception {
        String mockJson = getMockHistorialJson("2026-05-15T12:00:00Z", "2026-06-15T12:00:00Z");
        HistoryPage page = loginGoToHomeAndInjectMock(mockJson);
        try {
            // Expand JUNIO 2026
            page.toggleGroup("JUNIO 2026");
            Assertions.assertEquals(2, page.getCardCount(), "Debe haber 2 tarjetas inicialmente");

            // Buscar "Uno"
            page.search("Uno");
            Assertions.assertEquals(1, page.getGroupCount(), "Debe haber 1 grupo después de buscar 'Uno'");
            Assertions.assertEquals(1, page.getCardCount(), "Debe haber 1 tarjeta después de buscar 'Uno'");
            Assertions.assertEquals("Restaurante Uno", page.getCardNameAt(0),
                    "La tarjeta visible debe ser 'Restaurante Uno'");

            // Buscar algo que no existe
            page.search("zzz_nada_xyzzy_no_match");
            Assertions.assertEquals(0, page.getGroupCount(), "Debe haber 0 grupos tras una búsqueda sin coincidencias");
            Assertions.assertEquals(0, page.getCardCount(),
                    "Debe haber 0 tarjetas tras una búsqueda sin coincidencias");
        } finally {
            restoreFetch();
        }
    }
}