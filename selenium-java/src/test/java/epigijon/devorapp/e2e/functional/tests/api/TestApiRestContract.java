package epigijon.devorapp.e2e.functional.tests.api;

import com.google.gson.JsonArray;
import com.google.gson.JsonObject;
import com.google.gson.JsonParser;
import epigijon.devorapp.e2e.functional.common.BaseApiClass;
import org.apache.http.client.methods.CloseableHttpResponse;
import org.apache.http.client.methods.HttpDelete;
import org.apache.http.client.methods.HttpGet;
import org.apache.http.client.methods.HttpPost;
import org.apache.http.client.methods.HttpUriRequest;
import org.apache.http.client.utils.URIBuilder;
import org.apache.http.entity.ContentType;
import org.apache.http.entity.StringEntity;
import org.apache.http.impl.client.BasicCookieStore;
import org.apache.http.impl.client.CloseableHttpClient;
import org.apache.http.impl.client.HttpClients;
import org.apache.http.util.EntityUtils;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.Assertions;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.io.IOException;

/** API tests for the REST conventions of /api/v1: Location headers, 409/422 codes, upsert, pagination, likes. */
class TestApiRestContract extends BaseApiClass {

    private static final String PASSWORD = "Test1234!";
    private static final String PLACE = "MOCK_PLACE_101";

    @BeforeAll
    static void authSetup() throws IOException {
        long ts = unique();
        registerAndLogin(uniqueUsername(ts), uniqueEmail(ts), PASSWORD);
    }

    @AfterAll
    static void authTeardown() throws IOException {
        deleteTestUser();
    }

    @Test
    @DisplayName("REST1 — POST /favorites/lists returns 201 with Location /api/v1/favorites/lists/{id}")
    void testCreateListLocation() throws IOException {
        ApiResponse response = postFull(favoritesUrl("/lists"), listPayload("Loc" + unique()));
        int id = response.json().get("id").getAsInt();

        Assertions.assertEquals(201, response.status, "Creating a list must return HTTP 201");
        Assertions.assertNotNull(response.location, "Location header must be present");
        Assertions.assertTrue(response.location.endsWith("/api/v1/favorites/lists/" + id),
                "Location must point to the new list, got: " + response.location);
    }

    @Test
    @DisplayName("REST2 — POST /favorites/lists with a duplicate name returns 409 and an empty name returns 422")
    void testListDuplicateAndInvalid() throws IOException {
        String name = "Dup" + unique();
        Assertions.assertEquals(201, postFull(favoritesUrl("/lists"), listPayload(name)).status,
                "First creation must return HTTP 201");

        Assertions.assertEquals(409, postFull(favoritesUrl("/lists"), listPayload(name)).status,
                "Duplicate list name must return HTTP 409");
        Assertions.assertEquals(422, postFull(favoritesUrl("/lists"), listPayload("")).status,
                "Empty list name must return HTTP 422");
    }

    @Test
    @DisplayName("REST3 — favorites live under their list: 201 + Location, duplicate 409, DELETE 204 then 404")
    void testFavoriteUnderList() throws IOException {
        int listId = createList("Fav" + unique());
        String base = favoritesUrl("/lists/" + listId + "/restaurants");

        ApiResponse added = postFull(base, favoritePayload(PLACE));
        int favId = added.json().get("id").getAsInt();
        Assertions.assertEquals(201, added.status, "Adding a favorite must return HTTP 201");
        Assertions.assertTrue(added.location != null && added.location.endsWith(
                        "/api/v1/favorites/lists/" + listId + "/restaurants/" + favId),
                "Location must point to the favorite under its list, got: " + added.location);

        Assertions.assertEquals(409, postFull(base, favoritePayload(PLACE)).status,
                "Adding the same restaurant twice must return HTTP 409");
        Assertions.assertEquals(204, deleteFavorite(listId, favId), "DELETE favorite must return 204");
        Assertions.assertEquals(404, deleteFavorite(listId, favId),
                "Deleting an already removed favorite must return 404");
    }

    @Test
    @DisplayName("REST4 — POST /history returns 201 with Location and GET /history/{id} returns the entry")
    void testHistoryLocationAndGetOne() throws IOException {
        ApiResponse created = postFull(historyUrl(""), historyPayload(PLACE));
        int id = created.json().get("id").getAsInt();

        Assertions.assertEquals(201, created.status, "Adding to history must return HTTP 201");
        Assertions.assertTrue(created.location != null && created.location.endsWith("/api/v1/history/" + id),
                "Location must point to the entry, got: " + created.location);

        ApiResponse one = getFull(historyUrl("/" + id));
        Assertions.assertEquals(200, one.status, "GET /history/{id} must return 200");
        Assertions.assertEquals(PLACE, one.json().get("place_id").getAsString(), "place_id must match");
    }

    @Test
    @DisplayName("REST5 — GET /history/{id} with an unknown id returns 404")
    void testHistoryUnknownId() throws IOException {
        Assertions.assertEquals(404, getFull(historyUrl("/999999999")).status,
                "An unknown history entry must return HTTP 404");
    }

    @Test
    @DisplayName("REST6 — registering a duplicate username returns 409")
    void testRegisterDuplicateUsername() throws IOException {
        long ts = unique();
        String username = uniqueUsername(ts);
        Assertions.assertEquals(201, postStatus(authUrl("/users"),
                registerPayload(username, uniqueEmail(ts), PASSWORD, "Ana", "Perez", "")),
                "First registration must return HTTP 201");

        int second = postStatus(authUrl("/users"),
                registerPayload(username, uniqueEmail(ts + 1), PASSWORD, "Ana", "Perez", ""));
        Assertions.assertEquals(409, second, "Duplicate username must return HTTP 409");
    }

    @Test
    @DisplayName("REST7 — registering with an invalid email or a weak password returns 422")
    void testRegisterValidation() throws IOException {
        long ts = unique();
        Assertions.assertEquals(422, postStatus(authUrl("/users"),
                        registerPayload(uniqueUsername(ts), "not-an-email", PASSWORD, "Ana", "Perez", "")),
                "Invalid email must return HTTP 422");
        Assertions.assertEquals(422, postStatus(authUrl("/users"),
                        registerPayload(uniqueUsername(ts), uniqueEmail(ts), "weak", "Ana", "Perez", "")),
                "Weak password must return HTTP 422");
    }

    @Test
    @DisplayName("REST8 — PUT rating returns 201 + Location when created, 200 when replaced; GET returns own rating")
    void testRatingUpsert() throws IOException {
        String placeId = "rest_rating_" + unique();
        String url = restaurantUrl(placeId, "/rating");

        ApiResponse first = putFull(url, ratingPayload(4, 3, 5, 4, "first"));
        Assertions.assertEquals(201, first.status, "First PUT must return HTTP 201");
        Assertions.assertTrue(first.location != null && first.location.endsWith(
                "/api/v1/restaurants/" + placeId + "/rating"), "Location must be the rating, got: " + first.location);

        ApiResponse second = putFull(url, ratingPayload(2, 2, 2, 2, "second"));
        Assertions.assertEquals(200, second.status, "Second PUT must return HTTP 200");

        JsonObject own = getFull(url).json();
        Assertions.assertAll(
                () -> Assertions.assertEquals(2, own.get("quality").getAsInt(), "quality must be the replaced value"),
                () -> Assertions.assertEquals("second", own.get("comment").getAsString(), "comment must be replaced")
        );
    }

    @Test
    @DisplayName("REST9 — GET own rating returns an empty object when none exists")
    void testRatingNone() throws IOException {
        ApiResponse response = getFull(restaurantUrl("rest_none_" + unique(), "/rating"));
        Assertions.assertEquals(200, response.status, "GET own rating must return 200");
        Assertions.assertTrue(response.json().entrySet().isEmpty(), "Body must be {} when there is no rating");
    }

    @Test
    @DisplayName("REST10 — saving the same place twice returns 201 + Location then 200 with already_saved true")
    void testSavedDuplicate() throws IOException {
        String placeId = "rest_saved_" + unique();
        ApiResponse first = postFull(savedUrl(""), savedPayload(placeId));
        ApiResponse second = postFull(savedUrl(""), savedPayload(placeId));

        Assertions.assertAll(
                () -> Assertions.assertEquals(201, first.status, "First save must return 201"),
                () -> Assertions.assertNotNull(first.location, "First save must have a Location header"),
                () -> Assertions.assertEquals(200, second.status, "Second save must return 200"),
                () -> Assertions.assertTrue(second.json().get("already_saved").getAsBoolean(),
                        "Second save must have already_saved true")
        );
    }

    @Test
    @DisplayName("REST11 — GET /history returns the envelope and honors limit and offset")
    void testHistoryPagination() throws IOException {
        addHistory(PLACE);
        addHistory("MOCK_PLACE_102");
        addHistory("MOCK_PLACE_103");

        JsonObject page = getJsonObject(historyUrl("?limit=2&offset=1"));
        Assertions.assertAll(
                () -> Assertions.assertTrue(page.has("items") && page.has("total")
                        && page.has("limit") && page.has("offset"), "Envelope must have items/total/limit/offset"),
                () -> Assertions.assertEquals(2, page.get("limit").getAsInt(), "limit must be echoed"),
                () -> Assertions.assertEquals(1, page.get("offset").getAsInt(), "offset must be echoed"),
                () -> Assertions.assertEquals(2, page.getAsJsonArray("items").size(), "Page must hold 2 items"),
                () -> Assertions.assertTrue(page.get("total").getAsInt() >= 3, "total must count all entries")
        );
    }

    @Test
    @DisplayName("REST12 — GET /history with limit or offset out of range returns 422")
    void testHistoryLimitOutOfRange() throws IOException {
        Assertions.assertEquals(422, getStatus(historyUrl("?limit=0")), "limit=0 must return 422");
        Assertions.assertEquals(422, getStatus(historyUrl("?limit=101")), "limit=101 must return 422");
        Assertions.assertEquals(422, getStatus(historyUrl("?offset=-1")), "offset=-1 must return 422");
    }

    @Test
    @DisplayName("REST13 — GET /history/popular returns a JSON array")
    void testPopularIsArray() throws IOException {
        ApiResponse response = getFull(historyUrl("/popular?limit=3"));
        Assertions.assertEquals(200, response.status, "GET /history/popular must return 200");
        Assertions.assertTrue(JsonParser.parseString(response.body).isJsonArray(), "Body must be a plain array");
    }

    @Test
    @DisplayName("REST14 — liking a rating twice is idempotent and DELETE removes the like")
    void testLikesIdempotent() throws Exception {
        String placeId = "rest_like_" + unique();
        createRating(placeId, 5, 5, 5, 5, "Likeable");
        JsonArray ratings = getItems(restaurantUrl(placeId, "/ratings"));
        int ratingId = ratings.get(0).getAsJsonObject().get("id").getAsInt();

        long ts = unique() + 7;
        String email = uniqueEmail(ts);
        BasicCookieStore store = new BasicCookieStore();
        try (CloseableHttpClient other = HttpClients.custom().setDefaultCookieStore(store).build()) {
            HttpPost register = new HttpPost(authUrl("/users"));
            register.setEntity(new StringEntity(
                    registerPayload(uniqueUsername(ts), email, PASSWORD, "Lia", "Ker", ""),
                    ContentType.APPLICATION_JSON));
            status(other, register);
            HttpPost login = new HttpPost(authUrl("/sessions"));
            login.setEntity(new StringEntity(loginPayload(email, PASSWORD), ContentType.APPLICATION_JSON));
            status(other, login);

            String likesUrl = ratingsUrl("/" + ratingId + "/likes");
            Assertions.assertEquals(200, status(other, new HttpPost(likesUrl)), "First like must return 200");
            Assertions.assertEquals(200, status(other, new HttpPost(likesUrl)),
                    "Repeated like must return 200 (idempotent)");

            HttpGet list = new HttpGet(restaurantUrl(placeId, "/ratings"));
            list.addHeader("Accept", "application/json");
            String body;
            try (CloseableHttpResponse r = other.execute(list)) {
                body = EntityUtils.toString(r.getEntity());
            }
            JsonObject liked = JsonParser.parseString(body).getAsJsonObject()
                    .getAsJsonArray("items").get(0).getAsJsonObject();
            Assertions.assertEquals(1, liked.get("likes").getAsInt(), "Likes must count once");

            Assertions.assertEquals(204, status(other, new HttpDelete(likesUrl)), "DELETE like must return 204");
            Assertions.assertEquals(204, status(other, new HttpDelete(likesUrl)),
                    "Repeated DELETE like must return 204 (idempotent)");

            URIBuilder builder = new URIBuilder(authUrl("/profile"));
            builder.addParameter("password", PASSWORD);
            status(other, new HttpDelete(builder.build()));
        }
    }

    private static int status(CloseableHttpClient client, HttpUriRequest request) throws IOException {
        request.addHeader("Accept", "application/json");
        try (CloseableHttpResponse r = client.execute(request)) {
            EntityUtils.consume(r.getEntity());
            return r.getStatusLine().getStatusCode();
        }
    }
}
