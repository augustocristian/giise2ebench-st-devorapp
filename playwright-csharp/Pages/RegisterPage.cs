using Microsoft.Playwright;

namespace DevorApp.E2ETests.Pages;

/// <summary>
/// Page object for /register. Port of
/// epigijon.devorapp.e2e.functional.pages.RegisterPage.
///
/// Covers both registration steps:
///   Step 1 — email, username, password, nombre, apellidos.
///   Step 2 — location (GPS button or manual text) and final submit.
///
/// <c>CreateAsync</c> blocks until the form (step 1) is visible.
/// </summary>
public class RegisterPage : BasePage
{
    private ILocator Form => Page.Locator("#register-form");

    // Step 1
    private ILocator Email => Page.Locator("#reg-email");
    private ILocator Username => Page.Locator("#reg-username");
    private ILocator Password => Page.Locator("#reg-password");
    private ILocator Nombre => Page.Locator("#reg-nombre");
    private ILocator Apellidos => Page.Locator("#reg-apellidos");
    private ILocator ContinueBtn => Page.Locator("#register-continue-btn");

    // Step 2
    private ILocator GpsBtn => Page.Locator("#use-gps-btn");
    private ILocator Ubicacion => Page.Locator("#reg-ubicacion");
    private ILocator SubmitBtn => Page.Locator("#register-submit-btn");
    private ILocator BackBtn => Page.Locator("#register-back-btn");

    // Feedback
    private ILocator ErrorMsg => Page.Locator(".message.error");
    private ILocator EmailError => Page.Locator("#email-error");
    private ILocator UserError => Page.Locator("#username-error");
    private ILocator Step1Label => ByXPath("//*[contains(text(),'Paso 1 de 2')]");
    private ILocator Step2Label => ByXPath("//*[contains(text(),'Paso 2 de 2')]");
    private ILocator VerifyMsg => ByXPath("//*[contains(text(),'Verifica tu correo')]");
    private ILocator LocName => Page.Locator(".location-detected-name");

    private RegisterPage(IPage page) : base(page)
    {
    }

    public static Task<RegisterPage> CreateAsync(IPage page) => InitAsync(new RegisterPage(page));

    protected override Task WaitReadyAsync() => Email.WaitForAsync();

    // ── Step 1 actions ───────────────────────────────────────────────────────

    public async Task<RegisterPage> EnterEmailAsync(string email)
    {
        await Email.FillAsync(email);
        return this;
    }

    public async Task<RegisterPage> EnterUsernameAsync(string username)
    {
        await Username.FillAsync(username);
        return this;
    }

    public async Task<RegisterPage> EnterPasswordAsync(string password)
    {
        await Password.FillAsync(password);
        return this;
    }

    public async Task<RegisterPage> EnterNombreAsync(string nombre)
    {
        await Nombre.FillAsync(nombre);
        return this;
    }

    public async Task<RegisterPage> EnterApellidosAsync(string apellidos)
    {
        await Apellidos.FillAsync(apellidos);
        return this;
    }

    /// <summary>Clicks "Continuar" to advance to step 2.</summary>
    public async Task<RegisterPage> ClickContinueAsync()
    {
        await ContinueBtn.ClickAsync();
        return this;
    }

    // ── Step 2 actions ───────────────────────────────────────────────────────

    public async Task<RegisterPage> ClickUseGpsAsync()
    {
        await GpsBtn.ClickAsync();
        return this;
    }

    /// <summary>Types a location manually into the text field (without
    /// selecting from the autocomplete dropdown).</summary>
    public async Task<RegisterPage> EnterUbicacionAsync(string location)
    {
        await Ubicacion.FillAsync(location);
        return this;
    }

    public async Task<RegisterPage> ClickSubmitAsync()
    {
        await SubmitBtn.ClickAsync();
        return this;
    }

    public async Task<RegisterPage> ClickBackAsync()
    {
        await BackBtn.ClickAsync();
        return this;
    }

    /// <summary>Waits until the page advances to Step 2.</summary>
    public async Task<RegisterPage> WaitForStep2Async()
    {
        await Step2Label.WaitForAsync();
        return this;
    }

    // ── State queries ────────────────────────────────────────────────────────

    public Task<string> GetErrorMessageAsync() => TextOrEmptyAsync(ErrorMsg);
    public Task<string> GetEmailErrorAsync() => TextOrEmptyAsync(EmailError);
    public Task<string> GetUsernameErrorAsync() => TextOrEmptyAsync(UserError);
    public Task<bool> IsOnStep1Async() => Step1Label.IsVisibleAsync();
    public Task<bool> IsOnStep2Async() => Step2Label.IsVisibleAsync();
    public Task<bool> IsVerifyEmailVisibleAsync() => VerifyMsg.IsVisibleAsync();
    public Task<string> GetDetectedLocationTextAsync() => TextOrEmptyAsync(LocName);
    public Task<bool> IsLoadedAsync() => Form.IsVisibleAsync();
}
