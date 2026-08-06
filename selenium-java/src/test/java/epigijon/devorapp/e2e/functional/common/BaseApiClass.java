package epigijon.devorapp.e2e.functional.common;

import com.google.gson.JsonArray;
import com.google.gson.JsonElement;
import com.google.gson.JsonObject;
import com.google.gson.JsonParser;
import org.apache.http.HttpEntity;
import org.apache.http.HttpResponse;
import org.apache.http.client.methods.*;
import org.apache.http.client.utils.URIBuilder;
import org.apache.http.entity.ContentType;
import org.apache.http.entity.StringEntity;
import org.apache.http.impl.client.BasicCookieStore;
import org.apache.http.impl.client.CloseableHttpClient;
import org.apache.http.impl.client.HttpClients;
import org.apache.http.util.EntityUtils;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeAll;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.io.IOException;
import java.net.URISyntaxException;
import java.nio.file.Files;
import java.nio.file.Paths;
import java.util.Properties;

/**
 * Base class for DevorApp API tests. Provides HTTP request helpers, JSON payload builders,
 * auth lifecycle (registerAndLogin / deleteTestUser), and fixture creation methods.
 * The HttpClient uses a shared BasicCookieStore so the JWT access_token cookie issued on
 * login is automatically sent on every subsequent request.
 */
public class BaseApiClass {

    protected static final Logger log = LoggerFactory.getLogger(BaseApiClass.class);

    /** A stable Google Places ID used as a test restaurant in all test classes. */
    protected static final String TEST_PLACE_ID = "ChIJN1t_tDeuEmsRUsoyG83frY4";

    protected static CloseableHttpClient httpClient;
    protected static BasicCookieStore cookieStore;
    protected static String sutUrl;
    protected static Properties properties;
    protected static String tJobName;

    protected static String testUsername;
    protected static String testEmail;
    protected static String testPassword;

    @BeforeAll
    public static void setupAll() throws IOException {
        log.info("Starting API test global setup");
        properties = new Properties();
        properties.load(Files.newInputStream(Paths.get("src/test/resources/test.properties")));
        tJobName = System.getProperty("TJOB_NAME");
        String envUrl = System.getProperty("SUT_URL") != null
                ? System.getProperty("SUT_URL")
                : System.getenv("SUT_URL");
        sutUrl = envUrl != null ? envUrl : properties.getProperty("LOCALHOST_URL");
        log.info("API base URL: {}", sutUrl);
        cookieStore = new BasicCookieStore();
        httpClient = HttpClients.custom().setDefaultCookieStore(cookieStore).build();
    }

    @AfterAll
    public static void tearDownAll() throws IOException {
        if (httpClient != null) {
            httpClient.close();
            log.info("Shared HTTP client closed");
        }
    }

    // ── URL builders ────────────────────────────────────────────────────────────

    protected String authUrl(String path)              { return sutUrl + "/api" + path; }
    protected String favoritosUrl(String path)         { return sutUrl + "/api/favoritos" + path; }
    protected String historialUrl(String path)         { return sutUrl + "/api/historial" + path; }
    protected String masTardeUrl(String path)          { return sutUrl + "/api/mas-tarde" + path; }
    protected String valoracionesUrl(String path)      { return sutUrl + "/api/valoraciones" + path; }
    protected String recommendationsUrl(String path)   { return sutUrl + "/api/recommendations" + path; }

    // ── HTTP verbs ───────────────────────────────────────────────────────────────

    protected String get(String url) throws IOException {
        HttpGet request = new HttpGet(url);
        request.addHeader("Accept", "application/json");
        try (CloseableHttpResponse response = httpClient.execute(request)) {
            HttpEntity entity = response.getEntity();
            String body = entity != null ? EntityUtils.toString(entity) : "";
            log.debug("GET {} -> {}", url, response.getStatusLine().getStatusCode());
            return body;
        }
    }

    protected int getStatus(String url) throws IOException {
        return statusOf(new HttpGet(url));
    }

    protected String post(String url, String jsonBody) throws IOException {
        try (CloseableHttpResponse response = httpClient.execute(buildPost(url, jsonBody))) {
            HttpEntity entity = response.getEntity();
            String body = entity != null ? EntityUtils.toString(entity) : "";
            log.debug("POST {} -> {}", url, response.getStatusLine().getStatusCode());
            return body;
        }
    }

    protected int postStatus(String url, String jsonBody) throws IOException {
        return statusOf(buildPost(url, jsonBody));
    }

    protected int patch(String url, String jsonBody) throws IOException {
        HttpPatch request = new HttpPatch(url);
        request.setEntity(new StringEntity(jsonBody, ContentType.APPLICATION_JSON));
        request.addHeader("Accept", "application/json");
        return statusOf(request);
    }

    protected int delete(String url) throws IOException {
        return statusOf(new HttpDelete(url));
    }

    protected int deleteWithQuery(String url, String queryParam, String value) throws IOException {
        try {
            URIBuilder builder = new URIBuilder(url);
            builder.addParameter(queryParam, value);
            HttpDelete request = new HttpDelete(builder.build());
            return statusOf(request);
        } catch (URISyntaxException e) {
            throw new IOException("Invalid URI: " + url, e);
        }
    }

    protected JsonObject getJsonObject(String url) throws IOException {
        return JsonParser.parseString(get(url)).getAsJsonObject();
    }

    protected JsonArray getJsonArray(String url) throws IOException {
        return JsonParser.parseString(get(url)).getAsJsonArray();
    }

    protected static boolean containsByField(JsonArray array, String fieldName, String expected) {
        for (JsonElement element : array) {
            if (element.isJsonObject()
                    && expected.equals(element.getAsJsonObject().get(fieldName).getAsString())) {
                return true;
            }
        }
        return false;
    }

    private static HttpPost buildPost(String url, String jsonBody) {
        HttpPost request = new HttpPost(url);
        request.setEntity(new StringEntity(jsonBody, ContentType.APPLICATION_JSON));
        request.addHeader("Accept", "application/json");
        return request;
    }

    private int statusOf(HttpUriRequest request) throws IOException {
        try (CloseableHttpResponse response = httpClient.execute(request)) {
            int status = response.getStatusLine().getStatusCode();
            log.debug("{} {} -> {}", request.getMethod(), request.getURI(), status);
            EntityUtils.consume(response.getEntity());
            return status;
        }
    }

    // ── Uniqueness helpers ───────────────────────────────────────────────────────

    protected static long unique() { return System.currentTimeMillis(); }

    protected static String uniqueEmail(long ts) {
        return "testuser" + ts + "@devorapp.test";
    }

    protected static String uniqueUsername(long ts) {
        String raw = "tst" + ts;
        return raw.length() > 30 ? raw.substring(raw.length() - 30) : raw;
    }

    // ── Auth lifecycle ───────────────────────────────────────────────────────────

    /**
     * Registers a new test user via POST /api/register, then logs in via POST /api/login.
     * The JWT cookie is captured automatically by the shared cookie store.
     */
    protected static void registerAndLogin(String username, String email, String password)
            throws IOException {
        testUsername = username;
        testEmail = email;
        testPassword = password;

        String regBody = registerPayload(username, email, password, "Test", "User", "");
        String regResponse = postStatic(authUrl_s() + "/register", regBody);
        log.info("Registered test user: {} / {}, response snippet: {}",
                username, email, regResponse.length() > 80 ? regResponse.substring(0, 80) : regResponse);

        String loginBody = loginPayload(email, password);
        String loginResponse = postStatic(authUrl_s() + "/login", loginBody);
        log.info("Logged in test user, response snippet: {}",
                loginResponse.length() > 80 ? loginResponse.substring(0, 80) : loginResponse);
    }

    /**
     * Deletes the test user account. Must be called from {@code @AfterAll}.
     */
    protected static void deleteTestUser() throws IOException {
        if (testEmail == null || testPassword == null) return;
        try {
            URIBuilder builder = new URIBuilder(authUrl_s() + "/profile");
            builder.addParameter("password", testPassword);
            HttpDelete request = new HttpDelete(builder.build());
            try (CloseableHttpResponse response = httpClient.execute(request)) {
                int status = response.getStatusLine().getStatusCode();
                log.info("Deleted test user {} -> HTTP {}", testEmail, status);
            }
        } catch (Exception e) {
            log.warn("Could not delete test user {}: {}", testEmail, e.getMessage());
        }
    }

    // Static helpers used from static context (BeforeAll/AfterAll)
    private static String authUrl_s() {
        if (sutUrl == null) return "http://localhost:8000/api";
        return sutUrl + "/api";
    }

    private static String postStatic(String url, String jsonBody) throws IOException {
        HttpPost request = new HttpPost(url);
        request.setEntity(new StringEntity(jsonBody, ContentType.APPLICATION_JSON));
        request.addHeader("Accept", "application/json");
        try (CloseableHttpResponse response = httpClient.execute(request)) {
            HttpEntity entity = response.getEntity();
            return entity != null ? EntityUtils.toString(entity) : "";
        }
    }

    // ── Payload builders ─────────────────────────────────────────────────────────

    protected static String registerPayload(String username, String email, String password,
                                            String nombre, String apellidos, String ubicacion) {
        JsonObject json = new JsonObject();
        json.addProperty("username", username);
        json.addProperty("email", email);
        json.addProperty("password", password);
        json.addProperty("nombre", nombre);
        json.addProperty("apellidos", apellidos);
        json.addProperty("ubicacion", ubicacion);
        return json.toString();
    }

    protected static String loginPayload(String identifier, String password) {
        JsonObject json = new JsonObject();
        json.addProperty("identifier", identifier);
        json.addProperty("password", password);
        return json.toString();
    }

    protected static String listaPayload(String nombre) {
        return listaPayload(nombre, "Heart");
    }

    protected static String listaPayload(String nombre, String icono) {
        JsonObject json = new JsonObject();
        json.addProperty("nombre", nombre);
        json.addProperty("icono", icono);
        return json.toString();
    }

    protected static String favoritoPayload(String placeId)  { return placeIdPayload(placeId); }
    protected static String masTardePayload(String placeId)  { return placeIdPayload(placeId); }
    protected static String historialPayload(String placeId) { return placeIdPayload(placeId); }

    private static String placeIdPayload(String placeId) {
        JsonObject json = new JsonObject();
        json.addProperty("place_id", placeId);
        return json.toString();
    }

    protected static String valoracionPayload(String placeId, int calidad, int precio,
                                               int higiene, int trato, String comentario) {
        JsonObject json = new JsonObject();
        json.addProperty("place_id", placeId);
        json.addProperty("calidad", calidad);
        json.addProperty("precio", precio);
        json.addProperty("higiene", higiene);
        json.addProperty("trato", trato);
        json.addProperty("comentario", comentario);
        return json.toString();
    }

    protected static String profileUpdatePayload(String nombre, String apellidos,
                                                  String ubicacion, String password) {
        JsonObject json = new JsonObject();
        json.addProperty("nombre", nombre);
        json.addProperty("apellidos", apellidos);
        json.addProperty("ubicacion", ubicacion);
        json.addProperty("password", password);
        return json.toString();
    }

    protected static String popularesPayload(int limit) {
        JsonObject json = new JsonObject();
        json.addProperty("limit", limit);
        return json.toString();
    }

    /**
     * Builds the request body for POST /api/recommendations/search.
     *
     * @param categories list of category ids (e.g. "restaurant", "italian_food")
     * @param prices     list of price level strings (e.g. "PRICE_LEVEL_MODERATE")
     * @param includeUnconfirmedPrice whether to include places with unspecified price
     * @param location   free-text location string (e.g. "Gijón")
     * @param maxResults maximum number of results to return
     */
    protected static String searchPayload(java.util.List<String> categories,
                                          java.util.List<String> prices,
                                          boolean includeUnconfirmedPrice,
                                          String location,
                                          int maxResults) {
        JsonObject json = new JsonObject();
        JsonArray cats = new JsonArray();
        for (String c : categories) cats.add(c);
        json.add("categories", cats);
        JsonArray priceArr = new JsonArray();
        for (String p : prices) priceArr.add(p);
        json.add("prices", priceArr);
        json.addProperty("include_unconfirmed_price", includeUnconfirmedPrice);
        json.addProperty("location", location);
        json.addProperty("sort_by", "rating");
        json.addProperty("max_results", maxResults);
        return json.toString();
    }

    // ── JSON via POST helper ──────────────────────────────────────────────────────

    /** GETs a JsonObject from a POST response body. */
    protected JsonObject postJsonObject(String url, String body) throws IOException {
        return JsonParser.parseString(post(url, body)).getAsJsonObject();
    }

    // ── CRUD helpers ─────────────────────────────────────────────────────────────

    /** Creates a favorite list and returns its assigned id. */
    protected int createLista(String nombre) throws IOException {
        String response = post(favoritosUrl("/listas"), listaPayload(nombre));
        return JsonParser.parseString(response).getAsJsonObject().get("id").getAsInt();
    }

    /** Adds a restaurant to a list and returns the favorito id. */
    protected int addFavorito(int listaId, String placeId) throws IOException {
        String response = post(favoritosUrl("/listas/" + listaId), favoritoPayload(placeId));
        return JsonParser.parseString(response).getAsJsonObject().get("id").getAsInt();
    }

    /** Adds a restaurant to historial and returns the entry id. */
    protected int addHistorial(String placeId) throws IOException {
        String response = post(historialUrl(""), historialPayload(placeId));
        return JsonParser.parseString(response).getAsJsonObject().get("id").getAsInt();
    }

    /** Adds a restaurant to mas-tarde and returns the entry id. */
    protected int addMasTarde(String placeId) throws IOException {
        String response = post(masTardeUrl(""), masTardePayload(placeId));
        return JsonParser.parseString(response).getAsJsonObject().get("id").getAsInt();
    }

    /** Creates a valoracion and returns the full response JsonObject. */
    protected JsonObject createValoracion(String placeId, int calidad, int precio,
                                          int higiene, int trato, String comentario) throws IOException {
        String response = post(valoracionesUrl(""),
                valoracionPayload(placeId, calidad, precio, higiene, trato, comentario));
        return JsonParser.parseString(response).getAsJsonObject();
    }

    /**
     * Returns the id of the first lista named "Favoritos" in the user's lista collection,
     * or -1 if not found.
     */
    protected int getDefaultListaId() throws IOException {
        JsonArray listas = getJsonArray(favoritosUrl("/listas"));
        for (JsonElement el : listas) {
            JsonObject lista = el.getAsJsonObject();
            if ("Favoritos".equals(lista.get("nombre").getAsString())) {
                return lista.get("id").getAsInt();
            }
        }
        return -1;
    }
}
