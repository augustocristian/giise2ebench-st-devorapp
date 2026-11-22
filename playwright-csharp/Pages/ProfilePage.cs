using Microsoft.Playwright;
using DevorApp.E2ETests.Common;

namespace DevorApp.E2ETests.Pages;

/// <summary>
/// Page object for /profile. The page has five cards (personal, location, email, security, danger),
/// each with its own edit / save / cancel actions. Ready once the personal card is shown.
/// </summary>
public class ProfilePage : BasePage
{
    private ILocator ToastSuccess => ByTestId("toast-success");
    private ILocator ToastError => ByTestId("toast-error");

    private ProfilePage(IPage page) : base(page)
    {
    }

    public static Task<ProfilePage> CreateAsync(IPage page) => InitAsync(new ProfilePage(page));

    protected override Task WaitReadyAsync() => Page.Locator(TestId.ProfileCard("personal")).WaitForAsync();

    /// <summary>Full text of a card: personal, location, email, security or danger.</summary>
    public async Task<string> GetCardTextAsync(string card) =>
        await Page.Locator(TestId.ProfileCard(card)).TextContentAsync() ?? "";

    private async Task<ProfilePage> ClickIdAsync(string id)
    {
        await ByTestId(id).ClickAsync();
        return this;
    }

    private async Task<ProfilePage> FillIdAsync(string id, string value)
    {
        await ByTestId(id).FillAsync(value);
        return this;
    }

    // Personal info
    public Task<ProfilePage> EditPersonalInfoAsync() => ClickIdAsync("profile-personal-edit");
    public Task<ProfilePage> SavePersonalInfoAsync() => ClickIdAsync("profile-personal-save");
    public Task<ProfilePage> CancelPersonalInfoAsync() => ClickIdAsync("profile-personal-cancel");
    public Task<ProfilePage> FillFirstNameAsync(string value) => FillIdAsync("profile-personal-first-name", value);
    public Task<ProfilePage> FillLastNameAsync(string value) => FillIdAsync("profile-personal-last-name", value);

    // Location
    public Task<ProfilePage> EditLocationAsync() => ClickIdAsync("profile-location-edit");
    public Task<ProfilePage> SaveLocationAsync() => ClickIdAsync("profile-location-save");
    public Task<ProfilePage> FillLocationAsync(string value) => FillIdAsync("profile-location-input", value);

    // Email change
    public Task<ProfilePage> OpenEmailChangeAsync() => ClickIdAsync("profile-email-edit");
    public Task<ProfilePage> FillNewEmailAsync(string email) => FillIdAsync("profile-email-input", email);
    public Task<ProfilePage> FillEmailPasswordAsync(string password) => FillIdAsync("profile-email-password", password);
    public Task<ProfilePage> SubmitEmailChangeAsync() => ClickIdAsync("profile-email-submit");
    public ILocator NewEmailInput => ByTestId("profile-email-input");
    public ILocator EmailPasswordInput => ByTestId("profile-email-password");

    // Password change
    public Task<ProfilePage> OpenPasswordChangeAsync() => ClickIdAsync("profile-security-edit");
    public Task<ProfilePage> SubmitPasswordChangeAsync() => ClickIdAsync("profile-security-submit");
    public ILocator CurrentPasswordInput => ByTestId("profile-security-current");
    public ILocator NewPasswordInput => ByTestId("profile-security-new");

    public async Task<ProfilePage> FillPasswordChangeAsync(string current, string newPassword, string confirm)
    {
        await FillIdAsync("profile-security-current", current);
        await FillIdAsync("profile-security-new", newPassword);
        return await FillIdAsync("profile-security-confirm", confirm);
    }

    // Delete account
    public Task<ProfilePage> OpenDeleteAccountAsync() => ClickIdAsync("profile-danger-open");
    public Task<ProfilePage> FillDeleteConfirmAsync(string text) => FillIdAsync("profile-danger-confirm-input", text);
    public Task<ProfilePage> SubmitDeleteAccountAsync() => ClickIdAsync("profile-danger-submit");
    public Task<bool> IsDeleteButtonEnabledAsync() => ByTestId("profile-danger-submit").IsEnabledAsync();

    // Toasts
    public Task<bool> HasSuccessToastAsync() => ToastSuccess.First.IsVisibleAsync();
    public Task<string> GetSuccessToastTextAsync() => LastTextAsync(ToastSuccess);
    public Task<bool> HasErrorToastAsync() => ToastError.First.IsVisibleAsync();
    public Task<string> GetErrorToastTextAsync() => LastTextAsync(ToastError);
    public Task<ProfilePage> DismissSuccessToastAsync() => DismissLastAsync(ToastSuccess);
    public Task<ProfilePage> DismissErrorToastAsync() => DismissLastAsync(ToastError);

    /// <summary>Waits for a toast of the given type: success or error.</summary>
    public Task WaitForToastAsync(string type) => Page.Locator(TestId.Toast(type)).First.WaitForAsync();

    private static async Task<string> LastTextAsync(ILocator locator)
    {
        var count = await locator.CountAsync();
        return count == 0 ? "" : (await locator.Nth(count - 1).TextContentAsync() ?? "");
    }

    private async Task<ProfilePage> DismissLastAsync(ILocator locator)
    {
        var count = await locator.CountAsync();
        if (count > 0) await locator.Nth(count - 1).ClickAsync();
        return this;
    }
}
