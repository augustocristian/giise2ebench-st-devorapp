using System.Text.Json.Nodes;
using DevorApp.E2ETests.Common;
using DevorApp.E2ETests.Pages;
using NUnit.Framework;

namespace DevorApp.E2ETests.Tests.E2E;

/// <summary>
/// Browser tests for /favorites with mocked list endpoints (BASE, S2-S6).
///
/// Base-Choice coverage:
///   BASE — multiple lists, 0 restaurants, with search filter.
///   S2 — 0 lists created (empty state general).
///   S3 — 1 list, 0 restaurants, with search filter.
///   S4 — multiple lists, 1 restaurant, with search filter.
///   S5 — multiple lists, multiple restaurants, with search filter.
///   S6 — multiple lists, 0 restaurants, no search filter.
/// </summary>
[TestFixture]
public class TestFavoritesView : BaseLoggedClass
{
    private const string PlaceA = "MOCK_PLACE_101";
    private const string PlaceB = "MOCK_PLACE_102";

    [OneTimeSetUp]
    public async Task CreateTestUser()
    {
        var ts = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds();
        await SetupTestUserAsync($"favui{ts % 100000}", $"favui{ts}@devorapp.test", "Test1234!");
    }

    [OneTimeTearDown]
    public async Task CleanupTestUser() => await TeardownTestUserAsync();

    // The frontend uses fetch, so the list endpoints are mocked by overriding window.fetch

    private async Task InjectFavoritesMockAsync(JsonArray lists, JsonObject detail)
    {
        await Page.EvaluateAsync(
            @"([listsJson, detailJson]) => {
                window.mockFavoritesLists = JSON.parse(listsJson);
                window.mockFavoritesDetail = JSON.parse(detailJson);
                window.originalFetch = window.fetch;
                window.fetch = function(input, init) {
                    if (typeof input === 'string') {
                        if (input.includes('/api/v1/favorites/lists/')) {
                            return Promise.resolve(new Response(JSON.stringify(window.mockFavoritesDetail),
                                { status: 200, headers: { 'Content-Type': 'application/json' } }));
                        }
                        if (input.includes('/api/v1/favorites/lists')) {
                            return Promise.resolve(new Response(JSON.stringify(window.mockFavoritesLists),
                                { status: 200, headers: { 'Content-Type': 'application/json' } }));
                        }
                    }
                    return window.originalFetch(input, init);
                };
            }",
            new[] { lists.ToJsonString(), detail.ToJsonString() });
    }

    private async Task RestoreFetchAsync() =>
        await Page.EvaluateAsync("() => { if (window.originalFetch) { window.fetch = window.originalFetch; } }");

    private static JsonArray MockLists(int count)
    {
        var array = new JsonArray();
        for (var i = 1; i <= count; i++)
        {
            array.Add(new JsonObject
            {
                ["id"] = i,
                ["user_id"] = "uid",
                ["name"] = $"List {i}",
                ["icon"] = "Heart",
            });
        }
        return array;
    }

    private static JsonObject MockDetail(int listId, string listName, int restaurantCount)
    {
        string[] placeIds = { PlaceA, PlaceB };
        string[] names = { "Restaurant One", "Restaurant Two" };

        var restaurants = new JsonArray();
        for (var i = 0; i < restaurantCount; i++)
        {
            var placeId = placeIds[i % placeIds.Length];
            var name = names[i % names.Length];
            restaurants.Add(new JsonObject
            {
                ["id"] = i + 1,
                ["list_id"] = listId,
                ["place_id"] = placeId,
                ["restaurant"] = new JsonObject
                {
                    ["id"] = placeId,
                    ["name"] = name,
                    ["rating"] = 4.5,
                    ["user_ratings_total"] = 100,
                    ["address"] = $"Fake Street {i + 1}",
                    ["main_photo"] = null,
                    ["types"] = new JsonArray("restaurant"),
                },
            });
        }

        return new JsonObject
        {
            ["list"] = new JsonObject { ["id"] = listId, ["user_id"] = "uid", ["name"] = listName, ["icon"] = "Heart" },
            ["restaurants"] = restaurants,
        };
    }

    private async Task<FavoritesPage> LoginGoToFavoritesWithMockAsync(JsonArray lists, JsonObject detail)
    {
        await GoToLoginAsync();
        var loginPage = await LoginPage.CreateAsync(Page);
        await loginPage.EnterIdentifierAsync(TestEmail!);
        await loginPage.EnterPasswordAsync(TestPassword!);
        await loginPage.SubmitLoginAsync();

        await InjectFavoritesMockAsync(lists, detail);

        var menu = await SideMenuPage.CreateAsync(Page);
        await menu.OpenAsync();
        await menu.GoToAsync("favorites");

        return await FavoritesPage.CreateAsync(Page);
    }

    [Test]
    [Description("BASE - several lists, 0 restaurants, with search")]
    public async Task TestBase_ListSearch()
    {
        var page = await LoginGoToFavoritesWithMockAsync(MockLists(2), MockDetail(1, "List 1", 0));
        try
        {
            Assert.That(await page.GetListCountAsync(), Is.EqualTo(2), "2 lists must be visible");

            await page.OpenListByNameAsync("List 1");
            Assert.That(await page.GetRestaurantCountAsync(), Is.EqualTo(0), "The list must be empty");

            await page.SearchWithinAsync("pizza");
            Assert.That(await page.GetRestaurantCountAsync(), Is.EqualTo(0), "The filtered list must stay empty");
        }
        finally
        {
            await RestoreFetchAsync();
        }
    }

    [Test]
    [Description("S2, S3, S6 - empty states and search")]
    public async Task TestEmptyCases()
    {
        // S2: 0 lists -> empty state
        var pageEmpty = await LoginGoToFavoritesWithMockAsync(new JsonArray(), new JsonObject());
        try
        {
            Assert.That(await pageEmpty.GetListCountAsync(), Is.EqualTo(0), "S2: there must be 0 lists");
            Assert.That(await pageEmpty.IsEmptyStateVisibleAsync(), Is.True, "S2: the empty-state text must be visible");
        }
        finally
        {
            await RestoreFetchAsync();
        }

        // S3: 1 list, 0 restaurants, with search
        var pageS3 = await LoginGoToFavoritesWithMockAsync(MockLists(1), MockDetail(1, "List 1", 0));
        try
        {
            Assert.That(await pageS3.GetListCountAsync(), Is.EqualTo(1), "S3: there must be 1 list");
            await pageS3.OpenListByNameAsync("List 1");
            await pageS3.SearchWithinAsync("pizza");
            Assert.That(await pageS3.GetRestaurantCountAsync(), Is.EqualTo(0), "S3: the filtered list must be empty");
        }
        finally
        {
            await RestoreFetchAsync();
        }

        // S6: several lists, 0 restaurants, no search
        var pageS6 = await LoginGoToFavoritesWithMockAsync(MockLists(2), MockDetail(1, "List 1", 0));
        try
        {
            Assert.That(await pageS6.GetListCountAsync(), Is.EqualTo(2), "S6: there must be 2 lists");
            await pageS6.OpenListByNameAsync("List 1");
            Assert.That(await pageS6.IsDetailEmptyStateVisibleAsync(), Is.True, "S6: the empty-list text must be visible");
            Assert.That(await pageS6.GetRestaurantCountAsync(), Is.EqualTo(0), "S6: there must be 0 restaurants");
        }
        finally
        {
            await RestoreFetchAsync();
        }
    }

    [Test]
    [Description("S4, S5 - lists with restaurants and searches")]
    public async Task TestCasesWithRestaurants()
    {
        // S4: several lists, 1 restaurant, with search
        var pageS4 = await LoginGoToFavoritesWithMockAsync(MockLists(2), MockDetail(1, "List 1", 1));
        try
        {
            await pageS4.OpenListByNameAsync("List 1");
            Assert.That(await pageS4.GetRestaurantCountAsync(), Is.EqualTo(1), "S4: there must be 1 restaurant initially");

            await pageS4.SearchWithinAsync("One");
            Assert.That(await pageS4.GetRestaurantCountAsync(), Is.EqualTo(1), "S4: there must still be 1 restaurant");

            await pageS4.SearchWithinAsync("zzz_no_match");
            Assert.That(await pageS4.GetRestaurantCountAsync(), Is.EqualTo(0),
                "S4: there must be 0 restaurants after a failed search");
        }
        finally
        {
            await RestoreFetchAsync();
        }

        // S5: several lists, several restaurants, with search
        var pageS5 = await LoginGoToFavoritesWithMockAsync(MockLists(2), MockDetail(1, "List 1", 2));
        try
        {
            await pageS5.OpenListByNameAsync("List 1");
            Assert.That(await pageS5.GetRestaurantCountAsync(), Is.EqualTo(2), "S5: there must be 2 restaurants initially");

            await pageS5.SearchWithinAsync("Two");
            Assert.That(await pageS5.GetRestaurantCountAsync(), Is.EqualTo(1),
                "S5: filtering by 'Two' must leave 1 restaurant");

            await pageS5.SearchWithinAsync("zzz_no_match");
            Assert.That(await pageS5.GetRestaurantCountAsync(), Is.EqualTo(0),
                "S5: there must be 0 restaurants after a failed search");
        }
        finally
        {
            await RestoreFetchAsync();
        }
    }
}
