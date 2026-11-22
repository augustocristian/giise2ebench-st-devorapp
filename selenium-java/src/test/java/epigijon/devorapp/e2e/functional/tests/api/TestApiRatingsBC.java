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

/** API Base-Choice tests for the ratings (ratings) module (see @DisplayName for scenario ids). */
class TestApiRatingsBC extends BaseApiClass {

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
    @DisplayName("BASE — full rating with all aspects at max stored and retrieved correctly")
    void testBase_FullRating() throws IOException {
        String placeId = "bc_base_" + unique();
        JsonObject val = createRating(placeId, 5, 5, 5, 5,
                "Excelente servicio y comida deliciosa");

        Assertions.assertAll(
                () -> Assertions.assertTrue(val.get("id").getAsInt() > 0, "id must be positive"),
                () -> Assertions.assertEquals(5, val.get("quality").getAsInt(),  "quality=5"),
                () -> Assertions.assertEquals(5, val.get("price").getAsInt(),   "price=5"),
                () -> Assertions.assertEquals(5, val.get("hygiene").getAsInt(),  "hygiene=5"),
                () -> Assertions.assertEquals(5, val.get("service").getAsInt(),    "service=5"),
                () -> Assertions.assertEquals("Excelente servicio y comida deliciosa",
                        val.get("comment").getAsString(), "comment matches")
        );
    }

    @Test
    @DisplayName("S3 — quality=1, price=3, hygiene=5, service=5 stored correctly")
    void testS3_LowQualityMidPrice() throws IOException {
        String placeId = "bc_s3_" + unique();
        JsonObject val = createRating(placeId, 1, 3, 5, 5, "OK");

        Assertions.assertAll(
                () -> Assertions.assertEquals(1, val.get("quality").getAsInt(), "quality=1"),
                () -> Assertions.assertEquals(3, val.get("price").getAsInt(),  "price=3"),
                () -> Assertions.assertEquals(5, val.get("hygiene").getAsInt(), "hygiene=5"),
                () -> Assertions.assertEquals(5, val.get("service").getAsInt(),   "service=5")
        );
    }

    @Test
    @DisplayName("S4 — quality=3, price=1, hygiene=5, service=5 stored correctly")
    void testS4_MidQualityLowPrice() throws IOException {
        String placeId = "bc_s4_" + unique();
        JsonObject val = createRating(placeId, 3, 1, 5, 5, "OK");

        Assertions.assertAll(
                () -> Assertions.assertEquals(3, val.get("quality").getAsInt(), "quality=3"),
                () -> Assertions.assertEquals(1, val.get("price").getAsInt(),  "price=1")
        );
    }

    @Test
    @DisplayName("S9 — quality=5, price=5, hygiene=1, service=3 stored correctly")
    void testS9_LowHygieneMidService() throws IOException {
        String placeId = "bc_s9_" + unique();
        JsonObject val = createRating(placeId, 5, 5, 1, 3, "Regular hygiene");

        Assertions.assertAll(
                () -> Assertions.assertEquals(1, val.get("hygiene").getAsInt(), "hygiene=1"),
                () -> Assertions.assertEquals(3, val.get("service").getAsInt(),   "service=3")
        );
    }

    @Test
    @DisplayName("S10 — quality=5, price=5, hygiene=3, service=1 stored correctly")
    void testS10_MidHygieneLowService() throws IOException {
        String placeId = "bc_s10_" + unique();
        JsonObject val = createRating(placeId, 5, 5, 3, 1, "Trato mejorable");

        Assertions.assertAll(
                () -> Assertions.assertEquals(3, val.get("hygiene").getAsInt(), "hygiene=3"),
                () -> Assertions.assertEquals(1, val.get("service").getAsInt(),   "service=1")
        );
    }

    @Test
    @DisplayName("S14 — rating with empty comment is accepted (HTTP 201)")
    void testS14_EmptyComment() throws IOException {
        String placeId = "bc_s14_" + unique();
        int status = put(restaurantUrl(placeId, "/rating"),
                ratingPayload(5, 5, 5, 5, ""));

        Assertions.assertEquals(201, status,
                "A rating with an empty comment must return HTTP 201");
    }

    @Test
    @DisplayName("Deleting a rating removes it from GET /api/v1/ratings")
    void testDeleteRating() throws IOException {
        String placeId = "bc_del_" + unique();
        createRating(placeId, 4, 3, 5, 4, "A delete test");

        int deleteStatus = delete(restaurantUrl(placeId, "/rating"));
        Assertions.assertEquals(204, deleteStatus, "DELETE must return HTTP 204");

        JsonArray all = getItems(ratingsUrl(""));
        boolean found = false;
        for (com.google.gson.JsonElement el : all) {
            if (placeId.equals(el.getAsJsonObject().get("place_id").getAsString())) {
                found = true;
                break;
            }
        }
        Assertions.assertFalse(found, "Deleted rating must not appear in GET list");
    }
}