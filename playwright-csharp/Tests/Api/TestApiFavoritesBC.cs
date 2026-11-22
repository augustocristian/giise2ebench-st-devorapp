using DevorApp.E2ETests.Common;
using NUnit.Framework;

namespace DevorApp.E2ETests.Tests.Api;

/// <summary>
///
/// API Base-Choice tests for the favorites module.
///
/// Cases covered:
///   BASE   — create list, add several restaurants, GET returns all.
///   Case 2 — GET empty list returns empty restaurants array.
///   Case 3 — GET list with 1 restaurant returns array of size 1.
///   Case 4 — GET all lists returns the expected count.
///   Case 5 — DELETE restaurant removes it from the list detail.
///   Case 6 — DELETE list removes it from the user's collection.
/// </summary>
[TestFixture]
public class TestApiFavoritesBC : BaseApiClass
{
    private const string PlaceA = "MOCK_PLACE_101";
    private const string PlaceB = "MOCK_PLACE_102";
    private const string PlaceC = "MOCK_PLACE_103";

    private int _listId;

    [OneTimeSetUp]
    public async Task AuthSetup()
    {
        var ts = Unique();
        await RegisterAndLoginAsync(UniqueUsername(ts), UniqueEmail(ts), "Test1234!");
    }

    [OneTimeTearDown]
    public async Task AuthTeardown() => await DeleteTestUserAsync();

    [SetUp]
    public async Task CreateFreshList() => _listId = await CreateListAsync($"BCTest{Unique()}");


    [Test]
    [Description("BASE — adding 3 restaurants to a list returns all 3 in the detail endpoint")]
    public async Task TestBase_SeveralRestaurants()
    {
        await PostAsync(FavoritesUrl($"/lists/{_listId}/restaurants"), PlacePayload(PlaceA));
        await PostAsync(FavoritesUrl($"/lists/{_listId}/restaurants"), PlacePayload(PlaceB));
        await PostAsync(FavoritesUrl($"/lists/{_listId}/restaurants"), PlacePayload(PlaceC));

        var detail = await GetJsonObjectAsync(FavoritesUrl($"/lists/{_listId}"));
        var restaurants = detail["restaurants"]!.AsArray();

        Assert.That(restaurants.Count, Is.EqualTo(3),
            "After adding 3 restaurants the detail must return exactly 3");
    }


    [Test]
    [Description("Case 2 — a new list has an empty restaurants array")]
    public async Task TestCase2_EmptyList()
    {
        var detail = await GetJsonObjectAsync(FavoritesUrl($"/lists/{_listId}"));
        var restaurants = detail["restaurants"]!.AsArray();

        Assert.That(restaurants, Is.Empty, "A brand-new list must have 0 restaurants");
    }


    [Test]
    [Description("Case 3 — adding 1 restaurant returns a restaurants array of size 1")]
    public async Task TestCase3_OneRestaurant()
    {
        await PostAsync(FavoritesUrl($"/lists/{_listId}/restaurants"), PlacePayload(PlaceA));

        var detail = await GetJsonObjectAsync(FavoritesUrl($"/lists/{_listId}"));
        var restaurants = detail["restaurants"]!.AsArray();

        Assert.That(restaurants.Count, Is.EqualTo(1), "After adding 1 restaurant the detail must return exactly 1");
        Assert.That(restaurants[0]!["place_id"]!.GetValue<string>(), Is.EqualTo(PlaceA),
            "The place_id must match the added restaurant");
    }


    [Test]
    [Description("Case 4 — GET /api/v1/favorites/lists returns a non-empty array with the created list")]
    public async Task TestCase4_GetLists()
    {
        var lists = await GetJsonArrayAsync(FavoritesUrl("/lists"));

        Assert.That(lists, Is.Not.Empty, "The lists array must not be empty after creating a list");
        var found = lists.Any(el => el!["id"]!.GetValue<int>() == _listId);
        Assert.That(found, Is.True, $"The created list id={_listId} must appear in GET /api/v1/favorites/lists");
    }


    [Test]
    [Description("Case 5 — deleting a restaurant removes it from the list detail")]
    public async Task TestCase5_DeleteRestaurant()
    {
        var favIdA = await AddFavoriteAsync(_listId, PlaceA);
        await PostAsync(FavoritesUrl($"/lists/{_listId}/restaurants"), PlacePayload(PlaceB));

        var deleteStatus = await DeleteAsync(FavoritesUrl($"/lists/{_listId}/restaurants/{favIdA}"));
        Assert.That(deleteStatus, Is.EqualTo(204), "DELETE favorite must return HTTP 204");

        var restaurants = (await GetJsonObjectAsync(FavoritesUrl($"/lists/{_listId}")))["restaurants"]!.AsArray();

        Assert.That(ContainsByField(restaurants, "place_id", PlaceA), Is.False,
            "Deleted restaurant (PLACE_A) must not appear in list detail");
        Assert.That(ContainsByField(restaurants, "place_id", PlaceB), Is.True,
            "Non-deleted restaurant (PLACE_B) must still appear");
    }


    [Test]
    [Description("Case 6 — deleting a list removes it from GET /api/v1/favorites/lists")]
    public async Task TestCase6_DeleteList()
    {
        var status = await DeleteAsync(FavoritesUrl($"/lists/{_listId}"));
        Assert.That(status, Is.EqualTo(204), "DELETE list must return HTTP 204");

        var lists = await GetJsonArrayAsync(FavoritesUrl("/lists"));
        var stillPresent = lists.Any(el => el!["id"]!.GetValue<int>() == _listId);
        Assert.That(stillPresent, Is.False, "Deleted list must not appear in GET /api/v1/favorites/lists");

        // Prevent the next [SetUp]-created list from being confused with this deleted one
        _listId = -1;
    }
}
