using DevorApp.E2ETests.Common;
using DevorApp.E2ETests.Pages;
using NUnit.Framework;

namespace DevorApp.E2ETests.Tests.E2E;

/// <summary>
/// Port of epigijon.devorapp.e2e.functional.tests.e2e.TestSideMenu.
///
/// Browser tests for the DevorApp side menu drawer. Adapts
/// sidemenu.spec.ts (Playwright/TS) to Playwright/NUnit. The side menu is
/// accessed from /home via the hamburger button.
///
/// Base-Choice coverage:
///   BASE / S2 — tema claro (BASE) activa data-theme='light'; tema oscuro
///     (S2) elimina el atributo. La letra M está activa por defecto en
///     ambos casos.
///   S3 / S4   — letra S y letra L se aplican correctamente junto con tema
///     claro.
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

    // ── 1. BASE + S2: selección de tema (Claro y Oscuro) ─────────────────────

    [Test]
    [Description("BASE y S2 — el tema Claro activa data-theme='light' y el Oscuro lo elimina; letra M activa por defecto")]
    public async Task TestSeleccionTema()
    {
        // BASE: tema Claro, letra M por defecto
        var menu = await LoginAndOpenMenuAsync();
        await menu.ClickThemeAsync("Claro");

        Assert.That(await menu.IsThemeActiveAsync("Claro"), Is.True,
            "BASE: 'Claro' button must have the active class after clicking");
        Assert.That(await menu.IsThemeActiveAsync("Oscuro"), Is.False,
            "BASE: 'Oscuro' button must not be active when 'Claro' is selected");
        Assert.That(await menu.GetHtmlDataThemeAsync(), Is.EqualTo("light"),
            "BASE: <html> element must have data-theme='light'");
        Assert.That(await menu.IsFontSizeActiveAsync("M"), Is.True, "BASE: M font-size must be active by default");

        // S2: tema Oscuro
        await menu.ClickThemeAsync("Oscuro");

        Assert.That(await menu.IsThemeActiveAsync("Oscuro"), Is.True,
            "S2: 'Oscuro' button must have the active class after clicking");
        Assert.That(await menu.IsThemeActiveAsync("Claro"), Is.False, "S2: 'Claro' button must not be active");
        Assert.That(await menu.GetHtmlDataThemeAsync(), Is.EqualTo(""),
            "S2: dark mode must have no data-theme attribute on <html>");
    }

    // ── 2. S3 + S4: selección de tamaño de letra (S y L) ─────────────────────

    [Test]
    [Description("S3 y S4 — la letra S y la letra L se aplican correctamente con tema Claro")]
    public async Task TestSeleccionTamanoLetra()
    {
        var menu = await LoginAndOpenMenuAsync();
        await menu.ClickThemeAsync("Claro");

        // S3: letra S
        await menu.ClickFontSizeAsync("S");
        Assert.That(await menu.GetHtmlDataThemeAsync(), Is.EqualTo("light"), "S3: data-theme must be 'light'");
        Assert.That(await menu.IsFontSizeActiveAsync("S"), Is.True, "S3: 'S' font-size button must be active");
        Assert.That(await menu.IsFontSizeActiveAsync("M"), Is.False, "S3: 'M' font-size button must not be active");
        Assert.That(await menu.GetHtmlDataFontSizeAsync(), Is.EqualTo("S"), "S3: data-font-size must be 'S'");

        // S4: letra L
        await menu.ClickFontSizeAsync("L");
        Assert.That(await menu.GetHtmlDataThemeAsync(), Is.EqualTo("light"), "S4: data-theme must still be 'light'");
        Assert.That(await menu.IsFontSizeActiveAsync("L"), Is.True, "S4: 'L' font-size button must be active");
        Assert.That(await menu.IsFontSizeActiveAsync("M"), Is.False, "S4: 'M' font-size button must not be active");
        Assert.That(await menu.GetHtmlDataFontSizeAsync(), Is.EqualTo("L"), "S4: data-font-size must be 'L'");
    }
}
