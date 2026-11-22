using Microsoft.Playwright;

namespace DevorApp.E2ETests.Pages;

/// <summary>Page object for /login. Ready once the login form is visible.</summary>
public class LoginPage : BasePage
{
    private ILocator Identifier => ByTestId("login-identifier");
    private ILocator Password => ByTestId("login-password");
    private ILocator Submit => ByTestId("login-submit");
    private ILocator GoogleBtn => ByTestId("login-google");
    private ILocator RegisterLink => ByTestId("login-register-link");
    private ILocator ErrorMsg => ByTestId("login-message-error");

    private LoginPage(IPage page) : base(page)
    {
    }

    public static Task<LoginPage> CreateAsync(IPage page) => InitAsync(new LoginPage(page));

    protected override Task WaitReadyAsync() => ByTestId("login-form").WaitForAsync();

    public async Task<LoginPage> EnterIdentifierAsync(string identifier)
    {
        await Identifier.FillAsync(identifier);
        return this;
    }

    public async Task<LoginPage> EnterPasswordAsync(string password)
    {
        await Password.FillAsync(password);
        return this;
    }

    /// <summary>Submits the form and waits for the home page.</summary>
    public async Task<HomePage> SubmitLoginAsync()
    {
        await Submit.ClickAsync();
        return await HomePage.CreateAsync(Page);
    }

    /// <summary>Submits the form expecting a failure and waits for the error message.</summary>
    public async Task<LoginPage> SubmitLoginExpectingFailureAsync()
    {
        await Submit.ClickAsync();
        await ErrorMsg.WaitForAsync();
        return this;
    }

    public async Task<RegisterPage> GoToRegisterAsync()
    {
        await RegisterLink.ClickAsync();
        return await RegisterPage.CreateAsync(Page);
    }

    public async Task<HomePage> ClickGoogleLoginAsync()
    {
        await GoogleBtn.ClickAsync();
        return await HomePage.CreateAsync(Page);
    }

    public Task<bool> HasErrorMessageAsync() => ErrorMsg.IsVisibleAsync();
}
