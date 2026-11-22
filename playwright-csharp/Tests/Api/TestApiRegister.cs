using DevorApp.E2ETests.Common;
using NUnit.Framework;

namespace DevorApp.E2ETests.Tests.Api;

/// <summary>
///
/// API tests for user registration and login — Base-Choice coverage.
///
/// Cases covered:
///   BASE   — valid registration returns HTTP 201 with user object.
///   S3     — already-used email → HTTP 409 (email taken).
///   S7     — login with correct credentials → HTTP 201.
///   S8     — login with wrong password → HTTP 401.
///   check  — GET /api/v1/users/availability reflects email/username status.
/// </summary>
[TestFixture]
public class TestApiRegister : BaseApiClass
{
    private const string Password = "Test1234!";


    [Test]
    [Description("BASE — valid registration returns HTTP 201 with user object")]
    public async Task TestBase_SuccessfulRegistration()
    {
        var ts = Unique();
        var status = await PostStatusAsync(AuthUrl("/users"),
            RegisterPayload(UniqueUsername(ts), UniqueEmail(ts), Password, "Ana", "García", ""));

        Assert.That(status, Is.EqualTo(201), "Valid registration must return HTTP 201");
    }


    [Test]
    [Description("S3 — registering with a duplicate email returns HTTP 409")]
    public async Task TestS3_DuplicateEmail()
    {
        var ts = Unique();
        var email = UniqueEmail(ts);
        var username = UniqueUsername(ts);

        // First registration — must succeed
        await PostStatusAsync(AuthUrl("/users"), RegisterPayload(username, email, Password, "Ana", "García", ""));

        // Second registration with same email but different username
        var secondStatus = await PostStatusAsync(AuthUrl("/users"),
            RegisterPayload(UniqueUsername(Unique()), email, Password, "Ana", "García", ""));

        Assert.That(secondStatus, Is.EqualTo(409),
            "Registering with a duplicate email must return HTTP 409");
    }


    [Test]
    [Description("users/availability — email free returns email_taken=false; after registration email_taken=true")]
    public async Task TestCheckAvailabilityEmail()
    {
        var ts = Unique();
        var email = UniqueEmail(ts);
        var username = UniqueUsername(ts);

        var before = await GetJsonObjectAsync(AuthUrl($"/users/availability?email={email}"));
        Assert.That(before["email_taken"]!.GetValue<bool>(), Is.False, "email_taken must be false before registration");

        await PostStatusAsync(AuthUrl("/users"), RegisterPayload(username, email, Password, "Test", "User", ""));

        var after = await GetJsonObjectAsync(AuthUrl($"/users/availability?email={email}"));
        Assert.That(after["email_taken"]!.GetValue<bool>(), Is.True, "email_taken must be true after registration");
    }


    [Test]
    [Description("users/availability — username free returns username_taken=false; after registration username_taken=true")]
    public async Task TestCheckAvailabilityUsername()
    {
        var ts = Unique();
        var email = UniqueEmail(ts);
        var username = UniqueUsername(ts);

        var before = await GetJsonObjectAsync(AuthUrl($"/users/availability?username={username}"));
        Assert.That(before["username_taken"]!.GetValue<bool>(), Is.False, "username_taken must be false before registration");

        await PostStatusAsync(AuthUrl("/users"), RegisterPayload(username, email, Password, "Test", "User", ""));

        var after = await GetJsonObjectAsync(AuthUrl($"/users/availability?username={username}"));
        Assert.That(after["username_taken"]!.GetValue<bool>(), Is.True, "username_taken must be true after registration");
    }


    [Test]
    [Description("S7 — login with correct credentials returns HTTP 201")]
    public async Task TestS7_CorrectLogin()
    {
        var ts = Unique();
        var email = UniqueEmail(ts);
        var username = UniqueUsername(ts);

        await PostStatusAsync(AuthUrl("/users"), RegisterPayload(username, email, Password, "Test", "User", ""));

        var loginStatus = await PostStatusAsync(AuthUrl("/sessions"), LoginPayload(email, Password));
        Assert.That(loginStatus, Is.EqualTo(201), "Login with correct credentials must return HTTP 201");
    }


    [Test]
    [Description("S8 — login with wrong password returns HTTP 401")]
    public async Task TestS8_LoginWrongPassword()
    {
        var ts = Unique();
        var email = UniqueEmail(ts);
        var username = UniqueUsername(ts);

        await PostStatusAsync(AuthUrl("/users"), RegisterPayload(username, email, Password, "Test", "User", ""));

        var loginStatus = await PostStatusAsync(AuthUrl("/sessions"), LoginPayload(email, "WrongPassword99!"));
        Assert.That(loginStatus, Is.EqualTo(401), "Login with wrong password must return HTTP 401");
    }
}
