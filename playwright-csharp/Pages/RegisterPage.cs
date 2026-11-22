using Microsoft.Playwright;
using static Microsoft.Playwright.Assertions;

namespace DevorApp.E2ETests.Pages;

/// <summary>
/// Page object for /register, covering both steps: step 1 (email, username, password, first and last
/// name) and step 2 (location and final submit). Ready once the email field is visible.
/// </summary>
public class RegisterPage : BasePage
{
    private ILocator Email => ByTestId("register-email");
    private ILocator Username => ByTestId("register-username");
    private ILocator Password => ByTestId("register-password");
    private ILocator FirstName => ByTestId("register-first-name");
    private ILocator LastName => ByTestId("register-last-name");
    private ILocator ContinueBtn => ByTestId("register-continue");

    private ILocator GpsBtn => ByTestId("register-gps");
    private ILocator Location => ByTestId("register-location");
    private ILocator SubmitBtn => ByTestId("register-submit");
    private ILocator BackBtn => ByTestId("register-back");

    private ILocator StepLabel => ByTestId("register-step-label");
    private ILocator StepError => ByTestId("register-step-error");
    private ILocator ErrorMsg => ByTestId("register-message-error");
    private ILocator EmailError => ByTestId("register-email-error");
    private ILocator UserError => ByTestId("register-username-error");
    private ILocator VerifyMsg => ByTestId("register-verify-title");
    private ILocator LocName => ByTestId("register-location-name");

    private RegisterPage(IPage page) : base(page)
    {
    }

    public static Task<RegisterPage> CreateAsync(IPage page) => InitAsync(new RegisterPage(page));

    protected override Task WaitReadyAsync() => Email.WaitForAsync();

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

    public async Task<RegisterPage> EnterFirstNameAsync(string firstName)
    {
        await FirstName.FillAsync(firstName);
        return this;
    }

    public async Task<RegisterPage> EnterLastNameAsync(string lastName)
    {
        await LastName.FillAsync(lastName);
        return this;
    }

    public async Task<RegisterPage> ClickContinueAsync()
    {
        await ContinueBtn.ClickAsync();
        return this;
    }

    public async Task<RegisterPage> ClickUseGpsAsync()
    {
        await GpsBtn.ClickAsync();
        return this;
    }

    /// <summary>Types a location without picking it from the autocomplete dropdown.</summary>
    public async Task<RegisterPage> EnterLocationAsync(string location)
    {
        await Location.FillAsync(location);
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

    public async Task<RegisterPage> WaitForStep2Async()
    {
        await Expect(StepLabel).ToContainTextAsync("Paso 2 de 2");
        return this;
    }

    /// <summary>Step 1 validation banner, or else the API / step 2 error message.</summary>
    public async Task<string> GetErrorMessageAsync()
    {
        var step = await TextOrEmptyAsync(StepError);
        return step.Length == 0 ? await TextOrEmptyAsync(ErrorMsg) : step;
    }

    public Task<string> GetEmailErrorAsync() => TextOrEmptyAsync(EmailError);
    public Task<string> GetUsernameErrorAsync() => TextOrEmptyAsync(UserError);
    public async Task<bool> IsOnStep1Async() => (await TextOrEmptyAsync(StepLabel)).Contains("Paso 1 de 2");
    public async Task<bool> IsOnStep2Async() => (await TextOrEmptyAsync(StepLabel)).Contains("Paso 2 de 2");
    public Task<bool> IsVerifyEmailVisibleAsync() => VerifyMsg.IsVisibleAsync();
    public Task<string> GetDetectedLocationTextAsync() => TextOrEmptyAsync(LocName);
    public Task<bool> IsLoadedAsync() => Email.IsVisibleAsync();
}
