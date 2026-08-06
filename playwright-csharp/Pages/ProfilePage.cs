using Microsoft.Playwright;
using DevorApp.E2ETests.Common;

namespace DevorApp.E2ETests.Pages;

/// <summary>
/// Page object for /profile. Port of
/// epigijon.devorapp.e2e.functional.pages.ProfilePage.
///
/// The profile page renders several card sections identified by their
/// heading: Información Personal, Ubicación Preferida, Correo Electrónico,
/// Seguridad, and Zona de Peligro. Each card exposes its own edit/save/
/// cancel actions.
/// </summary>
public class ProfilePage : BasePage
{
    // Card containers (located by heading text)
    private ILocator Cards => Page.Locator(".location-info-card");

    // Toast notifications
    private ILocator ToastSuccess => Page.Locator(".toast.success");
    private ILocator ToastError => Page.Locator(".toast.error");

    // Delete-account form
    private ILocator DeleteInput => Page.Locator("#delete-confirm-input");

    // Password change inputs
    private ILocator CurrentPass => Page.Locator("#current-password-input");
    private ILocator NewPass => Page.Locator("#new-password-input");
    private ILocator ConfirmPass => Page.Locator("#confirm-password-input");

    // Email change inputs
    private ILocator EmailInput => Page.Locator("input[type='email']");
    private ILocator EmailPass => Page.Locator("#email-password-input");

    private ProfilePage(IPage page) : base(page)
    {
    }

    public static Task<ProfilePage> CreateAsync(IPage page) => InitAsync(new ProfilePage(page));

    protected override Task WaitReadyAsync() => Cards.First.WaitForAsync();

    // ── Card helpers ─────────────────────────────────────────────────────────

    /// <summary>Returns the card locator whose text contains
    /// <paramref name="heading"/> (e.g. "Información Personal", "Seguridad").</summary>
    private ILocator CardWith(string heading) => Cards.Filter(ContainsTextIgnoreCaseFilter(heading));

    /// <summary>Returns the full text of the card with the given heading.</summary>
    public async Task<string> GetCardTextAsync(string heading)
    {
        var card = CardWith(heading);
        if (await card.CountAsync() == 0) throw new ElementNotFoundException($"Profile card not found: {heading}");
        return await card.First.TextContentAsync() ?? "";
    }

    /// <summary>Clicks a button inside the card identified by <paramref name="heading"/>.</summary>
    public async Task<ProfilePage> ClickButtonInCardAsync(string heading, string buttonText)
    {
        var card = CardWith(heading);
        if (await card.CountAsync() == 0) throw new ElementNotFoundException($"Profile card not found: {heading}");
        var button = card.First.Locator("button").Filter(ContainsTextFilter(buttonText));
        if (await button.CountAsync() == 0)
            throw new ElementNotFoundException($"Button '{buttonText}' not found in card: {heading}");
        await button.First.ClickAsync();
        return this;
    }

    /// <summary>Fills the nth input (0-based) inside the card identified by <paramref name="heading"/>.</summary>
    public async Task<ProfilePage> FillInputInCardAsync(string heading, int index, string value)
    {
        var card = CardWith(heading);
        if (await card.CountAsync() == 0) throw new ElementNotFoundException($"Profile card not found: {heading}");
        var inputs = card.First.Locator("input");
        var count = await inputs.CountAsync();
        if (index >= count) throw new ElementNotFoundException($"Input #{index} not found in card: {heading}");
        await inputs.Nth(index).FillAsync(value);
        return this;
    }

    // ── Personal info ────────────────────────────────────────────────────────

    /// <summary>Clicks "Editar" in the Información Personal card.</summary>
    public Task<ProfilePage> EditPersonalInfoAsync() => ClickButtonInCardAsync("Información Personal", "Editar");

    /// <summary>Clicks "Guardar cambios" in the Información Personal card.</summary>
    public Task<ProfilePage> SavePersonalInfoAsync() => ClickButtonInCardAsync("Información Personal", "Guardar cambios");

    /// <summary>Clicks "Cancelar" in the Información Personal card.</summary>
    public Task<ProfilePage> CancelPersonalInfoAsync() => ClickButtonInCardAsync("Información Personal", "Cancelar");

    // ── Email change ─────────────────────────────────────────────────────────

    /// <summary>Clicks "Cambiar" in the Correo Electrónico card.</summary>
    public Task<ProfilePage> OpenEmailChangeAsync() => ClickButtonInCardAsync("Correo Electrónico", "Cambiar");

    /// <summary>Fills the new-email input in the email change form.</summary>
    public async Task<ProfilePage> FillNewEmailAsync(string email)
    {
        await EmailInput.FillAsync(email);
        return this;
    }

    /// <summary>Fills the password input in the email change form.</summary>
    public async Task<ProfilePage> FillEmailPasswordAsync(string password)
    {
        await EmailPass.FillAsync(password);
        return this;
    }

    /// <summary>Clicks "Cambiar correo" button.</summary>
    public Task<ProfilePage> SubmitEmailChangeAsync() => ClickButtonInCardAsync("Correo Electrónico", "Cambiar correo");

    // ── Password change ─────────────────────────────────────────────────────

    /// <summary>Clicks "Cambiar contraseña" in the Seguridad card.</summary>
    public Task<ProfilePage> OpenPasswordChangeAsync() => ClickButtonInCardAsync("Seguridad", "Cambiar contraseña");

    /// <summary>Fills all three password fields.</summary>
    public async Task<ProfilePage> FillPasswordChangeAsync(string current, string newPassword, string confirm)
    {
        await CurrentPass.FillAsync(current);
        await NewPass.FillAsync(newPassword);
        await ConfirmPass.FillAsync(confirm);
        return this;
    }

    /// <summary>Clicks "Actualizar contraseña" button.</summary>
    public Task<ProfilePage> SubmitPasswordChangeAsync() => ClickButtonInCardAsync("Seguridad", "Actualizar contraseña");

    // ── Delete account ───────────────────────────────────────────────────────

    /// <summary>Clicks "Eliminar cuenta permanentemente" in the Zona de Peligro card.</summary>
    public Task<ProfilePage> OpenDeleteAccountAsync() =>
        ClickButtonInCardAsync("Zona de Peligro", "Eliminar cuenta permanentemente");

    /// <summary>Types the confirmation text in the delete-account input.</summary>
    public async Task<ProfilePage> FillDeleteConfirmAsync(string text)
    {
        await DeleteInput.FillAsync(text);
        return this;
    }

    /// <summary>Clicks the final "Eliminar permanentemente" button.</summary>
    public Task<ProfilePage> SubmitDeleteAccountAsync() =>
        ClickButtonInCardAsync("Zona de Peligro", "Eliminar permanentemente");

    /// <summary>Returns true if the final delete button is enabled.</summary>
    public async Task<bool> IsDeleteButtonEnabledAsync()
    {
        var card = CardWith("Zona de Peligro");
        if (await card.CountAsync() == 0) throw new ElementNotFoundException("Profile card not found: Zona de Peligro");
        var button = card.First.Locator("button").Filter(ContainsTextFilter("Eliminar permanentemente"));
        if (await button.CountAsync() == 0) throw new ElementNotFoundException("Delete button not found");
        return await button.First.IsEnabledAsync();
    }

    // ── Toast queries ────────────────────────────────────────────────────────

    /// <summary>Returns true if a success toast is visible.</summary>
    public Task<bool> HasSuccessToastAsync() => ToastSuccess.First.IsVisibleAsync();

    /// <summary>Returns the text of the last success toast, or empty string.</summary>
    public async Task<string> GetSuccessToastTextAsync()
    {
        var count = await ToastSuccess.CountAsync();
        return count == 0 ? "" : (await ToastSuccess.Nth(count - 1).TextContentAsync() ?? "");
    }

    /// <summary>Returns true if an error toast is visible.</summary>
    public Task<bool> HasErrorToastAsync() => ToastError.First.IsVisibleAsync();

    /// <summary>Returns the text of the last error toast, or empty string.</summary>
    public async Task<string> GetErrorToastTextAsync()
    {
        var count = await ToastError.CountAsync();
        return count == 0 ? "" : (await ToastError.Nth(count - 1).TextContentAsync() ?? "");
    }

    /// <summary>Clicks the last visible success toast to dismiss it.</summary>
    public async Task<ProfilePage> DismissSuccessToastAsync()
    {
        var count = await ToastSuccess.CountAsync();
        if (count > 0) await ToastSuccess.Nth(count - 1).ClickAsync();
        return this;
    }

    /// <summary>Clicks the last visible error toast to dismiss it.</summary>
    public async Task<ProfilePage> DismissErrorToastAsync()
    {
        var count = await ToastError.CountAsync();
        if (count > 0) await ToastError.Nth(count - 1).ClickAsync();
        return this;
    }
}
