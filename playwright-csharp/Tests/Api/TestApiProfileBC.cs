using System.Text;
using System.Text.Json.Nodes;
using DevorApp.E2ETests.Common;
using NUnit.Framework;

namespace DevorApp.E2ETests.Tests.Api;

/// <summary>
///
/// API Base-Choice tests for the user profile module.
///
/// Cases covered:
///   BASE   — GET /api/v1/me returns the registered user's data.
///   S2+S3  — PATCH /api/v1/profile updates first_name and last_name.
///   S8     — PATCH /api/v1/profile/email with wrong password → HTTP 401.
///   S10    — PATCH /api/v1/profile/password with wrong current password → HTTP 400.
///   S13    — PATCH /api/v1/profile/password with new password &lt; 8 chars → HTTP 422.
///   S14    — PATCH /api/v1/profile/password with valid new password → HTTP 200.
///   S17    — DELETE /api/v1/profile removes the account → subsequent GET /api/v1/me → 401.
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


    [Test]
    [Description("BASE — GET /api/v1/me returns the authenticated user's username and email")]
    public async Task TestBase_GetMe()
    {
        var me = await GetJsonObjectAsync(AuthUrl("/me"));

        Assert.That(me["username"]!.GetValue<string>(), Is.EqualTo(TestUsername), "username must match");
        Assert.That(me["email"]!.GetValue<string>(), Is.EqualTo(TestEmail), "email must match");
    }


    [Test]
    [Description("S2+S3 — PATCH /api/v1/profile updates first_name and last_name; GET /api/v1/me reflects them")]
    public async Task TestS2S3_UpdateNameAndSurname()
    {
        var newFirstName = $"NewFirst{Unique()}";
        const string newLastName = "NewLast";

        var status = await PatchAsync(AuthUrl("/profile"),
            ProfileUpdatePayload(newFirstName, newLastName, "", TestPassword!));
        Assert.That(status, Is.EqualTo(200), "PATCH /api/v1/profile must return 200");

        var me = await GetJsonObjectAsync(AuthUrl("/me"));
        Assert.That(me["first_name"]!.GetValue<string>(), Is.EqualTo(newFirstName), "first_name must be updated");
        Assert.That(me["last_name"]!.GetValue<string>(), Is.EqualTo(newLastName), "last_name must be updated");
    }


    [Test]
    [Description("S8 — PATCH /api/v1/profile/email with wrong password returns HTTP 401")]
    public async Task TestS8_WrongPasswordForEmail()
    {
        var payload = new JsonObject
        {
            ["new_email"] = $"new{Unique()}@devorapp.test",
            ["password"] = "WrongPassword99!",
        };

        var status = await PatchAsync(AuthUrl("/profile/email"), payload);
        Assert.That(status, Is.EqualTo(401), "Wrong password for email change must return HTTP 401");
    }


    [Test]
    [Description("S10 — PATCH /api/v1/profile/password with wrong current password is rejected with HTTP 400 or 401")]
    public async Task TestS10_WrongCurrentPassword()
    {
        var payload = new JsonObject
        {
            ["old_password"] = "WrongCurrent99!",
            ["new_password"] = "NewPass123!",
        };

        var status = await PatchAsync(AuthUrl("/profile/password"), payload);
        Assert.That(status, Is.EqualTo(400).Or.EqualTo(401),
            $"Wrong current password must be rejected (400/401), got: {status}");
    }


    [Test]
    [Description("S13 — PATCH /api/v1/profile/password with new password < 8 chars returns HTTP 422")]
    public async Task TestS13_NewPasswordTooShort()
    {
        var payload = new JsonObject
        {
            ["old_password"] = TestPassword,
            ["new_password"] = "Sh1!", // 4 chars
        };

        var status = await PatchAsync(AuthUrl("/profile/password"), payload);
        Assert.That(status, Is.EqualTo(422), "New password shorter than 8 chars must return HTTP 422");
    }


    [Test]
    [Description("S14 — PATCH /api/v1/profile/password with valid credentials returns HTTP 200")]
    public async Task TestS14_PasswordChangeOk()
    {
        const string newPass = "NewPassword1234!";
        var payload = new JsonObject { ["old_password"] = TestPassword, ["new_password"] = newPass };

        var status = await PatchAsync(AuthUrl("/profile/password"), payload);
        Assert.That(status, Is.EqualTo(200), "Valid password change must return HTTP 200");

        // Restore original password so other tests and teardown are not affected
        var restore = new JsonObject { ["old_password"] = newPass, ["new_password"] = TestPassword };
        await PatchAsync(AuthUrl("/profile/password"), restore);
    }


    [Test]
    [Description("S17 — DELETE /api/v1/profile removes the account; subsequent GET /api/v1/me returns 401")]
    public async Task TestS17_DeleteAccount()
    {
        var ts = Unique();
        var email = UniqueEmail(ts);
        var username = UniqueUsername(ts);
        const string password = "Delete1234!";

        using var localClient = new HttpClient();

        await localClient.PostAsync(AuthUrl("/users"),
            JsonBody(RegisterPayload(username, email, password, "Del", "User", "")));
        await localClient.PostAsync(AuthUrl("/sessions"), JsonBody(LoginPayload(email, password)));

        var deleteResponse = await localClient.DeleteAsync(AuthUrl($"/profile?password={Uri.EscapeDataString(password)}"));
        Assert.That((int)deleteResponse.StatusCode, Is.EqualTo(200), "DELETE /api/v1/profile must return HTTP 200");

        var meResponse = await localClient.GetAsync(AuthUrl("/me"));
        Assert.That((int)meResponse.StatusCode, Is.EqualTo(401),
            "After account deletion GET /api/v1/me must return 401");
    }

    private static StringContent JsonBody(JsonNode payload) =>
        new(payload.ToJsonString(), Encoding.UTF8, "application/json");
}
