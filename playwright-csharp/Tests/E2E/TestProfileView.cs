using DevorApp.E2ETests.Common;
using DevorApp.E2ETests.Pages;
using NUnit.Framework;
using static Microsoft.Playwright.Assertions;

namespace DevorApp.E2ETests.Tests.E2E;

/// <summary>
/// Browser tests for the profile page (/profile).
///
/// Base-Choice coverage:
///   BASE — profile data loads and an invalid location update is rejected.
///   S2–S4 — save first/last name and a valid location update.
///   S5–S9 — email change validations and happy path.
///   S10–S16 — password change validations and happy path.
///   S17 — account deletion.
/// </summary>
[TestFixture]
public class TestProfileView : BaseLoggedClass
{
    [OneTimeSetUp]
    public async Task CreateTestUser()
    {
        var ts = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds();
        await SetupTestUserAsync($"profui{ts % 100000}", $"profui{ts}@devorapp.test", "Test1234!");
    }

    [OneTimeTearDown]
    public async Task CleanupTestUser() => await TeardownTestUserAsync();

    /// <summary>Logs in and navigates to /profile.</summary>
    private async Task<ProfilePage> LoginAndGoToProfileAsync(string email, string password)
    {
        await GoToLoginAsync();
        var loginPage = await LoginPage.CreateAsync(Page);
        await loginPage.EnterIdentifierAsync(email);
        await loginPage.EnterPasswordAsync(password);
        await loginPage.SubmitLoginAsync();
        await Page.GotoAsync($"{SutUrl}/profile");
        var page = await ProfilePage.CreateAsync(Page);
        await Expect(Page.Locator(TestId.ProfileCard("personal"))).ToContainTextAsync("UITester");
        return page;
    }

    [Test]
    [Description("BASE, S2, S3, S4 - profile loads and personal info and location can be managed")]
    public async Task TestLoadAndManagePersonalInfoAndLocation()
    {
        // Register a dedicated user to avoid cross-test pollution when mutating profile data
        var ts = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds();
        var localEmail = $"personalui{ts}@devorapp.test";
        var localUsername = $"personalui{ts % 100000}";
        const string localPassword = "Test1234!";
        await RegisterUserApiAsync(localUsername, localEmail, localPassword);

        var page = await LoginAndGoToProfileAsync(localEmail, localPassword);

        // BASE: data is present
        var personalCardText = await page.GetCardTextAsync("personal");
        var locationCardText = await page.GetCardTextAsync("location");
        Assert.That(personalCardText, Does.Contain("UITester"), "BASE: personal card must contain name");
        Assert.That(personalCardText, Does.Contain("Test"), "BASE: personal card must contain surname");
        Assert.That(locationCardText, Does.Contain("Gijón"), "BASE: location card must contain preferred location");

        await InjectAutocompleteMockAsync();

        // Cancelling the edit restores the original values
        await page.EditPersonalInfoAsync();
        await page.FillFirstNameAsync("JuanModificado");
        await page.FillLastNameAsync("PérezModificado");
        await page.CancelPersonalInfoAsync();
        Assert.That(await page.GetCardTextAsync("personal"), Does.Contain("UITester"),
            "Cancel must restore original name");

        // S2 & S3: save updated first/last name
        await page.EditPersonalInfoAsync();
        await page.FillFirstNameAsync("Juan");
        await page.FillLastNameAsync("Pérez");
        await page.SavePersonalInfoAsync();
        await page.WaitForToastAsync("success");
        Assert.That(await page.HasSuccessToastAsync(), Is.True, "S2/S3: success toast must appear");
        await page.DismissSuccessToastAsync();
        personalCardText = await page.GetCardTextAsync("personal");
        Assert.That(personalCardText, Does.Contain("Juan"), "S2: card must contain updated name");
        Assert.That(personalCardText, Does.Contain("Pérez"), "S3: card must contain updated surname");

        // BASE: manually typed location (not picked from autocomplete) -> inline error
        await page.EditLocationAsync();
        await page.FillLocationAsync("aifgauif");
        await page.SaveLocationAsync();
        await Expect(Page.Locator(TestId.Of("profile-location-error")))
            .ToContainTextAsync("Debes seleccionar una ubicación válida");
        Assert.That(await page.GetCardTextAsync("location"), Does.Contain("Debes seleccionar una ubicación válida"),
            "BASE: manual-typed location must show inline error");

        // S4: location picked from autocomplete
        await page.FillLocationAsync("Barcelona, España");
        await TriggerAutocompletePlaceChangedAsync();
        await page.SaveLocationAsync();
        await page.WaitForToastAsync("success");
        Assert.That(await page.HasSuccessToastAsync(), Is.True, "S4: success toast must appear after updating location");
        await Expect(Page.Locator(TestId.ProfileCard("location"))).ToContainTextAsync("Barcelona, España");
    }

    [Test]
    [Description("S5 to S16 - email and password change validation and happy paths")]
    public async Task TestManageEmailAndPassword()
    {
        var ts = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds();

        // Email section
        var emailUserEmail = $"tempemail{ts}@devorapp.test";
        var emailUserUsername = $"tempemail{ts % 100000}";
        const string emailUserPassword = "Password123!";
        await RegisterUserApiAsync(emailUserUsername, emailUserEmail, emailUserPassword);

        var page = await LoginAndGoToProfileAsync(emailUserEmail, emailUserPassword);
        await page.OpenEmailChangeAsync();

        // S7 & S9: required attributes
        var emailInput = page.NewEmailInput;
        var passInput = page.EmailPasswordInput;
        Assert.That(await emailInput.GetAttributeAsync("required"), Is.Not.Null, "S7: email must be required");
        Assert.That(await passInput.GetAttributeAsync("required"), Is.Not.Null, "S9: password must be required");

        // S5: invalid email format (HTML5 validation)
        await page.FillNewEmailAsync("invalidemail");
        await page.FillEmailPasswordAsync(emailUserPassword);
        await page.SubmitEmailChangeAsync();
        var isInvalid = await emailInput.EvaluateAsync<bool>("(el) => !el.checkValidity()");
        Assert.That(isInvalid, Is.True, "S5: HTML5 validity must fail for invalid email format");

        // S8: wrong password
        await page.FillNewEmailAsync($"new{ts}@devorapp.test");
        await page.FillEmailPasswordAsync("WrongPassword!");
        await page.SubmitEmailChangeAsync();
        await page.WaitForToastAsync("error");
        Assert.That(await page.HasErrorToastAsync(), Is.True, "S8: error toast must appear for wrong password");
        await page.DismissErrorToastAsync();

        // S6: email already in use
        await page.FillNewEmailAsync(TestEmail!);
        await page.FillEmailPasswordAsync(emailUserPassword);
        await page.SubmitEmailChangeAsync();
        await page.WaitForToastAsync("error");
        Assert.That(await page.HasErrorToastAsync(), Is.True, "S6: error toast must appear for email in use");
        await page.DismissErrorToastAsync();

        // Happy path: successful email change
        var newEmail = $"newtempemail{ts}@devorapp.test";
        await page.FillNewEmailAsync(newEmail);
        await page.FillEmailPasswordAsync(emailUserPassword);
        await page.SubmitEmailChangeAsync();
        await page.WaitForToastAsync("success");
        Assert.That(await page.HasSuccessToastAsync(), Is.True, "Success toast must appear");
        Assert.That(await page.GetSuccessToastTextAsync(), Does.Contain("confirmación"), "Toast must mention confirmation");
        Assert.That(await page.GetCardTextAsync("email"), Does.Contain(emailUserEmail),
            "Card must still display original email");

        // Password section
        var ts2 = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds();
        var passUserEmail = $"temppass{ts2}@devorapp.test";
        var passUserUsername = $"temppass{ts2 % 100000}";
        const string passUserPassword = "Password123!";
        await RegisterUserApiAsync(passUserUsername, passUserEmail, passUserPassword);

        page = await LoginAndGoToProfileAsync(passUserEmail, passUserPassword);
        await page.OpenPasswordChangeAsync();

        // S11 & S12: required attributes
        var currentPassInput = page.CurrentPasswordInput;
        var newPassInput = page.NewPasswordInput;
        Assert.That(await currentPassInput.GetAttributeAsync("required"), Is.Not.Null, "S11: current pass must be required");
        Assert.That(await newPassInput.GetAttributeAsync("required"), Is.Not.Null, "S12: new pass must be required");

        // S13: password too short (7 chars)
        await page.FillPasswordChangeAsync(passUserPassword, "Short1!", "Short1!");
        await page.SubmitPasswordChangeAsync();
        await page.WaitForToastAsync("error");
        Assert.That(await page.HasErrorToastAsync(), Is.True, "S13: error toast for short password");
        var errorText = await page.GetErrorToastTextAsync();
        Assert.That(errorText.Contains('8') || errorText.ToLowerInvariant().Contains("caracteres"), Is.True,
            "S13: message content");
        await page.DismissErrorToastAsync();

        // S15: no numbers in new password
        await page.FillPasswordChangeAsync(passUserPassword, "OnlyLettersPassword", "OnlyLettersPassword");
        await page.SubmitPasswordChangeAsync();
        await page.WaitForToastAsync("error");
        Assert.That(await page.HasErrorToastAsync(), Is.True, "S15: error toast for no-number password");
        await page.DismissErrorToastAsync();

        // S16: no letters in new password
        await page.FillPasswordChangeAsync(passUserPassword, "1234567890", "1234567890");
        await page.SubmitPasswordChangeAsync();
        await page.WaitForToastAsync("error");
        Assert.That(await page.HasErrorToastAsync(), Is.True, "S16: error toast for no-letter password");
        await page.DismissErrorToastAsync();

        // S10: wrong old password
        await page.FillPasswordChangeAsync("WrongPassword!", "NewPassword123!", "NewPassword123!");
        await page.SubmitPasswordChangeAsync();
        await page.WaitForToastAsync("error");
        Assert.That(await page.HasErrorToastAsync(), Is.True, "S10: error toast for wrong old password");
        await page.DismissErrorToastAsync();

        // S14: successful password change (16-char new password)
        await page.FillPasswordChangeAsync(passUserPassword, "NewPassword12345!", "NewPassword12345!");
        await page.SubmitPasswordChangeAsync();
        await page.WaitForToastAsync("success");
        Assert.That(await page.HasSuccessToastAsync(), Is.True, "S14: success toast must appear");
    }

    [Test]
    [Description("S17 - account deletion after the confirmation check")]
    public async Task TestDeleteAccount()
    {
        var ts = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds();
        var delEmail = $"delui{ts}@devorapp.test";
        var delUsername = $"delui{ts % 100000}";
        const string delPassword = "Delete1234!";

        await RegisterUserApiAsync(delUsername, delEmail, delPassword);

        var page = await LoginAndGoToProfileAsync(delEmail, delPassword);
        await page.OpenDeleteAccountAsync();

        Assert.That(await page.IsDeleteButtonEnabledAsync(), Is.False,
            "Delete button must be disabled before typing confirm phrase");

        await page.FillDeleteConfirmAsync("NO_CONFIRMAR");
        Assert.That(await page.IsDeleteButtonEnabledAsync(), Is.False,
            "Delete button must remain disabled with incorrect phrase");

        await page.FillDeleteConfirmAsync("CONFIRMAR");
        Assert.That(await page.IsDeleteButtonEnabledAsync(), Is.True, "Delete button must be enabled with CONFIRMAR");

        await page.SubmitDeleteAccountAsync();
        await page.WaitForToastAsync("success");

        Assert.That(await page.HasSuccessToastAsync(), Is.True, "A success toast must appear after account deletion");
        await Page.WaitForURLAsync(url => url.Contains("/login"));
        Assert.That(Page.Url, Does.Contain("/login"), "After deletion the user must be redirected to /login");
    }
}
