using DevorApp.E2ETests.Common;
using DevorApp.E2ETests.Pages;
using static Microsoft.Playwright.Assertions;
using NUnit.Framework;

namespace DevorApp.E2ETests.Tests.E2E;

/// <summary>
/// Browser tests for /recommend-restaurants (BASE, S2-S11). Most tests use the real backend, so result counts are only asserted where
/// the search endpoint is mocked (S10, S11).
///
/// Base-Choice coverage:
///   BASE — search with base filters (categories + prices + preferred location).
///   S2 / S4 — no categories / no price: the search still runs without an error.
///   S6 / S7 — "include places without price" / "open now" unchecked do not block the search.
///   S8 — another valid location completes without an error.
///   S9 — "other location" selected but left empty shows an error.
///   S10 — 0 results (mocked).
///   S11 — 1 result (mocked).
/// </summary>
[TestFixture]
public class TestRecommendView : BaseLoggedClass
{
    // Cuisine tag ids from the frontend tags.json
    private const string Mexican = "mexican_restaurant";
    private const string Italian = "italian_restaurant";

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
                    if (typeof input === 'string' && input.includes('/api/v1/recommendations/search')) {
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

    [Test]
    [Description("BASE and S8 - search with base filters, preferred and alternative location")]
    public async Task TestBase_SearchWithBaseFiltersAndAlternativeLocation()
    {
        // BASE: preferred location, several categories and prices
        var page = await LoginAndGoToRecommendAsync();
        await page.AddCategoryAsync("Mexicano", Mexican);
        await page.AddCategoryAsync("Italiano", Italian);
        await page.ClickPriceAsync(1);
        await page.ClickPriceAsync(2);
        await page.SetIncludeNoPriceAsync(true);
        await page.SetOpenNowAsync(true);
        await page.SelectPreferredLocationAsync();
        await page.SearchAsync();
        Assert.That(await page.HasErrorMessageAsync(), Is.False,
            "BASE: search with base filters must not produce a validation error");

        // S8: alternative location (needs the autocomplete mock)
        page = await LoginAndGoToRecommendAsync();
        await page.AddCategoryAsync("Mexicano", Mexican);
        await page.AddCategoryAsync("Italiano", Italian);
        await page.ClickPriceAsync(1);
        await page.ClickPriceAsync(2);

        await InjectAutocompleteMockAsync();
        await page.SelectOtherLocationAsync("Barcelona, España");
        await TriggerAutocompletePlaceChangedAsync();

        await page.SearchAsync();
        Assert.That(await page.HasErrorMessageAsync(), Is.False,
            "S8: search with custom location and multiple filters must not produce an error");
    }

    [Test]
    [Description("S2, S3, S4, S5, S6, S7 - optional filters: no categories/prices, one category, one price, booleans off")]
    public async Task TestOptionalFilters()
    {
        // S2 + S4: no categories, no prices -> no frontend error
        var page = await LoginAndGoToRecommendAsync();
        await page.SelectPreferredLocationAsync();
        await page.SearchAsync();
        Assert.That(await page.HasErrorMessageAsync(), Is.False,
            "S2/S4: searching without categories or prices must not block with an error");

        // S6 + S7: uncheck "include no price" and "open now" (the user is still logged in)
        await Page.GotoAsync($"{SutUrl}/recommend-restaurants");
        page = await RecommendPage.CreateAsync(Page);
        await page.AddCategoryAsync("Italiano", Italian);
        await page.SetIncludeNoPriceAsync(false);
        await page.SetOpenNowAsync(false);
        await page.SelectPreferredLocationAsync();
        await page.SearchAsync();
        Assert.That(await page.HasErrorMessageAsync(), Is.False,
            "S6/S7: unchecking boolean filters must not produce a validation error");

        // S3: 1 category, multiple prices
        await Page.GotoAsync($"{SutUrl}/recommend-restaurants");
        page = await RecommendPage.CreateAsync(Page);
        await page.AddCategoryAsync("Mexicano", Mexican);
        await page.ClickPriceAsync(1);
        await page.ClickPriceAsync(2);
        await page.SelectPreferredLocationAsync();
        await page.SearchAsync();
        Assert.That(await page.HasErrorMessageAsync(), Is.False,
            "S3: searching with 1 category and multiple prices must not produce an error");

        // S5: multiple categories, 1 price
        await Page.GotoAsync($"{SutUrl}/recommend-restaurants");
        page = await RecommendPage.CreateAsync(Page);
        await page.AddCategoryAsync("Mexicano", Mexican);
        await page.AddCategoryAsync("Italiano", Italian);
        await page.ClickPriceAsync(1);
        await page.SelectPreferredLocationAsync();
        await page.SearchAsync();
        Assert.That(await page.HasErrorMessageAsync(), Is.False,
            "S5: searching with multiple categories and 1 price must not produce an error");
    }

    [Test]
    [Description("S9, S10, S11 - empty other-location validation (S9), 0 results (S10) and 1 result (S11)")]
    public async Task TestS9_EmptyOtherLocation()
    {
        // S9: empty alternative location
        var pageS9 = await LoginAndGoToRecommendAsync();
        await pageS9.AddCategoryAsync("Mexicano", Mexican);
        await pageS9.SelectOtherLocationAsync(""); // empty location
        await pageS9.SearchAsync();

        Assert.That(await pageS9.HasErrorMessageAsync(), Is.True,
            "Searching without a location when 'other location' is selected must show an error");
        var errorMessage = (await pageS9.GetErrorMessageAsync()).ToLowerInvariant();
        Assert.That(errorMessage.Contains("ubicación") || errorMessage.Contains("localiz"), Is.True,
            "Error message must mention location");

        // S10: 0 results (fetch mock)
        await Page.GotoAsync($"{SutUrl}/recommend-restaurants");
        var pageS10 = await RecommendPage.CreateAsync(Page);
        await pageS10.AddCategoryAsync("Mexicano", Mexican);
        await pageS10.SelectPreferredLocationAsync();

        await MockSearchResultsAsync("[]");
        await pageS10.SearchAsync();
        await pageS10.WaitForResultCountAsync(0);
        Assert.That(await pageS10.GetResultCountAsync(), Is.EqualTo(0), "S10: result count must be 0");
        await RestoreFetchAsync();

        // S11: 1 result (fetch mock)
        await Page.GotoAsync($"{SutUrl}/recommend-restaurants");
        var pageS11 = await RecommendPage.CreateAsync(Page);
        await pageS11.AddCategoryAsync("Mexicano", Mexican);
        await pageS11.SelectPreferredLocationAsync();

        await MockSearchResultsAsync(
            "[{\"id\":\"test_place_11\",\"name\":\"Restaurant S11\",\"rating\":4.0,\"user_ratings_total\":10," +
            "\"types\":[\"restaurant\"],\"address\":\"Street 11\",\"main_photo\":null,\"summary\":\"S11\",\"open_now\":true}]");
        await pageS11.SearchAsync();
        await pageS11.WaitForResultCountAsync(1);
        Assert.That(await pageS11.GetResultCountAsync(), Is.EqualTo(1), "S11: result count must be 1");
        await RestoreFetchAsync();
    }
}
