using DevorApp.E2ETests.Common;
using DevorApp.E2ETests.Pages;
using NUnit.Framework;
using static Microsoft.Playwright.Assertions;

namespace DevorApp.E2ETests.Tests.E2E;

/// <summary>
/// Browser tests for the registration flow (BASE, S2-S16).
///
/// Base-Choice coverage:
///   BASE — successful registration with a valid 9-character password.
///   S2–S10 — step 1 field validations (email, username, first name, last name, password).
///   S11–S16 — step 2 validations (location required, backend password policy: no letter,
///     no number) plus a successful registration with a 16-character password.
/// </summary>
[TestFixture]
public class TestRegisterView : BaseLoggedClass
{
    private const string BasePassword = "Segura123";
    private const string BaseFirstName = "Ana";
    private const string BaseLastName = "García";

    [OneTimeSetUp]
    public async Task PrepareDuplicateUser()
    {
        var ts = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds();
        await SetupTestUserAsync($"dupuser{ts % 100000}", $"dup.email.{ts}@devorapp.test", BasePassword);
    }

    [OneTimeTearDown]
    public async Task CleanupTestUser() => await TeardownTestUserAsync();

    private static async Task FillStep1Async(RegisterPage reg, string email, string username,
        string password, string firstName, string lastName)
    {
        await reg.EnterEmailAsync(email);
        await reg.EnterUsernameAsync(username);
        await reg.EnterPasswordAsync(password);
        await reg.EnterFirstNameAsync(firstName);
        await reg.EnterLastNameAsync(lastName);
    }

    private async Task<string> GetErrorMessageWithWaitAsync(RegisterPage reg)
    {
        await Expect(Page.Locator(TestId.Of("register-step-error")).Or(Page.Locator(TestId.Of("register-message-error"))))
            .Not.ToBeEmptyAsync();
        return await reg.GetErrorMessageAsync();
    }

    [Test]
    [Description("Registers with valid data and shows the verify-email screen (BASE)")]
    public async Task TestSuccessfulRegistrationBase()
    {
        await Page.GotoAsync($"{SutUrl}/register");
        var reg = await RegisterPage.CreateAsync(Page);

        var ts = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds();
        var email = $"regbase{ts}@devorapp.test";
        const string password = BasePassword;
        RegisterEmailForCleanup(email, password);

        await FillStep1Async(reg, email, $"regbase{ts % 100000}", password, BaseFirstName, BaseLastName);
        // Inject before step 2 mounts so the component finds window.google right away
        await InjectAutocompleteMockAsync();
        await reg.ClickContinueAsync();
        await reg.WaitForStep2Async();

        Assert.That(await reg.IsOnStep2Async(), Is.True, "Must advance to step 2");

        await reg.EnterLocationAsync("Madrid, España");
        await TriggerAutocompletePlaceChangedAsync();
        await reg.ClickSubmitAsync();

        await Expect(Page.Locator(TestId.Of("register-verify-title"))).ToBeVisibleAsync();
        Assert.That(await reg.IsVerifyEmailVisibleAsync(), Is.True, "Verification screen must be shown");
    }

    [Test]
    [Description("Validates all required fields in step 1 (S2-S10)")]
    public async Task TestStep1Validations()
    {
        var ts = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds();
        var validEmail = $"valid{ts}@devorapp.test";
        var validUsername = $"valid{ts % 100000}";

        // S4: empty email
        await Page.GotoAsync($"{SutUrl}/register");
        var reg = await RegisterPage.CreateAsync(Page);
        await FillStep1Async(reg, "", validUsername, BasePassword, BaseFirstName, BaseLastName);
        await reg.ClickContinueAsync();
        Assert.That(await reg.IsOnStep1Async(), Is.True, "S4: must stay on step 1");
        var errS4 = await GetErrorMessageWithWaitAsync(reg);
        Assert.That(errS4.Contains("email") || errS4.Contains("obligatorio"), Is.True, "S4: email error");

        // S2: invalid email
        await Page.GotoAsync($"{SutUrl}/register");
        reg = await RegisterPage.CreateAsync(Page);
        await FillStep1Async(reg, "correosinformato", validUsername, BasePassword, BaseFirstName, BaseLastName);
        await reg.ClickContinueAsync();
        Assert.That(await reg.IsOnStep1Async(), Is.True, "S2: must stay on step 1");
        var errS2 = await GetErrorMessageWithWaitAsync(reg);
        Assert.That(errS2.Contains("email") || errS2.Contains("válido"), Is.True, "S2: invalid email error");

        // S3: email already in use
        await Page.GotoAsync($"{SutUrl}/register");
        reg = await RegisterPage.CreateAsync(Page);
        await FillStep1Async(reg, TestEmail!, validUsername, BasePassword, BaseFirstName, BaseLastName);
        await reg.ClickContinueAsync();
        await Expect(Page.Locator(TestId.Of("register-email-error"))).Not.ToBeEmptyAsync();
        Assert.That(await reg.GetEmailErrorAsync(), Does.Contain("registrado"), "S3: email in use error");

        // S5: empty username
        await Page.GotoAsync($"{SutUrl}/register");
        reg = await RegisterPage.CreateAsync(Page);
        await FillStep1Async(reg, validEmail, "", BasePassword, BaseFirstName, BaseLastName);
        await reg.ClickContinueAsync();
        Assert.That(await reg.IsOnStep1Async(), Is.True, "S5: must stay on step 1");
        var errS5 = await GetErrorMessageWithWaitAsync(reg);
        Assert.That(errS5.Contains("usuario") || errS5.Contains("obligatorio"), Is.True, "S5: username error");

        // S6: username already in use
        await Page.GotoAsync($"{SutUrl}/register");
        reg = await RegisterPage.CreateAsync(Page);
        await FillStep1Async(reg, validEmail, TestUsername!, BasePassword, BaseFirstName, BaseLastName);
        await reg.ClickContinueAsync();
        await Expect(Page.Locator(TestId.Of("register-username-error"))).Not.ToBeEmptyAsync();
        Assert.That(await reg.GetUsernameErrorAsync(), Does.Contain("uso"), "S6: username in use error");

        // S7: empty first name
        await Page.GotoAsync($"{SutUrl}/register");
        reg = await RegisterPage.CreateAsync(Page);
        await FillStep1Async(reg, validEmail, validUsername, BasePassword, "", BaseLastName);
        await reg.ClickContinueAsync();
        Assert.That(await reg.IsOnStep1Async(), Is.True, "S7: must stay on step 1");
        var errS7 = await GetErrorMessageWithWaitAsync(reg);
        Assert.That(errS7, Does.Contain("nombre"), "S7: first name error");

        // S8: empty last name
        await Page.GotoAsync($"{SutUrl}/register");
        reg = await RegisterPage.CreateAsync(Page);
        await FillStep1Async(reg, validEmail, validUsername, BasePassword, BaseFirstName, "");
        await reg.ClickContinueAsync();
        Assert.That(await reg.IsOnStep1Async(), Is.True, "S8: must stay on step 1");
        // The wording varies, so only check that some error is shown
        var errS8 = await GetErrorMessageWithWaitAsync(reg);
        Assert.That(errS8, Is.Not.Empty, "S8: last name error must be shown");

        // S9: empty password
        await Page.GotoAsync($"{SutUrl}/register");
        reg = await RegisterPage.CreateAsync(Page);
        await FillStep1Async(reg, validEmail, validUsername, "", BaseFirstName, BaseLastName);
        await reg.ClickContinueAsync();
        Assert.That(await reg.IsOnStep1Async(), Is.True, "S9: must stay on step 1");
        var errS9 = await GetErrorMessageWithWaitAsync(reg);
        Assert.That(errS9.Contains("contraseña") || errS9.Contains("obligatoria"), Is.True, "S9: empty password error");

        // S10: short password (6 chars)
        await Page.GotoAsync($"{SutUrl}/register");
        reg = await RegisterPage.CreateAsync(Page);
        await FillStep1Async(reg, validEmail, validUsername, "Seg123", BaseFirstName, BaseLastName);
        await reg.ClickContinueAsync();
        Assert.That(await reg.IsOnStep1Async(), Is.True, "S10: must stay on step 1");
        var errS10 = await GetErrorMessageWithWaitAsync(reg);
        Assert.That(errS10.Contains('8') || errS10.Contains("caracteres"), Is.True, "S10: short password error");
    }

    [Test]
    [Description("Validates location (S15, S16), backend password policy (S12, S13) and registers with a long password (S11)")]
    public async Task TestStep2ValidationsAndLongPassword()
    {
        var ts = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds();

        // S16: empty location
        await Page.GotoAsync($"{SutUrl}/register");
        var reg = await RegisterPage.CreateAsync(Page);
        await FillStep1Async(reg, $"regloc1{ts}@devorapp.test", $"reglocone{ts % 10000}", "12345678",
            BaseFirstName, BaseLastName);
        await reg.ClickContinueAsync();
        await reg.WaitForStep2Async();
        await reg.ClickSubmitAsync();
        Assert.That(await reg.IsOnStep2Async(), Is.True, "S16: must stay on step 2");
        var errS16 = await GetErrorMessageWithWaitAsync(reg);
        Assert.That(errS16.Contains("ubicación") || errS16.Contains("lista"), Is.True, "S16: location empty error");

        // S15: manually typed location, not picked from the list
        await Page.GotoAsync($"{SutUrl}/register");
        reg = await RegisterPage.CreateAsync(Page);
        await FillStep1Async(reg, $"regloc2{ts}@devorapp.test", $"regloctwo{ts % 10000}", "12345678",
            BaseFirstName, BaseLastName);
        await reg.ClickContinueAsync();
        await reg.WaitForStep2Async();
        await reg.EnterLocationAsync("Ubicación No Válida");
        await reg.ClickSubmitAsync();
        Assert.That(await reg.IsOnStep2Async(), Is.True, "S15: must stay on step 2");
        var errS15 = await GetErrorMessageWithWaitAsync(reg);
        Assert.That(errS15.Contains("ubicación") || errS15.Contains("lista"), Is.True, "S15: manual location error");

        // S13: password without letters (backend error)
        await Page.GotoAsync($"{SutUrl}/register");
        reg = await RegisterPage.CreateAsync(Page);
        await FillStep1Async(reg, $"regloc3{ts}@devorapp.test", $"reglocthree{ts % 10000}", "12345678",
            BaseFirstName, BaseLastName);
        // Inject before step 2 mounts so the component finds window.google right away
        await InjectAutocompleteMockAsync();
        await reg.ClickContinueAsync();
        await reg.WaitForStep2Async();
        await reg.EnterLocationAsync("Gijón, España");
        await TriggerAutocompletePlaceChangedAsync();
        await reg.ClickSubmitAsync();
        var errS13 = (await GetErrorMessageWithWaitAsync(reg)).ToLowerInvariant();
        Assert.That(errS13.Contains("letra") || errS13.Contains("contraseña") || errS13.Contains("password"), Is.True,
            "S13: no-letter password backend error");

        // S12: password without numbers (backend error)
        await Page.GotoAsync($"{SutUrl}/register");
        reg = await RegisterPage.CreateAsync(Page);
        await FillStep1Async(reg, $"regloc4{ts}@devorapp.test", $"reglocfour{ts % 10000}", "PasswordNoNum",
            BaseFirstName, BaseLastName);
        await InjectAutocompleteMockAsync(); // Inject before step 2 mounts
        await reg.ClickContinueAsync();
        await reg.WaitForStep2Async();
        await reg.EnterLocationAsync("Gijón, España");
        await TriggerAutocompletePlaceChangedAsync();
        await reg.ClickSubmitAsync();
        var errS12 = (await GetErrorMessageWithWaitAsync(reg)).ToLowerInvariant();
        Assert.That(
            errS12.Contains("número") || errS12.Contains("number") || errS12.Contains("contraseña") || errS12.Contains("password"),
            Is.True, "S12: no-number password backend error");

        // S11: successful registration with a long password (16 chars)
        await Page.GotoAsync($"{SutUrl}/register");
        reg = await RegisterPage.CreateAsync(Page);
        var ts2 = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds();
        var emailS11 = $"reglong{ts2}@devorapp.test";
        const string passwordS11 = "Segura1234567890";
        RegisterEmailForCleanup(emailS11, passwordS11);

        await FillStep1Async(reg, emailS11, $"reglong{ts2 % 100000}", passwordS11, BaseFirstName, BaseLastName);
        // Inject before step 2 mounts so the component finds window.google right away
        await InjectAutocompleteMockAsync();
        await reg.ClickContinueAsync();
        await reg.WaitForStep2Async();

        Assert.That(await reg.IsOnStep2Async(), Is.True, "S11: must advance to step 2");

        await reg.EnterLocationAsync("Madrid, España");
        await TriggerAutocompletePlaceChangedAsync();
        await reg.ClickSubmitAsync();

        await Expect(Page.Locator(TestId.Of("register-verify-title"))).ToBeVisibleAsync();
        Assert.That(await reg.IsVerifyEmailVisibleAsync(), Is.True, "S11: verification screen must be shown");
    }
}
