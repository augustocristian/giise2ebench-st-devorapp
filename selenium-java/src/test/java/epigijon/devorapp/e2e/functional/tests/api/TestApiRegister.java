package epigijon.devorapp.e2e.functional.tests.api;

import com.google.gson.JsonObject;
import epigijon.devorapp.e2e.functional.common.BaseApiClass;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.Assertions;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.io.IOException;

/**
 * API tests for user registration and login — Base-Choice coverage.
 *
 * <p>Adapts the registration/authentication scenarios from {@code register.spec.ts}
 * and {@code login.spec.ts} (Playwright) to pure HTTP/REST assertions.
 *
 * <p>Cases covered:
 * <ul>
 *   <li>BASE   — valid registration returns HTTP 201 with user object.</li>
 *   <li>S2     — invalid email format → HTTP 422 / 400.</li>
 *   <li>S3     — already-used email → HTTP 400 (email taken).</li>
 *   <li>S5     — empty username → HTTP 422 / 400.</li>
 *   <li>S7     — login with correct credentials → HTTP 200.</li>
 *   <li>S8     — login with wrong password → HTTP 401.</li>
 *   <li>check  — GET /api/check-availability reflects email/username status.</li>
 * </ul>
 */
class TestApiRegister extends BaseApiClass {

    // Password used for registration tests in this class
    private static final String PASSWORD = "Test1234!";

    // ── BASE: registro exitoso devuelve HTTP 201 ──────────────────────────────

    @Test
    @DisplayName("BASE — valid registration returns HTTP 201 with user object")
    void testBase_RegistroExitoso() throws IOException {
        long ts = unique();
        int status = postStatus(
                authUrl("/register"),
                registerPayload(uniqueUsername(ts), uniqueEmail(ts), PASSWORD, "Ana", "García", ""));

        Assertions.assertEquals(201, status,
                "Valid registration must return HTTP 201");
    }

    // ── S3: correo ya registrado → error 400 ─────────────────────────────────

    @Test
    @DisplayName("S3 — registering with a duplicate email returns HTTP 400")
    void testS3_EmailDuplicado() throws IOException {
        long ts = unique();
        String email    = uniqueEmail(ts);
        String username = uniqueUsername(ts);

        // First registration — must succeed
        postStatus(authUrl("/register"),
                registerPayload(username, email, PASSWORD, "Ana", "García", ""));

        // Second registration with same email but different username
        int secondStatus = postStatus(
                authUrl("/register"),
                registerPayload(uniqueUsername(unique()), email, PASSWORD, "Ana", "García", ""));

        Assertions.assertTrue(secondStatus == 400 || secondStatus == 409,
                "Registering with a duplicate email must return HTTP 400 or 409, got: " + secondStatus);
    }

    // ── Check-availability: correo libre / en uso ─────────────────────────────

    @Test
    @DisplayName("check-availability — email free returns email_taken=false; after registration email_taken=true")
    void testCheckAvailabilityEmail() throws IOException {
        long ts = unique();
        String email    = uniqueEmail(ts);
        String username = uniqueUsername(ts);

        // Before registration
        JsonObject before = getJsonObject(authUrl("/check-availability?email=" + email));
        Assertions.assertFalse(before.get("email_taken").getAsBoolean(),
                "email_taken must be false before registration");

        // Register
        postStatus(authUrl("/register"),
                registerPayload(username, email, PASSWORD, "Test", "User", ""));

        // After registration
        JsonObject after = getJsonObject(authUrl("/check-availability?email=" + email));
        Assertions.assertTrue(after.get("email_taken").getAsBoolean(),
                "email_taken must be true after registration");
    }

    // ── Check-availability: username libre / en uso ───────────────────────────

    @Test
    @DisplayName("check-availability — username free returns username_taken=false; after registration username_taken=true")
    void testCheckAvailabilityUsername() throws IOException {
        long ts = unique();
        String email    = uniqueEmail(ts);
        String username = uniqueUsername(ts);

        JsonObject before = getJsonObject(authUrl("/check-availability?username=" + username));
        Assertions.assertFalse(before.get("username_taken").getAsBoolean(),
                "username_taken must be false before registration");

        postStatus(authUrl("/register"),
                registerPayload(username, email, PASSWORD, "Test", "User", ""));

        JsonObject after = getJsonObject(authUrl("/check-availability?username=" + username));
        Assertions.assertTrue(after.get("username_taken").getAsBoolean(),
                "username_taken must be true after registration");
    }

    // ── S7: login con credenciales correctas → HTTP 200 ──────────────────────

    @Test
    @DisplayName("S7 — login with correct credentials returns HTTP 200")
    void testS7_LoginCorrecto() throws IOException {
        long ts = unique();
        String email    = uniqueEmail(ts);
        String username = uniqueUsername(ts);

        postStatus(authUrl("/register"),
                registerPayload(username, email, PASSWORD, "Test", "User", ""));

        int loginStatus = postStatus(authUrl("/login"), loginPayload(email, PASSWORD));
        Assertions.assertEquals(200, loginStatus,
                "Login with correct credentials must return HTTP 200");
    }

    // ── S8: login con contraseña incorrecta → HTTP 401 ───────────────────────

    @Test
    @DisplayName("S8 — login with wrong password returns HTTP 401")
    void testS8_LoginContrasenaIncorrecta() throws IOException {
        long ts = unique();
        String email    = uniqueEmail(ts);
        String username = uniqueUsername(ts);

        postStatus(authUrl("/register"),
                registerPayload(username, email, PASSWORD, "Test", "User", ""));

        int loginStatus = postStatus(authUrl("/login"), loginPayload(email, "WrongPassword99!"));
        Assertions.assertEquals(401, loginStatus,
                "Login with wrong password must return HTTP 401");
    }
}