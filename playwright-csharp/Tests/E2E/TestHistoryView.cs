using System.Text.Json.Nodes;
using DevorApp.E2ETests.Common;
using DevorApp.E2ETests.Pages;
using NUnit.Framework;

namespace DevorApp.E2ETests.Tests.E2E;

/// <summary>
/// Browser tests for /history with a mocked history endpoint (BASE, S2, S3, S5, S6). The entries are mocked by overriding window.fetch to check the
/// month grouping, card counts and search.
///
/// Base-Choice coverage:
///   BASE — multiple months, multiple restaurants, no search filter.
///   S2 — empty history shows 0 groups and 0 cards.
///   S3 — 1 month with multiple restaurants.
///   S5 — exactly 1 restaurant in history.
///   S6 — search term filters cards and hides non-matching months.
/// </summary>
[TestFixture]
public class TestHistoryView : BaseLoggedClass
{
    private const string PlaceA = "MOCK_PLACE_101";
    private const string PlaceB = "MOCK_PLACE_102";

    [OneTimeSetUp]
    public async Task CreateTestUser()
    {
        var ts = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds();
        await SetupTestUserAsync($"histui{ts % 100000}", $"histui{ts}@devorapp.test", "Test1234!");
    }

    [OneTimeTearDown]
    public async Task CleanupTestUser() => await TeardownTestUserAsync();

    private async Task InjectHistoryMockAsync(JsonArray entries)
    {
        await Page.EvaluateAsync(
            @"(entriesJson) => {
                window.originalFetch = window.fetch;
                window.fetch = function(input, init) {
                    if (typeof input === 'string' && input.includes('/api/v1/history')) {
                        return Promise.resolve(new Response(JSON.stringify({ items: JSON.parse(entriesJson), total: JSON.parse(entriesJson).length, limit: 100, offset: 0 }),
                            { status: 200, headers: { 'Content-Type': 'application/json' } }));
                    }
                    return window.originalFetch(input, init);
                };
            }",
            entries.ToJsonString());
    }

    private async Task RestoreFetchAsync() =>
        await Page.EvaluateAsync("() => { if (window.originalFetch) { window.fetch = window.originalFetch; } }");

    private static JsonObject Entry(string id, string date, string name, double rating, int total, bool openNow) => new()
    {
        ["id"] = 1,
        ["user_id"] = "uid",
        ["place_id"] = id,
        ["accessed_at"] = date,
        ["restaurant"] = new JsonObject
        {
            ["id"] = id,
            ["name"] = name,
            ["rating"] = rating,
            ["user_ratings_total"] = total,
            ["types"] = new JsonArray("restaurant"),
            ["address"] = "Fake Street 123",
            ["main_photo"] = null,
            ["summary"] = "Excellent",
            ["open_now"] = openNow,
        },
    };

    private static JsonArray MockHistory(string date1, string date2) => new(
        new JsonObject
        {
            ["id"] = 1,
            ["user_id"] = "uid",
            ["place_id"] = PlaceA,
            ["accessed_at"] = date1,
            ["restaurant"] = new JsonObject
            {
                ["id"] = PlaceA,
                ["name"] = "Restaurant One",
                ["rating"] = 4.5,
                ["user_ratings_total"] = 100,
                ["types"] = new JsonArray("restaurant"),
                ["address"] = "Fake Street 123",
                ["main_photo"] = null,
                ["summary"] = "Excellent",
                ["open_now"] = true,
            },
        },
        new JsonObject
        {
            ["id"] = 2,
            ["user_id"] = "uid",
            ["place_id"] = PlaceB,
            ["accessed_at"] = date2,
            ["restaurant"] = new JsonObject
            {
                ["id"] = PlaceB,
                ["name"] = "Restaurant Two",
                ["rating"] = 4.0,
                ["user_ratings_total"] = 50,
                ["types"] = new JsonArray("restaurant"),
                ["address"] = "Evergreen Terrace 742",
                ["main_photo"] = null,
                ["summary"] = "Pleasant",
                ["open_now"] = false,
            },
        });

    private static JsonArray SingleMockEntry(string date) => new(Entry(PlaceA, date, "Restaurant One", 4.5, 100, true));

    private async Task<HistoryPage> LoginGoToHistoryWithMockAsync(JsonArray entries)
    {
        await GoToLoginAsync();
        var loginPage = await LoginPage.CreateAsync(Page);
        await loginPage.EnterIdentifierAsync(TestEmail!);
        await loginPage.EnterPasswordAsync(TestPassword!);
        await loginPage.SubmitLoginAsync();

        await InjectHistoryMockAsync(entries);

        var menu = await SideMenuPage.CreateAsync(Page);
        await menu.OpenAsync();
        await menu.GoToAsync("history");

        return await HistoryPage.CreateAsync(Page);
    }

    [Test]
    [Description("BASE - history page shows several month groups and multiple restaurant cards")]
    public async Task TestBase_MultipleEntries()
    {
        var page = await LoginGoToHistoryWithMockAsync(MockHistory("2026-05-15T12:00:00Z", "2026-06-15T12:00:00Z"));
        try
        {
            Assert.That(await page.GetGroupCountAsync(), Is.EqualTo(2), "There must be 2 groups");

            // JUNIO 2026 starts collapsed; expand it to see both cards
            await page.ToggleGroupAsync("JUNIO 2026");

            Assert.That(await page.GetCardCountAsync(), Is.EqualTo(2), "2 restaurant cards must be visible");
        }
        finally
        {
            await RestoreFetchAsync();
        }
    }

    [Test]
    [Description("Empty history (S2), 1 restaurant (S5) and 1 month with several (S3)")]
    public async Task TestEmptyAndSingleCases()
    {
        // S2: empty history
        var pageEmpty = await LoginGoToHistoryWithMockAsync(new JsonArray());
        try
        {
            Assert.That(await pageEmpty.GetGroupCountAsync(), Is.EqualTo(0), "S2: there must be 0 groups");
            Assert.That(await pageEmpty.GetCardCountAsync(), Is.EqualTo(0), "S2: there must be 0 cards");
        }
        finally
        {
            await RestoreFetchAsync();
        }

        // S5: exactly 1 restaurant entry
        var pageOne = await LoginGoToHistoryWithMockAsync(SingleMockEntry("2026-05-15T12:00:00Z"));
        try
        {
            Assert.That(await pageOne.GetGroupCountAsync(), Is.EqualTo(1), "S5: there must be 1 group");
            Assert.That(await pageOne.GetCardCountAsync(), Is.EqualTo(1), "S5: there must be 1 card");
        }
        finally
        {
            await RestoreFetchAsync();
        }

        // S3: 1 month with multiple restaurants
        var pageSameMonth = await LoginGoToHistoryWithMockAsync(MockHistory("2026-05-15T12:00:00Z", "2026-05-20T12:00:00Z"));
        try
        {
            Assert.That(await pageSameMonth.GetGroupCountAsync(), Is.EqualTo(1), "S3: there must be 1 group");
            Assert.That(await pageSameMonth.GetCardCountAsync(), Is.EqualTo(2), "S3: there must be 2 cards");
        }
        finally
        {
            await RestoreFetchAsync();
        }
    }

    [Test]
    [Description("S6 — searching in history filters cards; a non-matching term shows 0 cards")]
    public async Task TestSearchFilters()
    {
        var page = await LoginGoToHistoryWithMockAsync(MockHistory("2026-05-15T12:00:00Z", "2026-06-15T12:00:00Z"));
        try
        {
            await page.ToggleGroupAsync("JUNIO 2026");
            Assert.That(await page.GetCardCountAsync(), Is.EqualTo(2), "There must be 2 cards initially");

            await page.SearchAsync("One");
            Assert.That(await page.GetGroupCountAsync(), Is.EqualTo(1), "There must be 1 group after searching 'One'");
            Assert.That(await page.GetCardCountAsync(), Is.EqualTo(1), "There must be 1 card after searching 'One'");
            Assert.That(await page.GetCardNameAtAsync(0), Is.EqualTo("Restaurant One"),
                "The visible card must be 'Restaurant One'");

            await page.SearchAsync("zzz_nothing_xyzzy_no_match");
            Assert.That(await page.GetGroupCountAsync(), Is.EqualTo(0), "There must be 0 groups after a search with no matches");
            Assert.That(await page.GetCardCountAsync(), Is.EqualTo(0), "There must be 0 cards after a search with no matches");
        }
        finally
        {
            await RestoreFetchAsync();
        }
    }
}
