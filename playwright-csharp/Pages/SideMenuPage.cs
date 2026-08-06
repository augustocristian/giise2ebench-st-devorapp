using Microsoft.Playwright;
using DevorApp.E2ETests.Common;

namespace DevorApp.E2ETests.Pages;

/// <summary>
/// Page object for the side menu drawer (accessible from /home and other
/// authenticated pages via the hamburger button). Port of
/// epigijon.devorapp.e2e.functional.pages.SideMenuPage.
///
/// The drawer contains:
///   - Theme toggle group (Claro / Oscuro)
///   - Font-size toggle group (S / M / L)
/// </summary>
public class SideMenuPage : BasePage
{
    private ILocator Hamburger => Page.Locator("button[aria-label='Abrir menú']");
    private ILocator Drawer => Page.Locator(".sidemenu-drawer");
    private ILocator ToggleGroups => Page.Locator(".sidemenu-toggle-group");
    private ILocator Html => Page.Locator("html");

    private SideMenuPage(IPage page) : base(page)
    {
    }

    public static Task<SideMenuPage> CreateAsync(IPage page) => InitAsync(new SideMenuPage(page));

    /// <summary>Clicks the hamburger button to open the side menu.</summary>
    public async Task<SideMenuPage> OpenAsync()
    {
        await Hamburger.ClickAsync();
        await Drawer.WaitForAsync();
        return this;
    }

    /// <summary>Returns true if the drawer is currently visible.</summary>
    public Task<bool> IsOpenAsync() => Drawer.IsVisibleAsync();

    // ── Theme toggle ─────────────────────────────────────────────────────────

    private ILocator GetToggleGroup(int index) => ToggleGroups.Nth(index);

    /// <summary>Clicks the theme button with the given label inside the
    /// first toggle group. <paramref name="label"/>: "Claro" or "Oscuro".</summary>
    public async Task<SideMenuPage> ClickThemeAsync(string label)
    {
        var button = GetToggleGroup(0).Locator("button").Filter(ContainsTextFilter(label));
        if (await button.CountAsync() == 0) throw new ElementNotFoundException($"Theme button not found: {label}");
        await button.First.ClickAsync();
        return this;
    }

    /// <summary>Returns true if the theme button <paramref name="label"/> has the "active" class.</summary>
    public async Task<bool> IsThemeActiveAsync(string label)
    {
        var buttons = GetToggleGroup(0).Locator("button");
        var count = await buttons.CountAsync();
        for (var i = 0; i < count; i++)
        {
            var button = buttons.Nth(i);
            var text = await button.TextContentAsync() ?? "";
            var classAttr = await button.GetAttributeAsync("class") ?? "";
            if (text.Contains(label) && classAttr.Contains("active")) return true;
        }
        return false;
    }

    /// <summary>Returns the data-theme attribute of the &lt;html&gt;
    /// element, or empty string if the attribute is absent.</summary>
    public async Task<string> GetHtmlDataThemeAsync() => await Html.GetAttributeAsync("data-theme") ?? "";

    // ── Font-size toggle ─────────────────────────────────────────────────────

    /// <summary>Clicks the font-size button with the given label inside the
    /// second toggle group. <paramref name="label"/>: "S", "M", or "L".</summary>
    public async Task<SideMenuPage> ClickFontSizeAsync(string label)
    {
        var button = GetToggleGroup(1).Locator("button").Filter(ExactTextFilter(label));
        if (await button.CountAsync() == 0) throw new ElementNotFoundException($"Font-size button not found: {label}");
        await button.First.ClickAsync();
        return this;
    }

    /// <summary>Returns true if the font-size button <paramref name="label"/> has the "active" class.</summary>
    public async Task<bool> IsFontSizeActiveAsync(string label)
    {
        var buttons = GetToggleGroup(1).Locator("button");
        var count = await buttons.CountAsync();
        for (var i = 0; i < count; i++)
        {
            var button = buttons.Nth(i);
            var text = (await button.TextContentAsync() ?? "").Trim();
            var classAttr = await button.GetAttributeAsync("class") ?? "";
            if (text == label && classAttr.Contains("active")) return true;
        }
        return false;
    }

    /// <summary>Returns the data-font-size attribute of the &lt;html&gt;
    /// element, or empty string if absent.</summary>
    public async Task<string> GetHtmlDataFontSizeAsync() => await Html.GetAttributeAsync("data-font-size") ?? "";
}
