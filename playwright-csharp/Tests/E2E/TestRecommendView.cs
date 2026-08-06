using DevorApp.E2ETests.Common;
using DevorApp.E2ETests.Pages;
using Microsoft.Playwright;
using NUnit.Framework;

namespace DevorApp.E2ETests.Tests.E2E;

/// <summary>
/// Port of epigijon.devorapp.e2e.functional.tests.e2e.TestRecommendView.
///
/// Browser tests for the DevorApp recommendation search page
/// (/recommend-restaurants). Adapts recommendation.spec.ts (Playwright/TS)
/// to Playwright/NUnit. Unlike the TS version (which mocks the backend),
/// most of these tests call the real backend API. Result counts are
/// therefore not asserted to exact numbers; instead we assert
/// structural/functional behaviour. S10/S11 mock the fetch response
/// directly to pin down exact result counts.
///
/// Base-Choice coverage:
///   BASE — search with base filters (categories + prices + ubicación
///     preferida) works.
///   S2 — no categories selected → request is still sent without error.
///   S4 — no price selected → request is still sent without error.
///   S6 — "Sin precio" unchecked → does not block search.
///   S7 — "Abierto ahora" unchecked → does not block search.
///   S8 — another valid location is chosen → search completes without error.
///   S9 — other-location selected but left empty → error message shown.
///   S10 — 0 results (mocked) → result count is 0.
///   S11 — 1 result (mocked) → result count is 1.
/// </summary>
[TestFixture]
public class TestRecommendView : BaseLoggedClass
{
    [OneTimeSetUp]
    public async Task CreateTestUser()
    {
        var ts = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds();
        await SetupTestUserAsync($"recui{ts % 100000}", $"recui{ts}@devorapp.test", "Test1234!");
    }

    [OneTimeTearDown]
    public async Task CleanupTestUser() => await TeardownTestUserAsync();

    /// <summary>Logs in and navigates to /recommend-restaurants.</summary>
    private async Task<RecommendPage> LoginAndGoToRecommendAsync()
    {
        await GoToLoginAsync();
        var loginPage = await LoginPage.CreateAsync(Page);
        await loginPage.EnterIdentifierAsync(TestEmail!);
        await loginPage.EnterPasswordAsync(TestPassword!);
        await loginPage.SubmitLoginAsync();
        await Page.GotoAsync($"{SutUrl}/recommend-restaurants");
        return await RecommendPage.CreateAsync(Page);
    }

    private async Task MockSearchResultsAsync(string resultsJson)
    {
        await Page.EvaluateAsync(
            @"(resultsJson) => {
                window.originalFetch = window.fetch;
                window.fetch = function(input, init) {
                    if (typeof input === 'string' && input.includes('/api/recommendations/search')) {
                        return Promise.resolve(new Response(
                            JSON.stringify({ results: JSON.parse(resultsJson), next_page_token: null }),
                            { status: 200, headers: { 'Content-Type': 'application/json' } }));
                    }
                    return window.originalFetch(input, init);
                };
            }",
            resultsJson);
    }

    private async Task RestoreFetchAsync() =>
        await Page.EvaluateAsync("() => { if (window.originalFetch) { window.fetch = window.originalFetch; } }");

    // ── 1. BASE + S8: búsqueda con filtros base (ubicación preferida y alternativa) ──

    [Test]
    [Description("BASE — búsqueda con filtros base y ubicación preferida/alternativa (BASE, S8)")]
    public async Task TestBase_BusquedaFiltrosBaseYUbicacionAlternativa()
    {
        // BASE: preferred location + multiple categories + multiple prices
        var page = await LoginAndGoToRecommendAsync();
        await page.AddCategoryAsync("Mexicano", "Mexicano");
        await page.AddCategoryAsync("Italiano", "Italiano");
        await page.ClickPriceAsync("€");
        await page.ClickPriceAsync("€€");
        await page.SetIncludeNoPriceAsync(true);
        await page.SetOpenNowAsync(true);
        await page.SelectPreferredLocationAsync();
        await page.SearchAsync();
        Assert.That(await page.HasErrorMessageAsync(), Is.False,
            "BASE: search with base filters must not produce a validation error");

        // S8: alternate location (autocomplete mock needed)
        page = await LoginAndGoToRecommendAsync();
        await page.AddCategoryAsync("Mexicano", "Mexicano");
        await page.AddCategoryAsync("Italiano", "Italiano");
        await page.ClickPriceAsync("€");
        await page.ClickPriceAsync("€€");

        await InjectAutocompleteMockAsync();
        await page.SelectOtherLocationAsync("Barcelona, España");
        await TriggerAutocompletePlaceChangedAsync();

        await page.SearchAsync();
        Assert.That(await page.HasErrorMessageAsync(), Is.False,
            "S8: search with custom location and multiple filters must not produce an error");
    }

    // ── 2. S2, S4, S6, S7: filtros opcionales sin categorías ni precio, booleanos en falso ──

    [Test]
    [Description("S2, S4, S6, S7 — búsqueda sin categorías ni precio y con booleanos en false")]
    public async Task TestFiltrosOpcionales()
    {
        // S2 + S4: no categories, no prices → search without frontend error
        var page = await LoginAndGoToRecommendAsync();
        await page.SelectPreferredLocationAsync();
        await page.SearchAsync();
        Assert.That(await page.HasErrorMessageAsync(), Is.False,
            "S2/S4: searching without categories or prices must not block with an error");

        // S6 + S7: uncheck "sin precio" and "abierto ahora" — user is still logged in
        await Page.GotoAsync($"{SutUrl}/recommend-restaurants");
        page = await RecommendPage.CreateAsync(Page);
        await page.AddCategoryAsync("Italiano", "Italiano");
        await page.SetIncludeNoPriceAsync(false);
        await page.SetOpenNowAsync(false);
        await page.SelectPreferredLocationAsync();
        await page.SearchAsync();
        Assert.That(await page.HasErrorMessageAsync(), Is.False,
            "S6/S7: unchecking boolean filters must not produce a validation error");

        // S3: 1 category, multiple prices
        await Page.GotoAsync($"{SutUrl}/recommend-restaurants");
        page = await RecommendPage.CreateAsync(Page);
        await page.AddCategoryAsync("Mexicano", "Mexicano");
        await page.ClickPriceAsync("€");
        await page.ClickPriceAsync("€€");
        await page.SelectPreferredLocationAsync();
        await page.SearchAsync();
        Assert.That(await page.HasErrorMessageAsync(), Is.False,
            "S3: searching with 1 category and multiple prices must not produce an error");

        // S5: multiple categories, 1 price
        await Page.GotoAsync($"{SutUrl}/recommend-restaurants");
        page = await RecommendPage.CreateAsync(Page);
        await page.AddCategoryAsync("Mexicano", "Mexicano");
        await page.AddCategoryAsync("Italiano", "Italiano");
        await page.ClickPriceAsync("€");
        await page.SelectPreferredLocationAsync();
        await page.SearchAsync();
        Assert.That(await page.HasErrorMessageAsync(), Is.False,
            "S5: searching with multiple categories and 1 price must not produce an error");
    }

    // ── 3. S9: ubicación alternativa vacía → error de validación ─────────────

    [Test]
    [Description("S9, S10, S11 — validación de otra ubicación vacía (S9), y control de resultados 0 (S10) y 1 (S11)")]
    public async Task TestS9_OtraUbicacionVacia()
    {
        // 1. S9: empty alternate location
        var pageS9 = await LoginAndGoToRecommendAsync();
        await pageS9.AddCategoryAsync("Mexicano", "Mexicano");
        await pageS9.SelectOtherLocationAsync(""); // empty location
        await pageS9.SearchAsync();

        Assert.That(await pageS9.HasErrorMessageAsync(), Is.True,
            "Searching without a location when 'otra ubicación' is selected must show an error");
        var errorMessage = (await pageS9.GetErrorMessageAsync()).ToLowerInvariant();
        Assert.That(errorMessage.Contains("ubicación") || errorMessage.Contains("localiz"), Is.True,
            "Error message must mention location");

        // 2. S10: 0 results (using fetch mock)
        await Page.GotoAsync($"{SutUrl}/recommend-restaurants");
        var pageS10 = await RecommendPage.CreateAsync(Page);
        await pageS10.AddCategoryAsync("Mexicano", "Mexicano");
        await pageS10.SelectPreferredLocationAsync();

        await MockSearchResultsAsync("[]");
        await pageS10.SearchAsync();
        await Page.Locator(".suggestion-card").WaitForAsync(new LocatorWaitForOptions { State = WaitForSelectorState.Hidden });
        Assert.That(await pageS10.GetResultCountAsync(), Is.EqualTo(0), "S10: result count must be 0");
        await RestoreFetchAsync();

        // 3. S11: 1 result (using fetch mock)
        await Page.GotoAsync($"{SutUrl}/recommend-restaurants");
        var pageS11 = await RecommendPage.CreateAsync(Page);
        await pageS11.AddCategoryAsync("Mexicano", "Mexicano");
        await pageS11.SelectPreferredLocationAsync();

        await MockSearchResultsAsync(
            "[{\"id\":\"test_place_11\",\"name\":\"Restaurante S11\",\"rating\":4.0,\"user_ratings_total\":10," +
            "\"types\":[\"restaurant\"],\"address\":\"Calle 11\",\"main_photo\":null,\"summary\":\"S11\",\"open_now\":true}]");
        await pageS11.SearchAsync();
        await Page.Locator(".suggestion-card").First.WaitForAsync();
        Assert.That(await pageS11.GetResultCountAsync(), Is.EqualTo(1), "S11: result count must be 1");
        await RestoreFetchAsync();
    }
}
