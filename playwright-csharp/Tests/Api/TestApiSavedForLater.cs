using System.Text.Json.Nodes;
using DevorApp.E2ETests.Common;
using NUnit.Framework;

namespace DevorApp.E2ETests.Tests.Api;

/// <summary>
///
/// Validates the save-for-later endpoints:
///   POST   /api/v1/saved-for-later              — add restaurant (HTTP 201)
///   GET    /api/v1/saved-for-later              — list saved entries (HTTP 200)
///   DELETE /api/v1/saved-for-later/{entry_id}   — remove entry (HTTP 204)
///
/// Each test uses a unique fake place_id to avoid state interference
/// between tests in the same class.
/// </summary>
[TestFixture]
public class TestApiSavedForLater : BaseApiClass
{
    [OneTimeSetUp]
    public async Task AuthSetup()
    {
        var ts = Unique();
        await RegisterAndLoginAsync(UniqueUsername(ts), UniqueEmail(ts), "Test1234!");
    }

    [OneTimeTearDown]
    public async Task AuthTeardown() => await DeleteTestUserAsync();

    [Test]
    [Description("POST /api/v1/saved-for-later returns HTTP 201 with id, place_id and already_saved false")]
    public async Task TestAddToSaved()
    {
        var placeId = $"test_place_{Unique()}";

        var status = await PostStatusAsync(SavedForLaterUrl(""), PlacePayload(placeId));
        Assert.That(status, Is.EqualTo(201), "Adding to saved-for-later must return HTTP 201");

        var entry = await PostJsonObjectAsync(SavedForLaterUrl(""), PlacePayload(placeId));
        Assert.That(entry["id"]!.GetValue<int>(), Is.GreaterThan(0), "entry id must be positive");
        Assert.That(entry["place_id"]!.GetValue<string>(), Is.EqualTo(placeId), "place_id must match");
    }

    [Test]
    [Description("POST /api/v1/saved-for-later twice for the same place returns already_saved true on second call")]
    public async Task TestAddSameRestaurantTwice()
    {
        var placeId = $"test_place_{Unique()}";

        var first = await PostJsonObjectAsync(SavedForLaterUrl(""), PlacePayload(placeId));
        Assert.That(first["already_saved"]!.GetValue<bool>(), Is.False, "First add must have already_saved false");

        var second = await PostJsonObjectAsync(SavedForLaterUrl(""), PlacePayload(placeId));
        Assert.That(second["already_saved"]!.GetValue<bool>(), Is.True,
            "Second add of same place must have already_saved true");
    }

    [Test]
    [Description("DELETE /api/v1/saved-for-later/{entry_id} returns HTTP 204")]
    public async Task TestDeleteFromSaved()
    {
        var entryId = await AddSavedForLaterAsync($"test_place_{Unique()}");

        var status = await DeleteAsync(SavedForLaterUrl($"/{entryId}"));
        Assert.That(status, Is.EqualTo(204), "DELETE saved-for-later entry must return HTTP 204");
    }

    [Test]
    [Description("GET /api/v1/saved-for-later returns HTTP 200 with a paginated envelope")]
    public async Task TestGetSaved()
    {
        var status = await GetStatusAsync(SavedForLaterUrl(""));
        Assert.That(status, Is.EqualTo(200), "GET saved-for-later must return HTTP 200");

        var page = await GetJsonObjectAsync(SavedForLaterUrl(""));
        Assert.That(page["items"], Is.InstanceOf<JsonArray>(), "Response must be a paginated envelope with an items array");
    }
}
