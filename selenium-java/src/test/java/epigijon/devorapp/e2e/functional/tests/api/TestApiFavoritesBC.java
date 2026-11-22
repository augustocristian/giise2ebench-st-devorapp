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
class TestApiFavoritesBC extends BaseApiClass {

    private static final String PLACE_A = "MOCK_PLACE_101";
    private static final String PLACE_B = "MOCK_PLACE_102";
    private static final String PLACE_C = "MOCK_PLACE_103";

    private int listId;

    @BeforeAll
    static void authSetup() throws IOException {
        long ts = unique();
        registerAndLogin(uniqueUsername(ts), uniqueEmail(ts), "Test1234!");
    }

    @BeforeEach
    void createFreshList() throws IOException {
        listId = createList("BCTest" + unique());
    }

    @AfterAll
    static void authTeardown() throws IOException {
        deleteTestUser();
    }

    @Test
    @DisplayName("BASE — adding 3 restaurants to a list returns all 3 in the detail endpoint")
    void testBase_SeveralRestaurants() throws IOException {
        post(favoritesUrl("/lists/" + listId + "/restaurants"), favoritePayload(PLACE_A));
        post(favoritesUrl("/lists/" + listId + "/restaurants"), favoritePayload(PLACE_B));
        post(favoritesUrl("/lists/" + listId + "/restaurants"), favoritePayload(PLACE_C));

        JsonObject detail = getJsonObject(favoritesUrl("/lists/" + listId));
        JsonArray restaurants = detail.getAsJsonArray("restaurants");

        Assertions.assertEquals(3, restaurants.size(),
                "After adding 3 restaurants the detail must return exactly 3");
    }

    @Test
    @DisplayName("Case 2 — a new list has an empty restaurants array")
    void testCase2_EmptyList() throws IOException {
        JsonObject detail = getJsonObject(favoritesUrl("/lists/" + listId));
        JsonArray restaurants = detail.getAsJsonArray("restaurants");

        Assertions.assertTrue(restaurants.isEmpty(),
                "A brand-new list must have 0 restaurants");
    }

    @Test
    @DisplayName("Case 3 — adding 1 restaurant returns a restaurants array of size 1")
    void testCase3_OneRestaurant() throws IOException {
        post(favoritesUrl("/lists/" + listId + "/restaurants"), favoritePayload(PLACE_A));

        JsonObject detail = getJsonObject(favoritesUrl("/lists/" + listId));
        JsonArray restaurants = detail.getAsJsonArray("restaurants");

        Assertions.assertEquals(1, restaurants.size(),
                "After adding 1 restaurant the detail must return exactly 1");
        Assertions.assertEquals(PLACE_A,
                restaurants.get(0).getAsJsonObject().get("place_id").getAsString(),
                "The place_id must match the added restaurant");
    }

    @Test
    @DisplayName("Case 4 — GET /api/v1/favorites/lists returns a non-empty array with the created list")
    void testCase4_GetLists() throws IOException {
        JsonArray lists = getJsonArray(favoritesUrl("/lists"));

        Assertions.assertFalse(lists.isEmpty(),
                "The lists array must not be empty after creating a list");
        boolean found = false;
        for (com.google.gson.JsonElement el : lists) {
            if (el.getAsJsonObject().get("id").getAsInt() == listId) {
                found = true;
                break;
            }
        }
        Assertions.assertTrue(found,
                "The created list id=" + listId + " must appear in GET /api/v1/favorites/lists");
    }

    @Test
    @DisplayName("Case 5 — deleting a restaurant removes it from the list detail")
    void testCase5_DeleteRestaurant() throws IOException {
        int favIdA = addFavorite(listId, PLACE_A);
        post(favoritesUrl("/lists/" + listId + "/restaurants"), favoritePayload(PLACE_B));

        int deleteStatus = deleteFavorite(listId, favIdA);
        Assertions.assertEquals(204, deleteStatus,
                "DELETE favorite must return HTTP 204");

        JsonArray restaurants = getJsonObject(favoritesUrl("/lists/" + listId))
                .getAsJsonArray("restaurants");

        Assertions.assertAll(
                () -> Assertions.assertFalse(containsByField(restaurants, "place_id", PLACE_A),
                        "Deleted restaurant (PLACE_A) must not appear in list detail"),
                () -> Assertions.assertTrue(containsByField(restaurants, "place_id", PLACE_B),
                        "Non-deleted restaurant (PLACE_B) must still appear")
        );
    }

    @Test
    @DisplayName("Case 6 — deleting a list removes it from GET /api/v1/favorites/lists")
    void testCase6_DeleteList() throws IOException {
        int status = delete(favoritesUrl("/lists/" + listId));
        Assertions.assertEquals(204, status, "DELETE lista must return HTTP 204");

        JsonArray lists = getJsonArray(favoritesUrl("/lists"));
        boolean stillPresent = false;
        for (com.google.gson.JsonElement el : lists) {
            if (el.getAsJsonObject().get("id").getAsInt() == listId) {
                stillPresent = true;
                break;
            }
        }
        Assertions.assertFalse(stillPresent,
                "Deleted list must not appear in GET /api/v1/favorites/lists");

        // Prevent @BeforeEach listId from causing double-delete issues
        listId = -1;
    }
}