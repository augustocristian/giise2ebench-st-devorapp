package epigijon.devorapp.e2e.functional.common;

import com.google.gson.JsonObject;
import epigijon.devorapp.e2e.functional.utils.Waiter;
import giis.selema.framework.junit5.LifecycleJunit5;
import giis.selema.manager.SeleManager;
import giis.selema.manager.SelemaConfig;
import giis.selema.services.browser.DynamicGridBrowserService;
import giis.selema.services.impl.WatermarkService;
import org.apache.http.client.methods.CloseableHttpResponse;
import org.apache.http.client.methods.HttpDelete;
import org.apache.http.client.methods.HttpPost;
import org.apache.http.util.EntityUtils;
import org.apache.http.client.utils.URIBuilder;
import org.apache.http.entity.ContentType;
import org.apache.http.entity.StringEntity;
import org.apache.http.impl.client.BasicCookieStore;
import org.apache.http.impl.client.CloseableHttpClient;
import org.apache.http.impl.client.HttpClients;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.TestInfo;
import org.junit.jupiter.api.extension.ExtendWith;
import org.openqa.selenium.WebDriver;
import org.openqa.selenium.JavascriptExecutor;
import org.openqa.selenium.support.ui.WebDriverWait;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Paths;
import java.time.Duration;
import java.util.Properties;

/**
 * Base class for all DevorApp browser (Selenium) tests.
 *
 * <p>Manages two concerns:
 * <ol>
 *   <li><b>Browser lifecycle</b> — initialises the Selema/Chrome driver once per class
 *       and hands a fresh {@link WebDriver} + {@link Waiter} to each test method.</li>
 *   <li><b>Test-user lifecycle</b> — provides {@link #setupTestUser} and
 *       {@link #tearDownTestUser} so every subclass creates and deletes a real Firebase
 *       user with a single line, without duplicating HTTP-client boilerplate.</li>
 * </ol>
 *
 * <p>Tests interact with the UI exclusively through page objects in
 * {@code epigijon.devorapp.e2e.functional.pages}.
 */
@ExtendWith(LifecycleJunit5.class)
public class BaseLoggedClass {

    protected static final Logger log = LoggerFactory.getLogger(BaseLoggedClass.class);

    // ── Browser infrastructure ────────────────────────────────────────────────────

    private static final SeleManager seleManager = new SeleManager(new SelemaConfig()
            .setReportSubdir("target/containerlogs/"
                    + (System.getProperty("TJOB_NAME") == null ? "" : System.getProperty("TJOB_NAME")))
            .setName(System.getProperty("TJOB_NAME") == null ? "locallogs" : System.getProperty("TJOB_NAME")))
            .setManageAtClass();

    protected static String sutUrl;
    protected static Properties properties;

    protected WebDriver driver;
    protected Waiter waiter;

    // ── API client for test-user lifecycle ────────────────────────────────────────

    private static CloseableHttpClient apiClient;

    private static final java.util.Map<Class<?>, String> classEmails = new java.util.concurrent.ConcurrentHashMap<>();
    private static final java.util.Map<Class<?>, String> classPasswords = new java.util.concurrent.ConcurrentHashMap<>();
    private static final java.util.Map<Class<?>, String> classUsernames = new java.util.concurrent.ConcurrentHashMap<>();
    private static final java.util.Map<Class<?>, java.util.List<String[]>> classRegisteredUsers = new java.util.concurrent.ConcurrentHashMap<>();

    protected String testUsername;
    protected String testEmail;
    protected String testPassword;

    // ── JUnit lifecycle ───────────────────────────────────────────────────────────

    @BeforeAll
    public static void setupAll() throws IOException {
        properties = new Properties();
        properties.load(Files.newInputStream(Paths.get("src/test/resources/test.properties")));

        String envUrl = System.getProperty("SUT_URL") != null
                ? System.getProperty("SUT_URL") : System.getenv("SUT_URL");
        sutUrl = envUrl != null ? envUrl : properties.getProperty("FRONTEND_URL", "http://localhost");
        log.info("Browser base URL: {}", sutUrl);

        String headlessProp = System.getProperty("headless") != null
                ? System.getProperty("headless")
                : properties.getProperty("HEADLESS_BROWSER", "false");

        if ("true".equalsIgnoreCase(headlessProp)) {
            log.info("Running Chrome in headless mode.");
            seleManager.setBrowser("chrome").setArguments(new String[]{"--start-maximized", "--incognito", "--headless=new"});
        } else {
            seleManager.setBrowser("chrome").setArguments(new String[]{"--start-maximized", "--incognito"});
        }
        if (System.getenv("SELENOID_PRESENT") != null) {
            seleManager.setDriverUrl("http://selenium-hub:4444/wd/hub")
                    .add(new DynamicGridBrowserService().setVideo())
                    .add(new WatermarkService().setDelayOnFailure(3));
        }

        apiClient = HttpClients.custom().setDefaultCookieStore(new BasicCookieStore()).build();
        log.info("Browser and API client initialised.");
    }

    @BeforeEach
    void setup(TestInfo testInfo) {
        log.info("Starting: {}", testInfo.getDisplayName());
        driver = seleManager.getDriver();
        waiter = new Waiter(driver);
        String currentUrl = driver.getCurrentUrl();
        if (currentUrl == null || currentUrl.isEmpty() || currentUrl.startsWith("about:") || currentUrl.startsWith("data:")) {
            driver.get(sutUrl);
        }
        clearSession();
        this.testEmail = classEmails.get(this.getClass());
        this.testPassword = classPasswords.get(this.getClass());
        this.testUsername = classUsernames.get(this.getClass());
    }

    /**
     * Clears cookies, localStorage, sessionStorage, and synchronises deletion of
     * all IndexedDB databases (where Firebase stores JWT tokens).
     */
    public void clearSession() {
        try {
            driver.get(sutUrl + "/vite.svg");
        } catch (Exception ignored) {}
        try {
            driver.manage().deleteAllCookies();
        } catch (Exception ignored) {}
        try {
            ((org.openqa.selenium.JavascriptExecutor) driver).executeScript("window.localStorage.clear();");
        } catch (Exception ignored) {}
        try {
            ((org.openqa.selenium.JavascriptExecutor) driver).executeScript("window.sessionStorage.clear();");
        } catch (Exception ignored) {}
        try {
            driver.manage().timeouts().scriptTimeout(Duration.ofSeconds(5));
            ((org.openqa.selenium.JavascriptExecutor) driver).executeAsyncScript(
                "var callback = arguments[arguments.length - 1];" +
                "if (window.indexedDB && window.indexedDB.databases) {" +
                "  window.indexedDB.databases().then(function(dbs) {" +
                "    var promises = dbs.map(function(db) {" +
                "      return new Promise(function(resolve) {" +
                "        var req = window.indexedDB.deleteDatabase(db.name);" +
                "        req.onsuccess = function() { resolve(); };" +
                "        req.onerror = function() { resolve(); };" +
                "        req.onblocked = function() { resolve(); };" +
                "      });" +
                "    });" +
                "    Promise.all(promises).then(function() { callback(); }).catch(function() { callback(); });" +
                "  }).catch(function() { callback(); });" +
                "} else {" +
                "  callback();" +
                "}"
            );
        } catch (Exception ignored) {}
    }

    @AfterEach
    void tearDown(TestInfo testInfo) {
        log.info("Finished: {}", testInfo.getDisplayName());
    }

    /** Closes the shared API client. Runs after all subclass {@code @AfterAll} methods. */
    @AfterAll
    public static void tearDownAll() throws IOException {
        if (apiClient != null) {
            apiClient.close();
            apiClient = null;
        }
    }

    // ── Test-user helpers ────────────────────────────────────────────────────────

    /**
     * Registers a new test user via {@code POST /api/register} and stores the
     * credentials for later teardown.  Call from a subclass {@code @BeforeAll}.
     */
    private static Class<?> getCallingClass() {
        try {
            StackTraceElement[] st = Thread.currentThread().getStackTrace();
            for (StackTraceElement ste : st) {
                String name = ste.getClassName();
                if (!name.equals(Thread.class.getName()) && 
                    !name.equals(BaseLoggedClass.class.getName()) && 
                    !name.contains("java.lang")) {
                    return Class.forName(name);
                }
            }
        } catch (Exception e) {
            // fallback
        }
        return BaseLoggedClass.class;
    }

    /**
     * Registers a new test user via {@code POST /api/register} and stores the
     * credentials for later teardown.  Call from a subclass {@code @BeforeAll}.
     */
    protected static void setupTestUser(String username, String email, String password)
            throws IOException {
        Class<?> callingClass = getCallingClass();
        classUsernames.put(callingClass, username);
        classEmails.put(callingClass, email);
        classPasswords.put(callingClass, password);

        String apiBase = properties.getProperty("LOCALHOST_URL", "http://localhost:8000");
        JsonObject payload = new JsonObject();
        payload.addProperty("username",  username);
        payload.addProperty("email",     email);
        payload.addProperty("password",  password);
        payload.addProperty("nombre",    "UITester");
        payload.addProperty("apellidos", "Test");
        payload.addProperty("ubicacion", "Gijón");

        HttpPost reg = new HttpPost(apiBase + "/api/register");
        reg.setEntity(new StringEntity(payload.toString(), ContentType.APPLICATION_JSON));
        reg.addHeader("Accept", "application/json");
        try (CloseableHttpResponse resp = apiClient.execute(reg)) {
            EntityUtils.consume(resp.getEntity());
        }
        log.info("Registered browser test user: {}", email);
    }

    /**
     * Registers a username, email, and password created during a test so that they
     * are cleaned up automatically in {@link #tearDownTestUser()}.
     */
    protected static void registerEmailForCleanup(String email, String password) {
        Class<?> callingClass = getCallingClass();
        classRegisteredUsers.computeIfAbsent(callingClass, k -> new java.util.concurrent.CopyOnWriteArrayList<>())
                .add(new String[]{email, password});
    }

    /**
     * Registers a new test user via {@code POST /api/register} directly via the API client
     * without storing the credentials in the static maps (to prevent session pollution for other tests).
     */
    protected static void registerUserApi(String username, String email, String password)
            throws IOException {
        registerEmailForCleanup(email, password);
        String apiBase = properties.getProperty("LOCALHOST_URL", "http://localhost:8000");
        JsonObject payload = new JsonObject();
        payload.addProperty("username",  username);
        payload.addProperty("email",     email);
        payload.addProperty("password",  password);
        payload.addProperty("nombre",    "UITester");
        payload.addProperty("apellidos", "Test");
        payload.addProperty("ubicacion", "Gijón");

        HttpPost reg = new HttpPost(apiBase + "/api/register");
        reg.setEntity(new StringEntity(payload.toString(), ContentType.APPLICATION_JSON));
        reg.addHeader("Accept", "application/json");
        try (CloseableHttpResponse resp = apiClient.execute(reg)) {
            EntityUtils.consume(resp.getEntity());
        }
        log.info("Registered API-only test user: {}", email);
    }

    /**
     * Logs in and then calls {@code DELETE /api/profile} to permanently remove
     * the test user created by {@link #setupTestUser} as well as any extra users registered during the test.
     * Call from a subclass {@code @AfterAll} — the parent {@code @AfterAll}
     * ({@link #tearDownAll}) which closes the API client runs after this.
     */
    protected static void tearDownTestUser() {
        Class<?> callingClass = getCallingClass();
        String email = classEmails.get(callingClass);
        String password = classPasswords.get(callingClass);

        // Delete any extra registered users tracked for this class
        java.util.List<String[]> extraUsers = classRegisteredUsers.get(callingClass);
        if (extraUsers != null && apiClient != null) {
            for (String[] user : extraUsers) {
                String extraEmail = user[0];
                String extraPassword = user[1];
                try {
                    String apiBase = properties.getProperty("LOCALHOST_URL", "http://localhost:8000");

                    JsonObject loginPayload = new JsonObject();
                    loginPayload.addProperty("identifier", extraEmail);
                    loginPayload.addProperty("password",   extraPassword);
                    HttpPost login = new HttpPost(apiBase + "/api/login");
                    login.setEntity(new StringEntity(loginPayload.toString(), ContentType.APPLICATION_JSON));
                    login.addHeader("Accept", "application/json");
                    try (CloseableHttpResponse resp = apiClient.execute(login)) {
                        EntityUtils.consume(resp.getEntity());
                    }

                    URIBuilder ub = new URIBuilder(apiBase + "/api/profile");
                    ub.addParameter("password", extraPassword);
                    try (CloseableHttpResponse resp = apiClient.execute(new HttpDelete(ub.build()))) {
                        EntityUtils.consume(resp.getEntity());
                    }
                    log.info("Deleted extra registered test user: {}", extraEmail);
                } catch (Exception e) {
                    log.warn("Could not delete extra registered test user {}: {}", extraEmail, e.getMessage());
                }
            }
            classRegisteredUsers.remove(callingClass);
        }

        if (email == null || password == null || apiClient == null) return;
        try {
            String apiBase = properties.getProperty("LOCALHOST_URL", "http://localhost:8000");

            JsonObject loginPayload = new JsonObject();
            loginPayload.addProperty("identifier", email);
            loginPayload.addProperty("password",   password);
            HttpPost login = new HttpPost(apiBase + "/api/login");
            login.setEntity(new StringEntity(loginPayload.toString(), ContentType.APPLICATION_JSON));
            login.addHeader("Accept", "application/json");
            try (CloseableHttpResponse resp = apiClient.execute(login)) {
                EntityUtils.consume(resp.getEntity());
            }

            URIBuilder ub = new URIBuilder(apiBase + "/api/profile");
            ub.addParameter("password", password);
            try (CloseableHttpResponse resp = apiClient.execute(new HttpDelete(ub.build()))) {
                EntityUtils.consume(resp.getEntity());
            }
            log.info("Deleted browser test user: {}", email);
        } catch (Exception e) {
            log.warn("Could not delete browser test user {}: {}", email, e.getMessage());
        } finally {
            classEmails.remove(callingClass);
            classPasswords.remove(callingClass);
            classUsernames.remove(callingClass);
        }
    }

    /**
     * POSTs a JSON body to the given absolute URL using the shared API client.
     * The client is already authenticated if {@link #setupTestUser} was called.
     * Returns the response body as a parsed {@link com.google.gson.JsonObject}.
     */
    protected com.google.gson.JsonObject apiPost(String url, String jsonBody)
            throws IOException {
        HttpPost req = new HttpPost(url);
        req.setEntity(new StringEntity(jsonBody, ContentType.APPLICATION_JSON));
        req.addHeader("Accept", "application/json");
        try (CloseableHttpResponse resp = apiClient.execute(req)) {
            String body = EntityUtils.toString(resp.getEntity());
            return com.google.gson.JsonParser.parseString(body).getAsJsonObject();
        }
    }

    /**
     * Logs in the test user (using {@link #testEmail} / {@link #testPassword})
     * with the shared API client so that subsequent {@link #apiPost} / {@link #apiDelete}
     * calls carry the JWT session cookie.
     */
    protected void apiLogin() throws IOException {
        String apiBase = properties.getProperty("LOCALHOST_URL", "http://localhost:8000");
        JsonObject payload = new JsonObject();
        payload.addProperty("identifier", testEmail);
        payload.addProperty("password", testPassword);
        HttpPost login = new HttpPost(apiBase + "/api/login");
        login.setEntity(new StringEntity(payload.toString(), ContentType.APPLICATION_JSON));
        login.addHeader("Accept", "application/json");
        try (CloseableHttpResponse resp = apiClient.execute(login)) {
            EntityUtils.consume(resp.getEntity());
        }
    }

    /**
     * DELETEs the given absolute URL using the shared API client.
     * Returns the HTTP status code.
     */
    protected int apiDelete(String url) throws IOException {
        try (CloseableHttpResponse resp = apiClient.execute(new HttpDelete(url))) {
            int status = resp.getStatusLine().getStatusCode();
            EntityUtils.consume(resp.getEntity());
            return status;
        }
    }

    /** Injects a bulletproof Google Maps Autocomplete mock into the window object. */
    protected void injectAutocompleteMock() {
        ((JavascriptExecutor) driver).executeScript(
                "const mockAutocompleteClass = class {\n" +
                "  constructor(input, options) {\n" +
                "    window.mockAutocompleteInstance = this;\n" +
                "    this.input = input;\n" +
                "  }\n" +
                "  addListener(event, callback) {\n" +
                "    if (!this.listeners) this.listeners = {};\n" +
                "    if (!this.listeners[event]) this.listeners[event] = [];\n" +
                "    this.listeners[event].push(callback);\n" +
                "    return { remove: () => {} };\n" +
                "  }\n" +
                "  getPlace() {\n" +
                "    return {\n" +
                "      formatted_address: this.input ? this.input.value : 'Barcelona, España'\n" +
                "    };\n" +
                "  }\n" +
                "  setTypes() {}\n" +
                "  setBounds() {}\n" +
                "  setFields() {}\n" +
                "  setComponentRestrictions() {}\n" +
                "  getBounds() { return {}; }\n" +
                "  getFields() { return []; }\n" +
                "  setOptions() {}\n" +
                "};\n" +
                "const mockPlaces = {};\n" +
                "Object.defineProperty(mockPlaces, 'Autocomplete', { value: mockAutocompleteClass, writable: false, configurable: false });\n" +
                "const mockMaps = {};\n" +
                "Object.defineProperty(mockMaps, 'places', { value: mockPlaces, writable: false, configurable: false });\n" +
                "const mockGoogle = {};\n" +
                "Object.defineProperty(mockGoogle, 'maps', { value: mockMaps, writable: false, configurable: false });\n" +
                "Object.defineProperty(window, 'google', { value: mockGoogle, writable: false, configurable: false });\n"
        );
    }

    /**
     * Waits for the mock Autocomplete instance to be initialized and have a 'place_changed'
     * listener, then triggers all the 'place_changed' callbacks.
     */
    protected void triggerAutocompletePlaceChanged() {
        new WebDriverWait(driver, Duration.ofSeconds(10)).until(d ->
            (Boolean) ((JavascriptExecutor) d).executeScript(
                "return window.mockAutocompleteInstance?.listeners?.['place_changed'] !== undefined;"));
        ((JavascriptExecutor) driver).executeScript(
            "window.mockAutocompleteInstance.listeners['place_changed'].forEach(cb => cb());");
    }
}

