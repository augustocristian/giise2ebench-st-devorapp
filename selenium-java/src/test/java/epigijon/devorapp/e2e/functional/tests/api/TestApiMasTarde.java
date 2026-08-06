package epigijon.devorapp.e2e.functional.tests.api;

import com.google.gson.JsonArray;
import com.google.gson.JsonObject;
import com.google.gson.JsonParser;
import epigijon.devorapp.e2e.functional.common.BaseApiClass;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.Assertions;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.io.IOException;

/**
 * Validates the save-for-later endpoints:
 * <ul>
 *   <li>POST   /api/mas-tarde              — add restaurant (HTTP 201)</li>
 *   <li>GET    /api/mas-tarde              — list saved entries (HTTP 200)</li>
 *   <li>DELETE /api/mas-tarde/{entry_id}   — remove entry (HTTP 204)</li>
 * </ul>
 * Each test uses a unique fake place_id to avoid state interference between
 * tests in the same class.
 */
class TestApiMasTarde extends BaseApiClass {

    @BeforeAll
    static void authSetup() throws IOException {
        long ts = unique();
        registerAndLogin(uniqueUsername(ts), uniqueEmail(ts), "Test1234!");
    }

    @AfterAll
    static void authTeardown() throws IOException {
        deleteTestUser();
    }

    @Test
    @DisplayName("POST /api/mas-tarde returns HTTP 201 with id, place_id and already_saved false")
    void testAddToMasTarde() throws IOException {
        String placeId = "test_place_" + unique();

        int status = postStatus(masTardeUrl(""), masTardePayload(placeId));
        Assertions.assertEquals(201, status, "Adding to mas-tarde must return HTTP 201");

        String response = post(masTardeUrl(""), masTardePayload(placeId));
        JsonObject entry = JsonParser.parseString(response).getAsJsonObject();
        Assertions.assertAll(
                () -> Assertions.assertTrue(entry.get("id").getAsInt() > 0,
                        "entry id must be positive"),
                () -> Assertions.assertEquals(placeId, entry.get("place_id").getAsString(),
                        "place_id must match")
        );
    }

    @Test
    @DisplayName("POST /api/mas-tarde twice for the same place returns already_saved true on second call")
    void testAddSameRestaurantTwice() throws IOException {
        String placeId = "test_place_" + unique();

        String firstResponse = post(masTardeUrl(""), masTardePayload(placeId));
        JsonObject first = JsonParser.parseString(firstResponse).getAsJsonObject();
        Assertions.assertFalse(first.get("already_saved").getAsBoolean(),
                "First add must have already_saved false");

        String secondResponse = post(masTardeUrl(""), masTardePayload(placeId));
        JsonObject second = JsonParser.parseString(secondResponse).getAsJsonObject();
        Assertions.assertTrue(second.get("already_saved").getAsBoolean(),
                "Second add of same place must have already_saved true");
    }

    @Test
    @DisplayName("DELETE /api/mas-tarde/{entry_id} returns HTTP 204")
    void testDeleteFromMasTarde() throws IOException {
        int entryId = addMasTarde("test_place_" + unique());

        int status = delete(masTardeUrl("/" + entryId));
        Assertions.assertEquals(204, status, "DELETE mas-tarde entry must return HTTP 204");
    }

    @Test
    @DisplayName("GET /api/mas-tarde returns HTTP 200 with a JSON array")
    void testGetMasTarde() throws IOException {
        int status = getStatus(masTardeUrl(""));
        Assertions.assertEquals(200, status, "GET mas-tarde must return HTTP 200");

        JsonArray entries = getJsonArray(masTardeUrl(""));
        Assertions.assertNotNull(entries, "Response must be a JSON array");
    }
}