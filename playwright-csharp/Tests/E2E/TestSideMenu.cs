using DevorApp.E2ETests.Common;
using DevorApp.E2ETests.Pages;
using NUnit.Framework;

namespace DevorApp.E2ETests.Tests.E2E;

/// <summary>
/// Browser tests for the side menu drawer, opened from /home with the hamburger button.
///
/// Base-Choice coverage:
///   BASE / S2 — the light theme (BASE) sets data-theme='light'; the dark theme (S2) removes it.
///     Font size M is active by default in both cases.
///   S3 / S4   — font sizes S and L are applied together with the light theme.
/// </summary>
[TestFixture]
public class TestSideMenu : BaseLoggedClass
{
    [OneTimeSetUp]
    public async Task CreateTestUser()
    {
        var ts = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds();
        await SetupTestUserAsync($"menuui{ts % 100000}", $"menuui{ts}@devorapp.test", "Test1234!");
    }

    [OneTimeTearDown]
    public async Task CleanupTestUser() => await TeardownTestUserAsync();

    /// <summary>Logs in, navigates to /home, and opens the side menu.</summary>
    private async Task<SideMenuPage> LoginAndOpenMenuAsync()
    {
        await GoToLoginAsync();
        var loginPage = await LoginPage.CreateAsync(Page);
        await loginPage.EnterIdentifierAsync(TestEmail!);
        await loginPage.EnterPasswordAsync(TestPassword!);
        await loginPage.SubmitLoginAsync();
        var menu = await SideMenuPage.CreateAsync(Page);
        return await menu.OpenAsync();
    }

    [Test]
    [Description("BASE and S2 - light theme sets data-theme='light', dark theme removes it; font M active by default")]
    public async Task TestThemeSelection()
    {
        // BASE: light theme, font M by default
        var menu = await LoginAndOpenMenuAsync();
        await menu.ClickThemeAsync("light");

        Assert.That(await menu.IsThemeActiveAsync("light"), Is.True,
            "BASE: 'light' button must have the active class after clicking");
        Assert.That(await menu.IsThemeActiveAsync("dark"), Is.False,
            "BASE: 'dark' button must not be active when 'light' is selected");
        Assert.That(await menu.GetHtmlDataThemeAsync(), Is.EqualTo("light"),
            "BASE: <html> element must have data-theme='light'");
        Assert.That(await menu.IsFontSizeActiveAsync("M"), Is.True, "BASE: M font-size must be active by default");

        // S2: dark theme
        await menu.ClickThemeAsync("dark");

        Assert.That(await menu.IsThemeActiveAsync("dark"), Is.True,
            "S2: 'dark' button must have the active class after clicking");
        Assert.That(await menu.IsThemeActiveAsync("light"), Is.False, "S2: 'light' button must not be active");
        Assert.That(await menu.GetHtmlDataThemeAsync(), Is.EqualTo(""),
            "S2: dark mode must have no data-theme attribute on <html>");
    }

    [Test]
    [Description("S3 and S4 - font sizes S and L are applied with the light theme")]
    public async Task TestFontSizeSelection()
    {
        var menu = await LoginAndOpenMenuAsync();
        await menu.ClickThemeAsync("light");

        // S3: font S
        await menu.ClickFontSizeAsync("S");
        Assert.That(await menu.GetHtmlDataThemeAsync(), Is.EqualTo("light"), "S3: data-theme must be 'light'");
        Assert.That(await menu.IsFontSizeActiveAsync("S"), Is.True, "S3: 'S' font-size button must be active");
        Assert.That(await menu.IsFontSizeActiveAsync("M"), Is.False, "S3: 'M' font-size button must not be active");
        Assert.That(await menu.GetHtmlDataFontSizeAsync(), Is.EqualTo("S"), "S3: data-font-size must be 'S'");

        // S4: font L
        await menu.ClickFontSizeAsync("L");
        Assert.That(await menu.GetHtmlDataThemeAsync(), Is.EqualTo("light"), "S4: data-theme must still be 'light'");
        Assert.That(await menu.IsFontSizeActiveAsync("L"), Is.True, "S4: 'L' font-size button must be active");
        Assert.That(await menu.IsFontSizeActiveAsync("M"), Is.False, "S4: 'M' font-size button must not be active");
        Assert.That(await menu.GetHtmlDataFontSizeAsync(), Is.EqualTo("L"), "S4: data-font-size must be 'L'");
    }
}
