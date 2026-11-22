package epigijon.devorapp.e2e.functional.tests.api;

import com.google.gson.JsonArray;
import com.google.gson.JsonObject;
import epigijon.devorapp.e2e.functional.common.BaseApiClass;
import org.apache.http.client.methods.CloseableHttpResponse;
import org.apache.http.client.methods.HttpDelete;
import org.apache.http.client.methods.HttpGet;
import org.apache.http.client.methods.HttpPost;
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
import java.net.URISyntaxException;

/** API Base-Choice tests for the history (history) module (see @DisplayName for scenario ids). */
class TestApiHistoryBC extends BaseApiClass {

    private static final String PLACE_A = "MOCK_PLACE_101";
    private static final String PLACE_B = "MOCK_PLACE_102";
    private static final String PLACE_C = "MOCK_PLACE_103";

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
    @DisplayName("BASE — adding 3 history entries returns all 3 via GET /api/v1/history")
    void testBase_MultipleEntries() throws IOException {
        addHistory(PLACE_A);
        addHistory(PLACE_B);
        addHistory(PLACE_C);

        JsonArray history = getItems(historyUrl(""));
        Assertions.assertTrue(history.size() >= 3,
                "After adding 3 entries history must have at least 3 items (BASE)");
    }

    @Test
    @DisplayName("Case 2 — fresh user with no history gets an empty array")
    void testCase2_EmptyHistory() throws IOException {
        // Use a separate fresh user
        long ts = unique();
        String email    = uniqueEmail(ts);
        String username = uniqueUsername(ts);
        String password = "Test1234!";

        BasicCookieStore localCookieStore = new BasicCookieStore();
        try (CloseableHttpClient localClient = HttpClients.custom().setDefaultCookieStore(localCookieStore).build()) {
            // Register using local client
            HttpPost registerReq = new HttpPost(authUrl("/users"));
            registerReq.setEntity(new StringEntity(
                    registerPayload(username, email, password, "Test", "User", ""),
                    ContentType.APPLICATION_JSON));
            registerReq.addHeader("Accept", "application/json");
            try (CloseableHttpResponse response = localClient.execute(registerReq)) {
                EntityUtils.consume(response.getEntity());
            }

            // Login using local client to populate localCookieStore
            HttpPost loginReq = new HttpPost(authUrl("/sessions"));
            loginReq.setEntity(new StringEntity(
                    loginPayload(email, password),
                    ContentType.APPLICATION_JSON));
            loginReq.addHeader("Accept", "application/json");
            try (CloseableHttpResponse response = localClient.execute(loginReq)) {
                EntityUtils.consume(response.getEntity());
            }

            // GET /api/v1/history using local client
            String body;
            HttpGet getReq = new HttpGet(historyUrl(""));
            getReq.addHeader("Accept", "application/json");
            try (CloseableHttpResponse response = localClient.execute(getReq)) {
                org.apache.http.HttpEntity entity = response.getEntity();
                body = entity != null ? EntityUtils.toString(entity) : "";
            }
            JsonArray history = com.google.gson.JsonParser.parseString(body).getAsJsonObject().getAsJsonArray("items");
            Assertions.assertTrue(history.isEmpty(), "A brand-new user must have an empty history");

            // Clean up: delete fresh user to prevent leaks
            try {
                URIBuilder builder = new URIBuilder(authUrl("/profile"));
                builder.addParameter("password", password);
                HttpDelete deleteReq = new HttpDelete(builder.build());
                try (CloseableHttpResponse response = localClient.execute(deleteReq)) {
                    EntityUtils.consume(response.getEntity());
                }
            } catch (URISyntaxException e) {
                // Ignore
            }
        }
    }

    @Test
    @DisplayName("Case 5 — adding 1 history entry returns it with id, place_id and accessed_at")
    void testCase5_SingleEntry() throws IOException {
        String resp = post(historyUrl(""), historyPayload(PLACE_A));
        JsonObject entry = com.google.gson.JsonParser.parseString(resp).getAsJsonObject();

        Assertions.assertAll(
                () -> Assertions.assertTrue(entry.get("id").getAsInt() > 0,
                        "Entry id must be positive"),
                () -> Assertions.assertEquals(PLACE_A, entry.get("place_id").getAsString(),
                        "place_id must match"),
                () -> Assertions.assertTrue(entry.has("accessed_at"),
                        "Entry must have a accessed_at timestamp field")
        );
    }

    @Test
    @DisplayName("Case 6 — deleting a history entry removes it from GET /api/v1/history")
    void testCase6_DeleteEntry() throws IOException {
        int entryId = addHistory(PLACE_A);

        int deleteStatus = delete(historyUrl("/" + entryId));
        Assertions.assertEquals(204, deleteStatus,
                "DELETE history entry must return HTTP 204");

        JsonArray history = getItems(historyUrl(""));
        boolean stillPresent = false;
        for (com.google.gson.JsonElement el : history) {
            if (el.getAsJsonObject().get("id").getAsInt() == entryId) {
                stillPresent = true;
                break;
            }
        }
        Assertions.assertFalse(stillPresent,
                "Deleted entry must not appear in GET /api/v1/history");
    }

    @Test
    @DisplayName("Case 3 — each history entry has a non-null accessed_at field")
    void testCase3_AccessDate() throws IOException {
        addHistory(PLACE_B);

        JsonArray history = getItems(historyUrl(""));
        Assertions.assertFalse(history.isEmpty(),
                "History must have at least 1 entry");

        JsonObject latest = history.get(history.size() - 1).getAsJsonObject();
        Assertions.assertAll(
                () -> Assertions.assertTrue(latest.has("accessed_at"),
                        "Entry must have accessed_at field"),
                () -> Assertions.assertFalse(latest.get("accessed_at").isJsonNull(),
                        "accessed_at must not be null")
        );
    }
}