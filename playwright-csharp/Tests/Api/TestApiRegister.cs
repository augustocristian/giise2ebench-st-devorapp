using DevorApp.E2ETests.Common;
using NUnit.Framework;

namespace DevorApp.E2ETests.Tests.Api;

/// <summary>
/// Port of epigijon.devorapp.e2e.functional.tests.api.TestApiRegister.
///
/// API tests for user registration and login — Base-Choice coverage.
/// Adapts the registration/authentication scenarios from register.spec.ts
/// and login.spec.ts (Playwright/TS) to pure HTTP/REST assertions.
///
/// Cases covered:
///   BASE   — valid registration returns HTTP 201 with user object.
///   S3     — already-used email → HTTP 400 (email taken).
///   S7     — login with correct credentials → HTTP 200.
///   S8     — login with wrong password → HTTP 401.
///   check  — GET /api/check-availability reflects email/username status.
/// </summary>
[TestFixture]
public class TestApiRegister : BaseApiClass
{
    private const string Password = "Test1234!";

    // ── BASE: registro exitoso devuelve HTTP 201 ──────────────────────────────

    [Test]
    [Description("BASE — valid registration returns HTTP 201 with user object")]
    public async Task TestBase_RegistroExitoso()
    {
        var ts = Unique();
        var status = await PostStatusAsync(AuthUrl("/register"),
            RegisterPayload(UniqueUsername(ts), UniqueEmail(ts), Password, "Ana", "García", ""));

        Assert.That(status, Is.EqualTo(201), "Valid registration must return HTTP 201");
    }

    // ── S3: correo ya registrado → error 400 ─────────────────────────────────

    [Test]
    [Description("S3 — registering with a duplicate email returns HTTP 400")]
    public async Task TestS3_EmailDuplicado()
    {
        var ts = Unique();
        var email = UniqueEmail(ts);
        var username = UniqueUsername(ts);

        // First registration — must succeed
        await PostStatusAsync(AuthUrl("/register"), RegisterPayload(username, email, Password, "Ana", "García", ""));

        // Second registration with same email but different username
        var secondStatus = await PostStatusAsync(AuthUrl("/register"),
            RegisterPayload(UniqueUsername(Unique()), email, Password, "Ana", "García", ""));

        Assert.That(secondStatus, Is.EqualTo(400).Or.EqualTo(409),
            $"Registering with a duplicate email must return HTTP 400 or 409, got: {secondStatus}");
    }

    // ── Check-availability: correo libre / en uso ─────────────────────────────

    [Test]
    [Description("check-availability — email free returns email_taken=false; after registration email_taken=true")]
    public async Task TestCheckAvailabilityEmail()
    {
        var ts = Unique();
        var email = UniqueEmail(ts);
        var username = UniqueUsername(ts);

        var before = await GetJsonObjectAsync(AuthUrl($"/check-availability?email={email}"));
        Assert.That(before["email_taken"]!.GetValue<bool>(), Is.False, "email_taken must be false before registration");

        await PostStatusAsync(AuthUrl("/register"), RegisterPayload(username, email, Password, "Test", "User", ""));

        var after = await GetJsonObjectAsync(AuthUrl($"/check-availability?email={email}"));
        Assert.That(after["email_taken"]!.GetValue<bool>(), Is.True, "email_taken must be true after registration");
    }

    // ── Check-availability: username libre / en uso ───────────────────────────

    [Test]
    [Description("check-availability — username free returns username_taken=false; after registration username_taken=true")]
    public async Task TestCheckAvailabilityUsername()
    {
        var ts = Unique();
        var email = UniqueEmail(ts);
        var username = UniqueUsername(ts);

        var before = await GetJsonObjectAsync(AuthUrl($"/check-availability?username={username}"));
        Assert.That(before["username_taken"]!.GetValue<bool>(), Is.False, "username_taken must be false before registration");

        await PostStatusAsync(AuthUrl("/register"), RegisterPayload(username, email, Password, "Test", "User", ""));

        var after = await GetJsonObjectAsync(AuthUrl($"/check-availability?username={username}"));
        Assert.That(after["username_taken"]!.GetValue<bool>(), Is.True, "username_taken must be true after registration");
    }

    // ── S7: login con credenciales correctas → HTTP 200 ──────────────────────

    [Test]
    [Description("S7 — login with correct credentials returns HTTP 200")]
    public async Task TestS7_LoginCorrecto()
    {
        var ts = Unique();
        var email = UniqueEmail(ts);
        var username = UniqueUsername(ts);

        await PostStatusAsync(AuthUrl("/register"), RegisterPayload(username, email, Password, "Test", "User", ""));

        var loginStatus = await PostStatusAsync(AuthUrl("/login"), LoginPayload(email, Password));
        Assert.That(loginStatus, Is.EqualTo(200), "Login with correct credentials must return HTTP 200");
    }

    // ── S8: login con contraseña incorrecta → HTTP 401 ───────────────────────

    [Test]
    [Description("S8 — login with wrong password returns HTTP 401")]
    public async Task TestS8_LoginContrasenaIncorrecta()
    {
        var ts = Unique();
        var email = UniqueEmail(ts);
        var username = UniqueUsername(ts);

        await PostStatusAsync(AuthUrl("/register"), RegisterPayload(username, email, Password, "Test", "User", ""));

        var loginStatus = await PostStatusAsync(AuthUrl("/login"), LoginPayload(email, "WrongPassword99!"));
        Assert.That(loginStatus, Is.EqualTo(401), "Login with wrong password must return HTTP 401");
    }
}
