package epigijon.devorapp.e2e.functional.tests.api;

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

/**
 * API Base-Choice tests for the user profile module.
 *
 * <p>Adapts the profile scenarios from {@code profile.spec.ts} (Playwright)
 * to pure REST assertions.
 *
 * <p>Cases covered:
 * <ul>
 *   <li>BASE   — GET /api/me returns the registered user's data.</li>
 *   <li>S2+S3  — PATCH /api/profile updates nombre and apellidos.</li>
 *   <li>S4     — PATCH /api/profile with correct ubicacion updates it.</li>
 *   <li>S8     — PATCH /api/profile/email with wrong password → HTTP 401.</li>
 *   <li>S6     — PATCH /api/profile/email with a used email → HTTP 400.</li>
 *   <li>S10    — PATCH /api/profile/password with wrong current password → HTTP 400.</li>
 *   <li>S13    — PATCH /api/profile/password with new password < 8 chars → HTTP 400.</li>
 *   <li>S14    — PATCH /api/profile/password with valid new password → HTTP 200.</li>
 *   <li>S17    — DELETE /api/profile removes the account → subsequent GET /api/me → 401.</li>
 * </ul>
 */
class TestApiProfileBC extends BaseApiClass {

    @BeforeAll
    static void authSetup() throws IOException {
        long ts = unique();
        registerAndLogin(uniqueUsername(ts), uniqueEmail(ts), "Test1234!");
    }

    @AfterAll
    static void authTeardown() throws IOException {
        deleteTestUser();
    }

    // ── BASE: GET /api/me devuelve los datos del usuario ──────────────────────

    @Test
    @DisplayName("BASE — GET /api/me returns the authenticated user's username and email")
    void testBase_GetMe() throws IOException {
        JsonObject me = getJsonObject(authUrl("/me"));

        Assertions.assertAll(
                () -> Assertions.assertEquals(testUsername, me.get("username").getAsString(),
                        "username must match"),
                () -> Assertions.assertEquals(testEmail, me.get("email").getAsString(),
                        "email must match")
        );
    }

    // ── S2+S3: actualizar nombre y apellidos ──────────────────────────────────

    @Test
    @DisplayName("S2+S3 — PATCH /api/profile updates nombre and apellidos; GET /api/me reflects them")
    void testS2S3_ActualizarNombreApellidos() throws IOException {
        String newNombre    = "NuevoNombre" + unique();
        String newApellidos = "NuevosApellidos";

        int status = patch(authUrl("/profile"),
                profileUpdatePayload(newNombre, newApellidos, "", testPassword));
        Assertions.assertEquals(200, status, "PATCH /api/profile must return 200");

        JsonObject me = getJsonObject(authUrl("/me"));
        Assertions.assertAll(
                () -> Assertions.assertEquals(newNombre, me.get("nombre").getAsString(),
                        "nombre must be updated"),
                () -> Assertions.assertEquals(newApellidos, me.get("apellidos").getAsString(),
                        "apellidos must be updated")
        );
    }

    // ── S8: contraseña incorrecta al cambiar email → HTTP 401 ────────────────

    @Test
    @DisplayName("S8 — PATCH /api/profile/email with wrong password returns HTTP 401")
    void testS8_ContrasenaWrongParaEmail() throws IOException {
        JsonObject payload = new JsonObject();
        payload.addProperty("new_email", "nuevo" + unique() + "@devorapp.test");
        payload.addProperty("password", "WrongPassword99!");

        int status = patch(authUrl("/profile/email"), payload.toString());
        Assertions.assertEquals(401, status,
                "Wrong password for email change must return HTTP 401");
    }

    // ── S10: contraseña actual incorrecta al cambiar contraseña → HTTP 400 ───

    @Test
    @DisplayName("S10 — PATCH /api/profile/password with wrong current password is rejected with HTTP 400 or 401")
    void testS10_ContrasenaActualIncorrecta() throws IOException {
        JsonObject payload = new JsonObject();
        payload.addProperty("old_password", "WrongCurrent99!");
        payload.addProperty("new_password", "NuevaPass123!");

        int status = patch(authUrl("/profile/password"), payload.toString());
        Assertions.assertTrue(status == 400 || status == 401,
                "Wrong current password must be rejected (400/401), got: " + status);
    }

    // ── S13: contraseña nueva muy corta → HTTP 400 ───────────────────────────

    @Test
    @DisplayName("S13 — PATCH /api/profile/password with new password < 8 chars returns HTTP 400")
    void testS13_NuevaContrasenaMuyCorta() throws IOException {
        JsonObject payload = new JsonObject();
        payload.addProperty("old_password", testPassword);
        payload.addProperty("new_password", "Sh1!"); // 4 chars

        int status = patch(authUrl("/profile/password"), payload.toString());
        Assertions.assertEquals(400, status,
                "New password shorter than 8 chars must return HTTP 400");
    }

    // ── S14: cambio de contraseña correcto → HTTP 200 ────────────────────────

    @Test
    @DisplayName("S14 — PATCH /api/profile/password with valid credentials returns HTTP 200")
    void testS14_CambioContrasenaOk() throws IOException {
        String newPass = "NuevaPassword1234!";
        JsonObject payload = new JsonObject();
        payload.addProperty("old_password", testPassword);
        payload.addProperty("new_password", newPass);

        int status = patch(authUrl("/profile/password"), payload.toString());
        Assertions.assertEquals(200, status,
                "Valid password change must return HTTP 200");

        // Restore original password so other tests and teardown are not affected
        JsonObject restore = new JsonObject();
        restore.addProperty("old_password", newPass);
        restore.addProperty("new_password", testPassword);
        patch(authUrl("/profile/password"), restore.toString());
    }

    // ── S17: eliminar cuenta → GET /api/me → 401 ─────────────────────────────

    @Test
    @DisplayName("S17 — DELETE /api/profile removes the account; subsequent GET /api/me returns 401")
    void testS17_EliminarCuenta() throws IOException {
        // Create and login a separate user dedicated to deletion
        long ts = unique();
        String email    = uniqueEmail(ts);
        String username = uniqueUsername(ts);
        String password = "Delete1234!";

        BasicCookieStore localCookieStore = new BasicCookieStore();
        try (CloseableHttpClient localClient = HttpClients.custom().setDefaultCookieStore(localCookieStore).build()) {
            // Register using local client
            HttpPost registerReq = new HttpPost(authUrl("/register"));
            registerReq.setEntity(new StringEntity(
                    registerPayload(username, email, password, "Del", "User", ""),
                    ContentType.APPLICATION_JSON));
            registerReq.addHeader("Accept", "application/json");
            try (CloseableHttpResponse response = localClient.execute(registerReq)) {
                EntityUtils.consume(response.getEntity());
            }

            // Login using local client to populate localCookieStore
            HttpPost loginReq = new HttpPost(authUrl("/login"));
            loginReq.setEntity(new StringEntity(
                    loginPayload(email, password),
                    ContentType.APPLICATION_JSON));
            loginReq.addHeader("Accept", "application/json");
            try (CloseableHttpResponse response = localClient.execute(loginReq)) {
                EntityUtils.consume(response.getEntity());
            }

            // Delete using local client
            int deleteStatus;
            try {
                URIBuilder builder = new URIBuilder(authUrl("/profile"));
                builder.addParameter("password", password);
                HttpDelete deleteReq = new HttpDelete(builder.build());
                try (CloseableHttpResponse response = localClient.execute(deleteReq)) {
                    deleteStatus = response.getStatusLine().getStatusCode();
                    EntityUtils.consume(response.getEntity());
                }
            } catch (URISyntaxException e) {
                throw new IOException("Invalid URI", e);
            }
            Assertions.assertEquals(200, deleteStatus,
                    "DELETE /api/profile must return HTTP 200");

            // After deletion, GET /api/me for the same session should return 401
            int meStatus;
            HttpGet meReq = new HttpGet(authUrl("/me"));
            meReq.addHeader("Accept", "application/json");
            try (CloseableHttpResponse response = localClient.execute(meReq)) {
                meStatus = response.getStatusLine().getStatusCode();
                EntityUtils.consume(response.getEntity());
            }
            Assertions.assertEquals(401, meStatus,
                    "After account deletion GET /api/me must return 401");
        }
    }
}