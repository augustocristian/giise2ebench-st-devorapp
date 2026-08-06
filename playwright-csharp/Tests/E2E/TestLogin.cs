using DevorApp.E2ETests.Common;
using DevorApp.E2ETests.Pages;
using NUnit.Framework;

namespace DevorApp.E2ETests.Tests.E2E;

/// <summary>
/// Port of epigijon.devorapp.e2e.functional.tests.e2e.TestLogin.
///
/// Browser tests for the DevorApp login page.
///
/// Base-Choice coverage:
///   BASE — valid credentials redirect to /home (S7 - Happy Path).
///   S3–S6 — empty identifier and/or password trigger a validation error (BASE, S3, S4, S5, S6).
///   S8 — wrong password shows an error and stays on /login.
/// </summary>
[TestFixture]
public class TestLogin : BaseLoggedClass
{
    private const string Password = "Test1234!";

    [OneTimeSetUp]
    public async Task CreateTestUser()
    {
        var ts = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds();
        var username = $"tst{ts}";
        if (username.Length > 30) username = username[^30..];
        await SetupTestUserAsync(username, $"testui{ts}@devorapp.test", Password);
    }

    [OneTimeTearDown]
    public async Task CleanupTestUser() => await TeardownTestUserAsync();

    // ── Tests ────────────────────────────────────────────────────────────────

    /// <summary>S7 — valid credentials redirect the user to /home.</summary>
    [Test]
    [Description("Valid credentials redirect the user to the home page (S7)")]
    public async Task TestSuccessfulLogin()
    {
        await GoToLoginAsync();
        var loginPage = await LoginPage.CreateAsync(Page);
        await loginPage.EnterIdentifierAsync(TestEmail!);
        await loginPage.EnterPasswordAsync(Password);
        var home = await loginPage.SubmitLoginAsync();

        Assert.That(home.GetCurrentUrl(), Does.Contain("/home"), "After login the URL must contain /home (S7)");
    }

    /// <summary>BASE, S3–S6, S8 — empty fields and wrong password are rejected with an error.</summary>
    [Test]
    [Description("Empty fields (BASE, S3–S6) and wrong password (S8) trigger validation errors")]
    public async Task TestLoginValidationErrors()
    {
        // 1. BASE: existing email, empty password
        await GoToLoginAsync();
        var page = await LoginPage.CreateAsync(Page);
        await page.EnterIdentifierAsync(TestEmail!);
        await page.EnterPasswordAsync("");
        await page.SubmitLoginExpectingFailureAsync();
        Assert.That(await page.HasErrorMessageAsync(), Is.True, "Error message must show for empty password (BASE)");

        // 2. S3: non-existing email, empty password
        await GoToLoginAsync();
        page = await LoginPage.CreateAsync(Page);
        await page.EnterIdentifierAsync("nonexistent@devorapp.test");
        await page.EnterPasswordAsync("");
        await page.SubmitLoginExpectingFailureAsync();
        Assert.That(await page.HasErrorMessageAsync(), Is.True,
            "Error message must show for non-existing email and empty password (S3)");

        // 3. S4: existing username, empty password
        await GoToLoginAsync();
        page = await LoginPage.CreateAsync(Page);
        await page.EnterIdentifierAsync(TestUsername!);
        await page.EnterPasswordAsync("");
        await page.SubmitLoginExpectingFailureAsync();
        Assert.That(await page.HasErrorMessageAsync(), Is.True,
            "Error message must show for existing username and empty password (S4)");

        // 4. S5: non-existing username, empty password
        await GoToLoginAsync();
        page = await LoginPage.CreateAsync(Page);
        await page.EnterIdentifierAsync("nonexistentuser");
        await page.EnterPasswordAsync("");
        await page.SubmitLoginExpectingFailureAsync();
        Assert.That(await page.HasErrorMessageAsync(), Is.True,
            "Error message must show for non-existing username and empty password (S5)");

        // 5. S6: both fields empty
        await GoToLoginAsync();
        page = await LoginPage.CreateAsync(Page);
        await page.EnterIdentifierAsync("");
        await page.EnterPasswordAsync("");
        await page.SubmitLoginExpectingFailureAsync();
        Assert.That(await page.HasErrorMessageAsync(), Is.True, "Error message must show when both fields are empty (S6)");

        // 6. S8: correct identifier, wrong password
        await GoToLoginAsync();
        page = await LoginPage.CreateAsync(Page);
        await page.EnterIdentifierAsync(TestEmail!);
        await page.EnterPasswordAsync("WrongPassword99!");
        await page.SubmitLoginExpectingFailureAsync();

        Assert.That(await page.HasErrorMessageAsync(), Is.True, "An error message must be visible after a failed login (S8)");
        Assert.That(Page.Url, Does.Contain("/login"), "The URL must remain on /login after a failed attempt (S8)");
    }
}
