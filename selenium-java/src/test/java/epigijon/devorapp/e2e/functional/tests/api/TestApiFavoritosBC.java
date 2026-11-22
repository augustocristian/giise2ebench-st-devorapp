package epigijon.devorapp.e2e.functional.tests.api;

import com.google.gson.JsonArray;
import com.google.gson.JsonObject;
import epigijon.devorapp.e2e.functional.common.BaseApiClass;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.Assertions;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.io.IOException;

/** API Base-Choice tests for the favorites module (see @DisplayName for scenario ids). */
class TestApiFavoritosBC extends BaseApiClass {

    private static final String PLACE_A = "MOCK_PLACE_101";
    private static final String PLACE_B = "MOCK_PLACE_102";
    private static final String PLACE_C = "MOCK_PLACE_103";

    private int listaId;

    @BeforeAll
    static void authSetup() throws IOException {
        long ts = unique();
        registerAndLogin(uniqueUsername(ts), uniqueEmail(ts), "Test1234!");
    }

    @BeforeEach
    void createFreshList() throws IOException {
        listaId = createLista("BCTest" + unique());
    }

    @AfterAll
    static void authTeardown() throws IOException {
        deleteTestUser();
    }

    @Test
    @DisplayName("BASE — adding 3 restaurants to a list returns all 3 in the detail endpoint")
    void testBase_SeveralRestaurants() throws IOException {
        post(favoritosUrl("/listas/" + listaId), favoritoPayload(PLACE_A));
        post(favoritosUrl("/listas/" + listaId), favoritoPayload(PLACE_B));
        post(favoritosUrl("/listas/" + listaId), favoritoPayload(PLACE_C));

        JsonObject detail = getJsonObject(favoritosUrl("/listas/" + listaId));
        JsonArray restaurantes = detail.getAsJsonArray("restaurantes");

        Assertions.assertEquals(3, restaurantes.size(),
                "After adding 3 restaurants the detail must return exactly 3");
    }

    @Test
    @DisplayName("Case 2 — a new list has an empty restaurantes array")
    void testCase2_EmptyList() throws IOException {
        JsonObject detail = getJsonObject(favoritosUrl("/listas/" + listaId));
        JsonArray restaurantes = detail.getAsJsonArray("restaurantes");

        Assertions.assertTrue(restaurantes.isEmpty(),
                "A brand-new list must have 0 restaurants");
    }

    @Test
    @DisplayName("Case 3 — adding 1 restaurant returns a restaurantes array of size 1")
    void testCase3_OneRestaurant() throws IOException {
        post(favoritosUrl("/listas/" + listaId), favoritoPayload(PLACE_A));

        JsonObject detail = getJsonObject(favoritosUrl("/listas/" + listaId));
        JsonArray restaurantes = detail.getAsJsonArray("restaurantes");

        Assertions.assertEquals(1, restaurantes.size(),
                "After adding 1 restaurant the detail must return exactly 1");
        Assertions.assertEquals(PLACE_A,
                restaurantes.get(0).getAsJsonObject().get("place_id").getAsString(),
                "The place_id must match the added restaurant");
    }

    @Test
    @DisplayName("Case 4 — GET /api/favoritos/listas returns a non-empty array with the created list")
    void testCase4_GetLists() throws IOException {
        JsonArray listas = getJsonArray(favoritosUrl("/listas"));

        Assertions.assertFalse(listas.isEmpty(),
                "The listas array must not be empty after creating a list");
        boolean found = false;
        for (com.google.gson.JsonElement el : listas) {
            if (el.getAsJsonObject().get("id").getAsInt() == listaId) {
                found = true;
                break;
            }
        }
        Assertions.assertTrue(found,
                "The created list id=" + listaId + " must appear in GET /api/favoritos/listas");
    }

    @Test
    @DisplayName("Case 5 — deleting a restaurant removes it from the list detail")
    void testCase5_DeleteRestaurant() throws IOException {
        int favIdA = addFavorito(listaId, PLACE_A);
        post(favoritosUrl("/listas/" + listaId), favoritoPayload(PLACE_B));

        int deleteStatus = delete(favoritosUrl("/" + favIdA));
        Assertions.assertEquals(204, deleteStatus,
                "DELETE favorito must return HTTP 204");

        JsonArray restaurantes = getJsonObject(favoritosUrl("/listas/" + listaId))
                .getAsJsonArray("restaurantes");

        Assertions.assertAll(
                () -> Assertions.assertFalse(containsByField(restaurantes, "place_id", PLACE_A),
                        "Deleted restaurant (PLACE_A) must not appear in list detail"),
                () -> Assertions.assertTrue(containsByField(restaurantes, "place_id", PLACE_B),
                        "Non-deleted restaurant (PLACE_B) must still appear")
        );
    }

    @Test
    @DisplayName("Case 6 — deleting a list removes it from GET /api/favoritos/listas")
    void testCase6_DeleteList() throws IOException {
        int status = delete(favoritosUrl("/listas/" + listaId));
        Assertions.assertEquals(204, status, "DELETE lista must return HTTP 204");

        JsonArray listas = getJsonArray(favoritosUrl("/listas"));
        boolean stillPresent = false;
        for (com.google.gson.JsonElement el : listas) {
            if (el.getAsJsonObject().get("id").getAsInt() == listaId) {
                stillPresent = true;
                break;
            }
        }
        Assertions.assertFalse(stillPresent,
                "Deleted list must not appear in GET /api/favoritos/listas");

        // Prevent @BeforeEach listaId from causing double-delete issues
        listaId = -1;
    }
}