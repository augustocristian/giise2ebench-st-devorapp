using System.Text.RegularExpressions;
using Microsoft.Playwright;
using DevorApp.E2ETests.Common;

namespace DevorApp.E2ETests.Pages;

/// <summary>
/// Page object for the side menu drawer, opened from the hamburger button on authenticated pages.
/// </summary>
public class SideMenuPage : BasePage
{
    private ILocator Hamburger => ByTestId("side-menu-open");
    private ILocator Drawer => ByTestId("side-menu-drawer");
    // data-theme / data-font-size live on <html>: they are read as attributes, not used as locators
    private ILocator Html => Page.Locator("html");

    private SideMenuPage(IPage page) : base(page)
    {
    }

    public static Task<SideMenuPage> CreateAsync(IPage page) => InitAsync(new SideMenuPage(page));

    public async Task<SideMenuPage> OpenAsync()
    {
        await Hamburger.ClickAsync();
        await Drawer.WaitForAsync();
        return this;
    }

    public Task<bool> IsOpenAsync() => Drawer.IsVisibleAsync();

    /// <summary>Clicks a menu entry: home, recommend, favorites, saved, history or ratings.</summary>
    public async Task<SideMenuPage> GoToAsync(string entry)
    {
        await Page.Locator(TestId.SideMenu(entry)).ClickAsync();
        return this;
    }

    /// <summary>Clicks the theme button: "light" or "dark".</summary>
    public async Task<SideMenuPage> ClickThemeAsync(string theme)
    {
        await ByTestId($"theme-{theme}").ClickAsync();
        return this;
    }

    public Task<bool> IsThemeActiveAsync(string theme) => HasActiveClassAsync(ByTestId($"theme-{theme}"));

    public async Task<string> GetHtmlDataThemeAsync() => await Html.GetAttributeAsync("data-theme") ?? "";

    /// <summary>Clicks the font-size button: "S", "M" or "L".</summary>
    public async Task<SideMenuPage> ClickFontSizeAsync(string size)
    {
        await ByTestId($"font-size-{size.ToLowerInvariant()}").ClickAsync();
        return this;
    }

    public Task<bool> IsFontSizeActiveAsync(string size) =>
        HasActiveClassAsync(ByTestId($"font-size-{size.ToLowerInvariant()}"));

    public async Task<string> GetHtmlDataFontSizeAsync() => await Html.GetAttributeAsync("data-font-size") ?? "";

    // The selected state is only exposed through the "active" class
    private static async Task<bool> HasActiveClassAsync(ILocator locator) =>
        Regex.IsMatch(await locator.GetAttributeAsync("class") ?? "", @"\bactive\b");
}
