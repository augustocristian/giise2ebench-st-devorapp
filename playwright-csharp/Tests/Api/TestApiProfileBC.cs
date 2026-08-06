using System.Text;
using System.Text.Json.Nodes;
using DevorApp.E2ETests.Common;
using NUnit.Framework;

namespace DevorApp.E2ETests.Tests.Api;

/// <summary>
/// Port of epigijon.devorapp.e2e.functional.tests.api.TestApiProfileBC.
///
/// API Base-Choice tests for the user profile module. Adapts the profile
/// scenarios from profile.spec.ts (Playwright/TS) to pure REST assertions.
///
/// Cases covered:
///   BASE   — GET /api/me returns the registered user's data.
///   S2+S3  — PATCH /api/profile updates nombre and apellidos.
///   S8     — PATCH /api/profile/email with wrong password → HTTP 401.
///   S10    — PATCH /api/profile/password with wrong current password → HTTP 400.
///   S13    — PATCH /api/profile/password with new password &lt; 8 chars → HTTP 400.
///   S14    — PATCH /api/profile/password with valid new password → HTTP 200.
///   S17    — DELETE /api/profile removes the account → subsequent GET /api/me → 401.
/// </summary>
[TestFixture]
public class TestApiProfileBC : BaseApiClass
{
    [OneTimeSetUp]
    public async Task AuthSetup()
    {
        var ts = Unique();
        await RegisterAndLoginAsync(UniqueUsername(ts), UniqueEmail(ts), "Test1234!");
    }

    [OneTimeTearDown]
    public async Task AuthTeardown() => await DeleteTestUserAsync();

    // ── BASE: GET /api/me devuelve los datos del usuario ────────────────────

    [Test]
    [Description("BASE — GET /api/me returns the authenticated user's username and email")]
    public async Task TestBase_GetMe()
    {
        var me = await GetJsonObjectAsync(AuthUrl("/me"));

        Assert.That(me["username"]!.GetValue<string>(), Is.EqualTo(TestUsername), "username must match");
        Assert.That(me["email"]!.GetValue<string>(), Is.EqualTo(TestEmail), "email must match");
    }

    // ── S2+S3: actualizar nombre y apellidos ─────────────────────────────────

    [Test]
    [Description("S2+S3 — PATCH /api/profile updates nombre and apellidos; GET /api/me reflects them")]
    public async Task TestS2S3_ActualizarNombreApellidos()
    {
        var newNombre = $"NuevoNombre{Unique()}";
        const string newApellidos = "NuevosApellidos";

        var status = await PatchAsync(AuthUrl("/profile"),
            ProfileUpdatePayload(newNombre, newApellidos, "", TestPassword!));
        Assert.That(status, Is.EqualTo(200), "PATCH /api/profile must return 200");

        var me = await GetJsonObjectAsync(AuthUrl("/me"));
        Assert.That(me["nombre"]!.GetValue<string>(), Is.EqualTo(newNombre), "nombre must be updated");
        Assert.That(me["apellidos"]!.GetValue<string>(), Is.EqualTo(newApellidos), "apellidos must be updated");
    }

    // ── S8: contraseña incorrecta al cambiar email → HTTP 401 ────────────────

    [Test]
    [Description("S8 — PATCH /api/profile/email with wrong password returns HTTP 401")]
    public async Task TestS8_ContrasenaWrongParaEmail()
    {
        var payload = new JsonObject
        {
            ["new_email"] = $"nuevo{Unique()}@devorapp.test",
            ["password"] = "WrongPassword99!",
        };

        var status = await PatchAsync(AuthUrl("/profile/email"), payload);
        Assert.That(status, Is.EqualTo(401), "Wrong password for email change must return HTTP 401");
    }

    // ── S10: contraseña actual incorrecta al cambiar contraseña → HTTP 400 ──

    [Test]
    [Description("S10 — PATCH /api/profile/password with wrong current password is rejected with HTTP 400 or 401")]
    public async Task TestS10_ContrasenaActualIncorrecta()
    {
        var payload = new JsonObject
        {
            ["old_password"] = "WrongCurrent99!",
            ["new_password"] = "NuevaPass123!",
        };

        var status = await PatchAsync(AuthUrl("/profile/password"), payload);
        Assert.That(status, Is.EqualTo(400).Or.EqualTo(401),
            $"Wrong current password must be rejected (400/401), got: {status}");
    }

    // ── S13: contraseña nueva muy corta → HTTP 400 ───────────────────────────

    [Test]
    [Description("S13 — PATCH /api/profile/password with new password < 8 chars returns HTTP 400")]
    public async Task TestS13_NuevaContrasenaMuyCorta()
    {
        var payload = new JsonObject
        {
            ["old_password"] = TestPassword,
            ["new_password"] = "Sh1!", // 4 chars
        };

        var status = await PatchAsync(AuthUrl("/profile/password"), payload);
        Assert.That(status, Is.EqualTo(400), "New password shorter than 8 chars must return HTTP 400");
    }

    // ── S14: cambio de contraseña correcto → HTTP 200 ────────────────────────

    [Test]
    [Description("S14 — PATCH /api/profile/password with valid credentials returns HTTP 200")]
    public async Task TestS14_CambioContrasenaOk()
    {
        const string newPass = "NuevaPassword1234!";
        var payload = new JsonObject { ["old_password"] = TestPassword, ["new_password"] = newPass };

        var status = await PatchAsync(AuthUrl("/profile/password"), payload);
        Assert.That(status, Is.EqualTo(200), "Valid password change must return HTTP 200");

        // Restore original password so other tests and teardown are not affected
        var restore = new JsonObject { ["old_password"] = newPass, ["new_password"] = TestPassword };
        await PatchAsync(AuthUrl("/profile/password"), restore);
    }

    // ── S17: eliminar cuenta → GET /api/me → 401 ─────────────────────────────

    [Test]
    [Description("S17 — DELETE /api/profile removes the account; subsequent GET /api/me returns 401")]
    public async Task TestS17_EliminarCuenta()
    {
        var ts = Unique();
        var email = UniqueEmail(ts);
        var username = UniqueUsername(ts);
        const string password = "Delete1234!";

        using var localClient = new HttpClient();

        await localClient.PostAsync(AuthUrl("/register"),
            JsonBody(RegisterPayload(username, email, password, "Del", "User", "")));
        await localClient.PostAsync(AuthUrl("/login"), JsonBody(LoginPayload(email, password)));

        var deleteResponse = await localClient.DeleteAsync(AuthUrl($"/profile?password={Uri.EscapeDataString(password)}"));
        Assert.That((int)deleteResponse.StatusCode, Is.EqualTo(200), "DELETE /api/profile must return HTTP 200");

        var meResponse = await localClient.GetAsync(AuthUrl("/me"));
        Assert.That((int)meResponse.StatusCode, Is.EqualTo(401),
            "After account deletion GET /api/me must return 401");
    }

    private static StringContent JsonBody(JsonNode payload) =>
        new(payload.ToJsonString(), Encoding.UTF8, "application/json");
}
