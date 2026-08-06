using DevorApp.E2ETests.Common;
using DevorApp.E2ETests.Pages;
using Microsoft.Playwright;
using NUnit.Framework;
using static Microsoft.Playwright.Assertions;

namespace DevorApp.E2ETests.Tests.E2E;

/// <summary>
/// Port of epigijon.devorapp.e2e.functional.tests.e2e.TestProfileView.
///
/// Browser tests for the DevorApp profile page (/profile). Adapts
/// profile.spec.ts (Playwright/TS) to Playwright/NUnit.
///
/// Base-Choice coverage:
///   BASE — profile data loads correctly and invalid location update is
///     validated (Ubicación = Mal).
///   S2–S4 — save personal info (Nombre = Si, Apellidos = Si) and valid
///     location update (Ubicación = Bien).
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
        await Expect(Page.Locator(".location-info-card")).ToContainTextAsync("UITester");
        return page;
    }

    // ── 1. Carga inicial + Gestión de Información Personal y Ubicación (BASE, S2–S4) ──

    [Test]
    [Description("BASE, S2, S3, S4 — el perfil permite cargar y gestionar la información personal y la ubicación")]
    public async Task TestCargarYGestionarInformacionPersonalYUbicacion()
    {
        // Register a dedicated user to avoid cross-test pollution when mutating profile data
        var ts = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds();
        var localEmail = $"personalui{ts}@devorapp.test";
        var localUsername = $"personalui{ts % 100000}";
        const string localPassword = "Test1234!";
        await RegisterUserApiAsync(localUsername, localEmail, localPassword);

        var page = await LoginAndGoToProfileAsync(localEmail, localPassword);

        // BASE: data is present
        var personalCardText = await page.GetCardTextAsync("Información Personal");
        var locationCardText = await page.GetCardTextAsync("Ubicación Preferida");
        Assert.That(personalCardText, Does.Contain("UITester"), "BASE: personal card must contain name");
        Assert.That(personalCardText, Does.Contain("Test"), "BASE: personal card must contain surname");
        Assert.That(locationCardText, Does.Contain("Gijón"), "BASE: location card must contain preferred location");

        await InjectAutocompleteMockAsync();

        // Cancel personal edit restores original values
        await page.EditPersonalInfoAsync();
        await page.FillInputInCardAsync("Información Personal", 0, "JuanModificado");
        await page.FillInputInCardAsync("Información Personal", 1, "PérezModificado");
        await page.CancelPersonalInfoAsync();
        Assert.That(await page.GetCardTextAsync("Información Personal"), Does.Contain("UITester"),
            "Cancel must restore original name");

        // S2 & S3: Save updated nombre/apellidos
        await page.EditPersonalInfoAsync();
        await page.FillInputInCardAsync("Información Personal", 0, "Juan");
        await page.FillInputInCardAsync("Información Personal", 1, "Pérez");
        await page.SavePersonalInfoAsync();
        await Expect(Page.Locator(".toast.success")).ToBeVisibleAsync();
        Assert.That(await page.HasSuccessToastAsync(), Is.True, "S2/S3: success toast must appear");
        await page.DismissSuccessToastAsync();
        personalCardText = await page.GetCardTextAsync("Información Personal");
        Assert.That(personalCardText, Does.Contain("Juan"), "S2: card must contain updated name");
        Assert.That(personalCardText, Does.Contain("Pérez"), "S3: card must contain updated surname");

        // BASE: Type location manually without selecting → error (Ubicación = Mal)
        await page.ClickButtonInCardAsync("Ubicación Preferida", "Cambiar");
        await page.FillInputInCardAsync("Ubicación Preferida", 0, "aifgauif");
        await page.ClickButtonInCardAsync("Ubicación Preferida", "Guardar cambios");
        Assert.That(await page.GetCardTextAsync("Ubicación Preferida"), Does.Contain("Debes seleccionar una ubicación válida"),
            "BASE: manual-typed location must show inline error");

        // S4: Select location from autocomplete list (Ubicación = Bien)
        await page.FillInputInCardAsync("Ubicación Preferida", 0, "Barcelona, España");
        await TriggerAutocompletePlaceChangedAsync();
        await page.ClickButtonInCardAsync("Ubicación Preferida", "Guardar cambios");
        await Expect(Page.Locator(".toast.success")).ToBeVisibleAsync();
        Assert.That(await page.HasSuccessToastAsync(), Is.True, "S4: success toast must appear after updating location");
        await Expect(Page.Locator("xpath=//div[contains(@class,'location-info-card') and contains(.,'Ubicación Preferida')]"))
            .ToContainTextAsync("Barcelona, España");
    }

    // ── 2. Gestión de Correo y Contraseña (S5–S16) ────────────────────────────

    [Test]
    [Description("S5 a S16 — validación y cambio de correo electrónico y contraseña")]
    public async Task TestGestionarCorreoYContrasena()
    {
        var ts = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds();

        // ── Email section ────────────────────────────────────────────────────
        var emailUserEmail = $"tempemail{ts}@devorapp.test";
        var emailUserUsername = $"tempemail{ts % 100000}";
        const string emailUserPassword = "Password123!";
        await RegisterUserApiAsync(emailUserUsername, emailUserEmail, emailUserPassword);

        var page = await LoginAndGoToProfileAsync(emailUserEmail, emailUserPassword);
        await page.OpenEmailChangeAsync();

        // S7 & S9: required attributes
        var emailInput = Page.Locator("input[type='email']");
        var passInput = Page.Locator("#email-password-input");
        Assert.That(await emailInput.GetAttributeAsync("required"), Is.Not.Null, "S7: email must be required");
        Assert.That(await passInput.GetAttributeAsync("required"), Is.Not.Null, "S9: password must be required");

        // S5: invalid email format (HTML5 validation)
        await page.FillNewEmailAsync("invalidemail");
        await page.FillEmailPasswordAsync(emailUserPassword);
        await page.SubmitEmailChangeAsync();
        var isInvalid = await emailInput.EvaluateAsync<bool>("(el) => !el.checkValidity()");
        Assert.That(isInvalid, Is.True, "S5: HTML5 validity must fail for invalid email format");

        // S8: wrong password
        await page.FillNewEmailAsync($"nuevo{ts}@correo.com");
        await page.FillEmailPasswordAsync("WrongPassword!");
        await page.SubmitEmailChangeAsync();
        await Expect(Page.Locator(".toast.error")).ToBeVisibleAsync();
        Assert.That(await page.HasErrorToastAsync(), Is.True, "S8: error toast must appear for wrong password");
        await page.DismissErrorToastAsync();

        // S6: email already in use
        await page.FillNewEmailAsync(TestEmail!);
        await page.FillEmailPasswordAsync(emailUserPassword);
        await page.SubmitEmailChangeAsync();
        await Expect(Page.Locator(".toast.error")).ToBeVisibleAsync();
        Assert.That(await page.HasErrorToastAsync(), Is.True, "S6: error toast must appear for email in use");
        await page.DismissErrorToastAsync();

        // Happy path: successful email change
        var newEmail = $"newtempemail{ts}@devorapp.test";
        await page.FillNewEmailAsync(newEmail);
        await page.FillEmailPasswordAsync(emailUserPassword);
        await page.SubmitEmailChangeAsync();
        await Expect(Page.Locator(".toast.success")).ToBeVisibleAsync();
        Assert.That(await page.HasSuccessToastAsync(), Is.True, "Success toast must appear");
        Assert.That(await page.GetSuccessToastTextAsync(), Does.Contain("confirmación"), "Toast must mention confirmation");
        Assert.That(await page.GetCardTextAsync("Correo Electrónico"), Does.Contain(emailUserEmail),
            "Card must still display original email");

        // ── Password section ────────────────────────────────────────────────
        var ts2 = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds();
        var passUserEmail = $"temppass{ts2}@devorapp.test";
        var passUserUsername = $"temppass{ts2 % 100000}";
        const string passUserPassword = "Password123!";
        await RegisterUserApiAsync(passUserUsername, passUserEmail, passUserPassword);

        page = await LoginAndGoToProfileAsync(passUserEmail, passUserPassword);
        await page.OpenPasswordChangeAsync();

        // S11 & S12: required attributes
        var currentPassInput = Page.Locator("#current-password-input");
        var newPassInput = Page.Locator("#new-password-input");
        Assert.That(await currentPassInput.GetAttributeAsync("required"), Is.Not.Null, "S11: current pass must be required");
        Assert.That(await newPassInput.GetAttributeAsync("required"), Is.Not.Null, "S12: new pass must be required");

        // S13: password too short (7 chars)
        await page.FillPasswordChangeAsync(passUserPassword, "Short1!", "Short1!");
        await page.SubmitPasswordChangeAsync();
        await Expect(Page.Locator(".toast.error")).ToBeVisibleAsync();
        Assert.That(await page.HasErrorToastAsync(), Is.True, "S13: error toast for short password");
        var errorText = await page.GetErrorToastTextAsync();
        Assert.That(errorText.Contains('8') || errorText.ToLowerInvariant().Contains("caracteres"), Is.True,
            "S13: message content");
        await page.DismissErrorToastAsync();

        // S15: no numbers in new password
        await page.FillPasswordChangeAsync(passUserPassword, "OnlyLettersPassword", "OnlyLettersPassword");
        await page.SubmitPasswordChangeAsync();
        await Expect(Page.Locator(".toast.error")).ToBeVisibleAsync();
        Assert.That(await page.HasErrorToastAsync(), Is.True, "S15: error toast for no-number password");
        await page.DismissErrorToastAsync();

        // S16: no letters in new password
        await page.FillPasswordChangeAsync(passUserPassword, "1234567890", "1234567890");
        await page.SubmitPasswordChangeAsync();
        await Expect(Page.Locator(".toast.error")).ToBeVisibleAsync();
        Assert.That(await page.HasErrorToastAsync(), Is.True, "S16: error toast for no-letter password");
        await page.DismissErrorToastAsync();

        // S10: wrong old password
        await page.FillPasswordChangeAsync("WrongPassword!", "NewPassword123!", "NewPassword123!");
        await page.SubmitPasswordChangeAsync();
        await Expect(Page.Locator(".toast.error")).ToBeVisibleAsync();
        Assert.That(await page.HasErrorToastAsync(), Is.True, "S10: error toast for wrong old password");
        await page.DismissErrorToastAsync();

        // S14: successful password change (16-char new password)
        await page.FillPasswordChangeAsync(passUserPassword, "NewPassword12345!", "NewPassword12345!");
        await page.SubmitPasswordChangeAsync();
        await Expect(Page.Locator(".toast.success")).ToBeVisibleAsync();
        Assert.That(await page.HasSuccessToastAsync(), Is.True, "S14: success toast must appear");
    }

    // ── 3. Eliminar Cuenta (S17) ───────────────────────────────────────────────

    [Test]
    [Description("S17 — eliminación de cuenta tras validación de confirmación")]
    public async Task TestEliminarCuenta()
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
        await Expect(Page.Locator(".toast.success")).ToBeVisibleAsync();

        Assert.That(await page.HasSuccessToastAsync(), Is.True, "A success toast must appear after account deletion");
        await Page.WaitForURLAsync(url => url.Contains("/login"));
        Assert.That(Page.Url, Does.Contain("/login"), "After deletion the user must be redirected to /login");
    }
}
