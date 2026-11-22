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

/** API tests for the save-for-later endpoints (/api/v1/saved-for-later): POST 201, GET 200, DELETE 204. */
class TestApiSavedForLater extends BaseApiClass {

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
    @DisplayName("POST /api/v1/saved-for-later returns HTTP 201 with id, place_id and already_saved false")
    void testAddToSaved() throws IOException {
        String placeId = "test_place_" + unique();

        int status = postStatus(savedUrl(""), savedPayload(placeId));
        Assertions.assertEquals(201, status, "Adding to saved-for-later must return HTTP 201");

        String response = post(savedUrl(""), savedPayload(placeId));
        JsonObject entry = JsonParser.parseString(response).getAsJsonObject();
        Assertions.assertAll(
                () -> Assertions.assertTrue(entry.get("id").getAsInt() > 0,
                        "entry id must be positive"),
                () -> Assertions.assertEquals(placeId, entry.get("place_id").getAsString(),
                        "place_id must match")
        );
    }

    @Test
    @DisplayName("POST /api/v1/saved-for-later twice for the same place returns already_saved true on second call")
    void testAddSameRestaurantTwice() throws IOException {
        String placeId = "test_place_" + unique();

        String firstResponse = post(savedUrl(""), savedPayload(placeId));
        JsonObject first = JsonParser.parseString(firstResponse).getAsJsonObject();
        Assertions.assertFalse(first.get("already_saved").getAsBoolean(),
                "First add must have already_saved false");

        ApiResponse secondCall = postFull(savedUrl(""), savedPayload(placeId));
        Assertions.assertEquals(200, secondCall.status, "Already-saved POST must return HTTP 200");
        JsonObject second = secondCall.json();
        Assertions.assertTrue(second.get("already_saved").getAsBoolean(),
                "Second add of same place must have already_saved true");
    }

    @Test
    @DisplayName("DELETE /api/v1/saved-for-later/{entry_id} returns HTTP 204")
    void testDeleteFromSaved() throws IOException {
        int entryId = addSaved("test_place_" + unique());

        int status = delete(savedUrl("/" + entryId));
        Assertions.assertEquals(204, status, "DELETE saved-for-later entry must return HTTP 204");
    }

    @Test
    @DisplayName("GET /api/v1/saved-for-later returns HTTP 200 with a paginated envelope")
    void testGetSaved() throws IOException {
        int status = getStatus(savedUrl(""));
        Assertions.assertEquals(200, status, "GET saved-for-later must return HTTP 200");

        JsonArray entries = getItems(savedUrl(""));
        Assertions.assertNotNull(entries, "Response must contain an items array");
    }
}