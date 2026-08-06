using DevorApp.E2ETests.Common;
using NUnit.Framework;

namespace DevorApp.E2ETests.Tests.Api;

/// <summary>
/// Port of epigijon.devorapp.e2e.functional.tests.api.TestApiMasTarde.
///
/// Validates the save-for-later endpoints:
///   POST   /api/mas-tarde              — add restaurant (HTTP 201)
///   GET    /api/mas-tarde              — list saved entries (HTTP 200)
///   DELETE /api/mas-tarde/{entry_id}   — remove entry (HTTP 204)
///
/// Each test uses a unique fake place_id to avoid state interference
/// between tests in the same class.
/// </summary>
[TestFixture]
public class TestApiMasTarde : BaseApiClass
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
    [Description("POST /api/mas-tarde returns HTTP 201 with id, place_id and already_saved false")]
    public async Task TestAddToMasTarde()
    {
        var placeId = $"test_place_{Unique()}";

        var status = await PostStatusAsync(MasTardeUrl(""), MasTardePayload(placeId));
        Assert.That(status, Is.EqualTo(201), "Adding to mas-tarde must return HTTP 201");

        var entry = await PostJsonObjectAsync(MasTardeUrl(""), MasTardePayload(placeId));
        Assert.That(entry["id"]!.GetValue<int>(), Is.GreaterThan(0), "entry id must be positive");
        Assert.That(entry["place_id"]!.GetValue<string>(), Is.EqualTo(placeId), "place_id must match");
    }

    [Test]
    [Description("POST /api/mas-tarde twice for the same place returns already_saved true on second call")]
    public async Task TestAddSameRestaurantTwice()
    {
        var placeId = $"test_place_{Unique()}";

        var first = await PostJsonObjectAsync(MasTardeUrl(""), MasTardePayload(placeId));
        Assert.That(first["already_saved"]!.GetValue<bool>(), Is.False, "First add must have already_saved false");

        var second = await PostJsonObjectAsync(MasTardeUrl(""), MasTardePayload(placeId));
        Assert.That(second["already_saved"]!.GetValue<bool>(), Is.True,
            "Second add of same place must have already_saved true");
    }

    [Test]
    [Description("DELETE /api/mas-tarde/{entry_id} returns HTTP 204")]
    public async Task TestDeleteFromMasTarde()
    {
        var entryId = await AddMasTardeAsync($"test_place_{Unique()}");

        var status = await DeleteAsync(MasTardeUrl($"/{entryId}"));
        Assert.That(status, Is.EqualTo(204), "DELETE mas-tarde entry must return HTTP 204");
    }

    [Test]
    [Description("GET /api/mas-tarde returns HTTP 200 with a JSON array")]
    public async Task TestGetMasTarde()
    {
        var status = await GetStatusAsync(MasTardeUrl(""));
        Assert.That(status, Is.EqualTo(200), "GET mas-tarde must return HTTP 200");

        var entries = await GetJsonArrayAsync(MasTardeUrl(""));
        Assert.That(entries, Is.Not.Null, "Response must be a JSON array");
    }
}
