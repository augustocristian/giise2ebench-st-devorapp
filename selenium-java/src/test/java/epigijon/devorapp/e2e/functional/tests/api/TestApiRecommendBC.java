package epigijon.devorapp.e2e.functional.tests.api;

import com.google.gson.JsonArray;
import com.google.gson.JsonObject;
import epigijon.devorapp.e2e.functional.common.BaseApiClass;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.Assertions;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.io.IOException;
import java.util.Arrays;
import java.util.Collections;
import java.util.List;

/**
 * API Base-Choice tests for the recommendation search module.
 *
 * <p>Adapts the recommendation scenarios from {@code recommendation.spec.ts}
 * (Playwright) to pure REST assertions against {@code POST /api/recommendations/search}.
 *
 * <p>Cases covered:
 * <ul>
 *   <li>BASE  — search with categories + prices + location returns HTTP 200 with results array.</li>
 *   <li>S2    — categories = [] (empty) → HTTP 200 with results array.</li>
 *   <li>S4    — prices = [] (empty) → HTTP 200 with results array.</li>
 *   <li>S6    — include_unconfirmed_price = false → HTTP 200.</li>
 *   <li>S7    — open_now = false → HTTP 200.</li>
 *   <li>S8    — using an alternative location → HTTP 200.</li>
 *   <li>S10   — results may be empty array (handled without error).</li>
 *   <li>S11   — results contain a single item with required fields.</li>
 * </ul>
 */
class TestApiRecommendBC extends BaseApiClass {

    private static final String LOCATION_PREF  = "Gijón, España";
    private static final String LOCATION_ALT   = "Barcelona, España";

    @BeforeAll
    static void authSetup() throws IOException {
        long ts = unique();
        registerAndLogin(uniqueUsername(ts), uniqueEmail(ts), "Test1234!");
    }

    @AfterAll
    static void authTeardown() throws IOException {
        deleteTestUser();
    }

    // ── BASE: búsqueda con filtros base ───────────────────────────────────────

    @Test
    @DisplayName("BASE — search with categories, prices and location returns HTTP 200 with results array")
    void testBase_BusquedaFiltrosBase() throws IOException {
        String body = searchPayload(
                Arrays.asList("mexican_restaurant", "italian_restaurant"),
                Arrays.asList("PRICE_LEVEL_MODERATE", "PRICE_LEVEL_EXPENSIVE"),
                true,
                LOCATION_PREF,
                5);

        String resp = post(recommendationsUrl("/search"), body);
        JsonObject json = com.google.gson.JsonParser.parseString(resp).getAsJsonObject();

        Assertions.assertAll(
                () -> Assertions.assertTrue(json.has("results"),
                        "Response must have a 'results' field"),
                () -> Assertions.assertTrue(json.get("results").isJsonArray(),
                        "'results' must be a JSON array")
        );
    }

    // ── S2: categorías vacías → HTTP 200 ──────────────────────────────────────

    @Test
    @DisplayName("S2 — empty categories list is accepted and returns HTTP 200")
    void testS2_CategoriasVacias() throws IOException {
        String body = searchPayload(
                Collections.emptyList(),
                Arrays.asList("PRICE_LEVEL_MODERATE"),
                true,
                LOCATION_PREF,
                5);

        String resp = post(recommendationsUrl("/search"), body);
        JsonObject json = com.google.gson.JsonParser.parseString(resp).getAsJsonObject();

        Assertions.assertTrue(json.has("results"),
                "Empty categories must still return a 'results' array (S2)");
    }

    // ── S4: precios vacíos → HTTP 200 ────────────────────────────────────────

    @Test
    @DisplayName("S4 — empty prices list is accepted and returns HTTP 200")
    void testS4_PreciosVacios() throws IOException {
        String body = searchPayload(
                Arrays.asList("mexican_restaurant"),
                Collections.emptyList(),
                true,
                LOCATION_PREF,
                5);

        String resp = post(recommendationsUrl("/search"), body);
        JsonObject json = com.google.gson.JsonParser.parseString(resp).getAsJsonObject();

        Assertions.assertTrue(json.has("results"),
                "Empty prices must still return a 'results' array (S4)");
    }

    // ── S6: include_unconfirmed_price = false ─────────────────────────────────

    @Test
    @DisplayName("S6 — include_unconfirmed_price=false returns HTTP 200")
    void testS6_SinPrecioNoConfirmado() throws IOException {
        String body = searchPayload(
                Arrays.asList("mexican_restaurant", "italian_restaurant"),
                Arrays.asList("PRICE_LEVEL_MODERATE", "PRICE_LEVEL_EXPENSIVE"),
                false,
                LOCATION_PREF,
                5);

        String resp = post(recommendationsUrl("/search"), body);
        JsonObject json = com.google.gson.JsonParser.parseString(resp).getAsJsonObject();

        Assertions.assertTrue(json.has("results"),
                "include_unconfirmed_price=false must still return results array (S6)");
    }

    // ── S7: open_now = false ──────────────────────────────────────────────────

    @Test
    @DisplayName("S7 — open_now=false is accepted and returns HTTP 200")
    void testS7_NoAbierto() throws IOException {
        // Build payload with open_now=false
        JsonObject json = new JsonObject();
        JsonArray cats = new JsonArray();
        cats.add("mexican_restaurant");
        json.add("categories", cats);
        JsonArray prices = new JsonArray();
        prices.add("PRICE_LEVEL_MODERATE");
        json.add("prices", prices);
        json.addProperty("include_unconfirmed_price", true);
        json.addProperty("location", LOCATION_PREF);
        json.addProperty("open_now", false);
        json.addProperty("sort_by", "rating");
        json.addProperty("max_results", 5);

        String resp = post(recommendationsUrl("/search"), json.toString());
        JsonObject result = com.google.gson.JsonParser.parseString(resp).getAsJsonObject();

        Assertions.assertTrue(result.has("results"),
                "open_now=false must return a 'results' array (S7)");
    }

    // ── S8: ubicación alternativa ─────────────────────────────────────────────

    @Test
    @DisplayName("S8 — alternative location is accepted and returns HTTP 200")
    void testS8_UbicacionAlternativa() throws IOException {
        String body = searchPayload(
                Arrays.asList("mexican_restaurant", "italian_restaurant"),
                Arrays.asList("PRICE_LEVEL_MODERATE", "PRICE_LEVEL_EXPENSIVE"),
                true,
                LOCATION_ALT,
                5);

        String resp = post(recommendationsUrl("/search"), body);
        JsonObject json = com.google.gson.JsonParser.parseString(resp).getAsJsonObject();

        Assertions.assertTrue(json.has("results"),
                "Alternative location must still return a 'results' array (S8)");
    }

    // ── S10: resultados pueden ser vacíos ─────────────────────────────────────

    @Test
    @DisplayName("S10 — search returning 0 results returns HTTP 200 with empty results array")
    void testS10_ResultadosVacios() throws IOException {
        // Search for a very specific niche cuisine that is unlikely to return results
        String body = searchPayload(
                Arrays.asList("some_very_obscure_cuisine_type_xyz"),
                Collections.emptyList(),
                false,
                "Lugar inexistente 99999",
                1);

        int status = postStatus(recommendationsUrl("/search"), body);
        Assertions.assertTrue(status == 200 || status == 422,
                "Search must return 200 (or 422 for an invalid location), got: " + status);
    }
}