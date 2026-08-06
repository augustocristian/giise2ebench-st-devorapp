using DevorApp.E2ETests.Common;
using DevorApp.E2ETests.Pages;
using Microsoft.Playwright;
using NUnit.Framework;
using static Microsoft.Playwright.Assertions;

namespace DevorApp.E2ETests.Tests.E2E;

/// <summary>
/// Port of epigijon.devorapp.e2e.functional.tests.e2e.TestRatingView.
///
/// Browser tests for the DevorApp rating modal (accessed from the history page).
///
/// Base-Choice coverage:
///   BASE — all aspects rated at max with a comment → submission succeeds.
///   S2, S5, S8, S11 — any single aspect at 0 stars disables the submit button.
///   S3, S4, S6, S7 — variable calidad/precio ratings with the rest at max → succeeds.
///   S9, S10, S12, S13 — variable higiene/trato ratings with the rest at max → succeeds.
///   S14 — empty comment is accepted.
/// </summary>
[TestFixture]
public class TestRatingView : BaseLoggedClass
{
    private const string PlaceId = "ChIJN1t_tDeuEmsRUsoyG83frY4";

    [OneTimeSetUp]
    public async Task CreateTestUser()
    {
        var ts = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds();
        await SetupTestUserAsync($"ratingui{ts % 100000}", $"ratingui{ts}@devorapp.test", "Test1234!");
    }

    [SetUp]
    public async Task EnsureHistorialEntry()
    {
        await ApiLoginAsync();
        var apiBase = Properties.GetValueOrDefault("LOCALHOST_URL", "http://localhost:8000");
        await ApiDeleteAsync($"{apiBase}/api/valoraciones/{PlaceId}");
        await ApiPostAsync($"{apiBase}/api/historial", new System.Text.Json.Nodes.JsonObject { ["place_id"] = PlaceId });
    }

    [OneTimeTearDown]
    public async Task CleanupTestUser() => await TeardownTestUserAsync();

    // ── Navigation helpers ───────────────────────────────────────────────────

    private async Task<HistoryPage> LoginAndGoToHistoryAsync()
    {
        await GoToLoginAsync();
        var loginPage = await LoginPage.CreateAsync(Page);
        await loginPage.EnterIdentifierAsync(TestEmail!);
        await loginPage.EnterPasswordAsync(TestPassword!);
        await loginPage.SubmitLoginAsync();
        await Page.GotoAsync($"{SutUrl}/history");
        return await HistoryPage.CreateAsync(Page);
    }

    private async Task OpenRatingModalAsync(HistoryPage page)
    {
        await page.OpenCardMenuAsync(0);
        var rateBtn = Page.Locator("xpath=//button[contains(.,'Valorar restaurante')]");
        await rateBtn.ClickAsync();
        await Page.Locator(".valuation-content").WaitForAsync();
    }

    private async Task SelectStarsAsync(string aspect, int stars)
    {
        if (stars <= 0) return;
        var row = Page.Locator(".aspect-row-premium").Filter(new LocatorFilterOptions { HasText = aspect });
        if (await row.CountAsync() == 0)
            throw new ElementNotFoundException($"Aspect row not found: {aspect}");
        var starsContainer = row.First.Locator("xpath=./div[2]");
        var svgs = starsContainer.Locator("svg");
        var count = await svgs.CountAsync();
        if (stars <= count) await svgs.Nth(stars - 1).ClickAsync();
    }

    private async Task<bool> IsSubmitEnabledAsync()
    {
        var buttons = Page.Locator("button.btn-submit-valuation");
        if (await buttons.CountAsync() == 0) return false;
        return await buttons.First.IsEnabledAsync();
    }

    private async Task FillRatingsAsync(int calidad, int precio, int higiene, int trato, string? comentario)
    {
        await SelectStarsAsync("calidad", calidad);
        await SelectStarsAsync("precio", precio);
        await SelectStarsAsync("higiene", higiene);
        await SelectStarsAsync("trato", trato);
        var textarea = Page.Locator("textarea.textarea-premium");
        await textarea.FillAsync(comentario ?? "");
    }

    private async Task SubmitValuationAndVerifySuccessAsync()
    {
        await Page.Locator("button.btn-submit-valuation").ClickAsync();
        await Page.Locator(".valuation-content").WaitForAsync(new LocatorWaitForOptions { State = WaitForSelectorState.Hidden });
        await Expect(Page.Locator(".toast.success")).ToBeVisibleAsync();
        var toasts = Page.Locator(".toast.success");
        Assert.That(await toasts.CountAsync(), Is.GreaterThan(0),
            "A success toast must appear after a successful rating submission");
    }

    // ── 1. BASE: todos los aspectos al máximo con comentario ─────────────────

    [Test]
    [Description("debe guardar la valoración con todos los aspectos al máximo y comentario (BASE)")]
    public async Task TestGuardarValoracionCompletaBase()
    {
        var page = await LoginAndGoToHistoryAsync();
        await OpenRatingModalAsync(page);
        await FillRatingsAsync(5, 5, 5, 5, "Excelente servicio y comida deliciosa");
        Assert.That(await IsSubmitEnabledAsync(), Is.True, "Submit button must be enabled when all aspects are rated");
        await SubmitValuationAndVerifySuccessAsync();
    }

    // ── 2. S2, S5, S8, S11 + S14: 0 estrellas deshabilitan el botón; comentario vacío permitido ──

    [Test]
    [Description("debe deshabilitar envío con 0 estrellas en cualquier aspecto (S2, S5, S8, S11) y aceptar comentario vacío (S14)")]
    public async Task TestValidarCeroEstrellasYComentarioVacio()
    {
        // S2: Calidad = 0
        var page = await LoginAndGoToHistoryAsync();
        await OpenRatingModalAsync(page);
        await FillRatingsAsync(0, 5, 5, 5, "Comentario");
        Assert.That(await IsSubmitEnabledAsync(), Is.False, "S2: submit must be disabled when calidad has 0 stars");

        // S5: Precio = 0
        await Page.GotoAsync($"{SutUrl}/history");
        page = await HistoryPage.CreateAsync(Page);
        await OpenRatingModalAsync(page);
        await FillRatingsAsync(5, 0, 5, 5, "Comentario");
        Assert.That(await IsSubmitEnabledAsync(), Is.False, "S5: submit must be disabled when precio has 0 stars");

        // S8: Higiene = 0
        await Page.GotoAsync($"{SutUrl}/history");
        page = await HistoryPage.CreateAsync(Page);
        await OpenRatingModalAsync(page);
        await FillRatingsAsync(5, 5, 0, 5, "Comentario");
        Assert.That(await IsSubmitEnabledAsync(), Is.False, "S8: submit must be disabled when higiene has 0 stars");

        // S11: Trato = 0
        await Page.GotoAsync($"{SutUrl}/history");
        page = await HistoryPage.CreateAsync(Page);
        await OpenRatingModalAsync(page);
        await FillRatingsAsync(5, 5, 5, 0, "Comentario");
        Assert.That(await IsSubmitEnabledAsync(), Is.False, "S11: submit must be disabled when trato has 0 stars");

        // S14: empty comment is accepted
        await Page.GotoAsync($"{SutUrl}/history");
        page = await HistoryPage.CreateAsync(Page);
        await OpenRatingModalAsync(page);
        await FillRatingsAsync(5, 5, 5, 5, "");
        Assert.That(await IsSubmitEnabledAsync(), Is.True, "S14: submit must be enabled even with empty comment");
        await SubmitValuationAndVerifySuccessAsync();
    }

    // ── 3. S3, S4, S6, S7, S9, S10, S12, S13: puntuaciones variables ─────────

    [Test]
    [Description("debe guardar valoraciones con puntuaciones variables de calidad, precio, higiene y trato (S3, S4, S6, S7, S9, S10, S12, S13)")]
    public async Task TestPuntuacionesVariables()
    {
        // S3 & S7: Calidad = 1, Precio = 3 (resto base = 5)
        var page = await LoginAndGoToHistoryAsync();
        await OpenRatingModalAsync(page);
        await FillRatingsAsync(1, 3, 5, 5, "Comentario");
        Assert.That(await IsSubmitEnabledAsync(), Is.True, "S3/S7: submit must be enabled");
        await SubmitValuationAndVerifySuccessAsync();

        // S4 & S6: Calidad = 3, Precio = 1
        await EnsureHistorialEntry();
        await Page.GotoAsync($"{SutUrl}/history");
        page = await HistoryPage.CreateAsync(Page);
        await OpenRatingModalAsync(page);
        await FillRatingsAsync(3, 1, 5, 5, "Comentario");
        Assert.That(await IsSubmitEnabledAsync(), Is.True, "S4/S6: submit must be enabled");
        await SubmitValuationAndVerifySuccessAsync();

        // S9 & S13: Higiene = 1, Trato = 3
        await EnsureHistorialEntry();
        await Page.GotoAsync($"{SutUrl}/history");
        page = await HistoryPage.CreateAsync(Page);
        await OpenRatingModalAsync(page);
        await FillRatingsAsync(5, 5, 1, 3, "Comentario");
        Assert.That(await IsSubmitEnabledAsync(), Is.True, "S9/S13: submit must be enabled");
        await SubmitValuationAndVerifySuccessAsync();

        // S10 & S12: Higiene = 3, Trato = 1
        await EnsureHistorialEntry();
        await Page.GotoAsync($"{SutUrl}/history");
        page = await HistoryPage.CreateAsync(Page);
        await OpenRatingModalAsync(page);
        await FillRatingsAsync(5, 5, 3, 1, "Comentario");
        Assert.That(await IsSubmitEnabledAsync(), Is.True, "S10/S12: submit must be enabled");
        await SubmitValuationAndVerifySuccessAsync();
    }
}
