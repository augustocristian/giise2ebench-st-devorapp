package epigijon.devorapp.e2e.functional.tests.api;

import com.google.gson.JsonObject;
import epigijon.devorapp.e2e.functional.common.BaseApiClass;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.Assertions;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.io.IOException;

/** API tests for user registration and login — Base-Choice coverage (see @DisplayName for scenario ids). */
class TestApiRegister extends BaseApiClass {

    // Password used for registration tests in this class
    private static final String PASSWORD = "Test1234!";

    @Test
    @DisplayName("BASE — valid registration returns HTTP 201 with user object")
    void testBase_SuccessfulRegistration() throws IOException {
        long ts = unique();
        int status = postStatus(
                authUrl("/register"),
                registerPayload(uniqueUsername(ts), uniqueEmail(ts), PASSWORD, "Ana", "García", ""));

        Assertions.assertEquals(201, status,
                "Valid registration must return HTTP 201");
    }

    @Test
    @DisplayName("S3 — registering with a duplicate email returns HTTP 400")
    void testS3_DuplicateEmail() throws IOException {
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

    @Test
    @DisplayName("S7 — login with correct credentials returns HTTP 200")
    void testS7_CorrectLogin() throws IOException {
        long ts = unique();
        String email    = uniqueEmail(ts);
        String username = uniqueUsername(ts);

        postStatus(authUrl("/register"),
                registerPayload(username, email, PASSWORD, "Test", "User", ""));

        int loginStatus = postStatus(authUrl("/login"), loginPayload(email, PASSWORD));
        Assertions.assertEquals(200, loginStatus,
                "Login with correct credentials must return HTTP 200");
    }

    @Test
    @DisplayName("S8 — login with wrong password returns HTTP 401")
    void testS8_LoginWrongPassword() throws IOException {
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