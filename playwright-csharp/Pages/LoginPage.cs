using Microsoft.Playwright;

namespace DevorApp.E2ETests.Pages;

/// <summary>
/// Page object for /login. Port of
/// epigijon.devorapp.e2e.functional.pages.LoginPage. <c>CreateAsync</c>
/// waits until the login form is visible before returning, so any
/// LoginPage instance is guaranteed to be ready to use.
/// </summary>
public class LoginPage : BasePage
{
    private ILocator Identifier => Page.Locator("#identifier");
    private ILocator Password => Page.Locator("#password");
    private ILocator Submit => Page.Locator("#login-submit-btn");
    private ILocator GoogleBtn => Page.Locator("#google-login-btn");
    private ILocator RegisterLink => Page.Locator("#go-register-link");
    private ILocator ErrorMsg => Page.Locator(".message.error");

    private LoginPage(IPage page) : base(page)
    {
    }

    public static Task<LoginPage> CreateAsync(IPage page) => InitAsync(new LoginPage(page));

    protected override Task WaitReadyAsync() => Page.Locator("#login-form").WaitForAsync();

    /// <summary>Types into the identifier (email or username) field. Returns this for chaining.</summary>
    public async Task<LoginPage> EnterIdentifierAsync(string identifier)
    {
        await Identifier.FillAsync(identifier);
        return this;
    }

    /// <summary>Types into the password field. Returns this for chaining.</summary>
    public async Task<LoginPage> EnterPasswordAsync(string password)
    {
        await Password.FillAsync(password);
        return this;
    }

    /// <summary>Clicks the submit button and waits for the home page.
    /// Returns the resulting HomePage.</summary>
    public async Task<HomePage> SubmitLoginAsync()
    {
        await Submit.ClickAsync();
        return await HomePage.CreateAsync(Page);
    }

    /// <summary>Clicks the submit button expecting an error and waits for
    /// the error message to appear. Returns this so callers can chain
    /// assertions.</summary>
    public async Task<LoginPage> SubmitLoginExpectingFailureAsync()
    {
        await Submit.ClickAsync();
        await ErrorMsg.WaitForAsync();
        return this;
    }

    /// <summary>Clicks the "register" link and returns the resulting RegisterPage.</summary>
    public async Task<RegisterPage> GoToRegisterAsync()
    {
        await RegisterLink.ClickAsync();
        return await RegisterPage.CreateAsync(Page);
    }

    /// <summary>Clicks the Google login button.</summary>
    public async Task<HomePage> ClickGoogleLoginAsync()
    {
        await GoogleBtn.ClickAsync();
        return await HomePage.CreateAsync(Page);
    }

    /// <summary>Returns true if an error message is currently visible.</summary>
    public Task<bool> HasErrorMessageAsync() => ErrorMsg.IsVisibleAsync();
}
