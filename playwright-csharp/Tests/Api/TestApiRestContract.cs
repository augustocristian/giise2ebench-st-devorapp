using System.Text.Json.Nodes;
using DevorApp.E2ETests.Common;
using NUnit.Framework;

namespace DevorApp.E2ETests.Tests.Api;

/// <summary>
/// API tests for the REST contract under /api/v1: Location headers, 409/422
/// status codes, idempotent rating upsert, paginated envelopes, nested
/// favorites and idempotent likes.
/// </summary>
[TestFixture]
public class TestApiRestContract : BaseApiClass
{
    private const string Password = "Test1234!";
    private const string PlaceA = "MOCK_PLACE_101";

    [OneTimeSetUp]
    public async Task AuthSetup()
    {
        var ts = Unique();
        await RegisterAndLoginAsync(UniqueUsername(ts), UniqueEmail(ts), Password);
    }

    [OneTimeTearDown]
    public async Task AuthTeardown() => await DeleteTestUserAsync();


    [Test]
    [Description("POST /favorites/lists returns 201 with a Location header pointing to the new list")]
    public async Task TestCreateListLocation()
    {
        var result = await SendAsync(HttpMethod.Post, FavoritesUrl("/lists"), ListPayload($"Loc{Unique()}"));
        var id = result.Json()["id"]!.GetValue<int>();

        Assert.That(result.Status, Is.EqualTo(201), "Creating a list must return HTTP 201");
        Assert.That(result.Location, Does.EndWith($"/api/v1/favorites/lists/{id}"), "Location must address the new list");
    }

    [Test]
    [Description("POST /favorites/lists with an existing name returns 409; with an empty name returns 422")]
    public async Task TestCreateListConflictAndInvalid()
    {
        var name = $"Dup{Unique()}";
        await CreateListAsync(name);

        var duplicate = await SendAsync(HttpMethod.Post, FavoritesUrl("/lists"), ListPayload(name));
        Assert.That(duplicate.Status, Is.EqualTo(409), "Duplicate list name must return HTTP 409");

        var invalid = await SendAsync(HttpMethod.Post, FavoritesUrl("/lists"), ListPayload(""));
        Assert.That(invalid.Status, Is.EqualTo(422), "Empty list name must return HTTP 422");
    }

    [Test]
    [Description("POST /favorites/lists/{id}/restaurants returns 201 + Location; duplicate returns 409; DELETE under the list returns 204 then 404")]
    public async Task TestFavoriteLifecycleUnderList()
    {
        var listId = await CreateListAsync($"Fav{Unique()}");
        var url = FavoritesUrl($"/lists/{listId}/restaurants");

        var added = await SendAsync(HttpMethod.Post, url, PlacePayload(PlaceA));
        var favId = added.Json()["id"]!.GetValue<int>();
        Assert.That(added.Status, Is.EqualTo(201), "Adding a favorite must return HTTP 201");
        Assert.That(added.Location, Does.EndWith($"/api/v1/favorites/lists/{listId}/restaurants/{favId}"),
            "Location must address the new favorite under its list");

        var again = await SendAsync(HttpMethod.Post, url, PlacePayload(PlaceA));
        Assert.That(again.Status, Is.EqualTo(409), "Adding the same restaurant twice must return HTTP 409");

        Assert.That(await DeleteAsync($"{url}/{favId}"), Is.EqualTo(204), "DELETE favorite must return HTTP 204");
        Assert.That(await DeleteAsync($"{url}/{favId}"), Is.EqualTo(404), "Deleting it again must return HTTP 404");
    }


    [Test]
    [Description("POST /history returns 201 with a Location header and GET /history/{id} returns that entry")]
    public async Task TestHistoryLocationAndGetById()
    {
        var result = await SendAsync(HttpMethod.Post, HistoryUrl(""), PlacePayload(PlaceA));
        var id = result.Json()["id"]!.GetValue<int>();

        Assert.That(result.Status, Is.EqualTo(201), "Adding a history entry must return HTTP 201");
        Assert.That(result.Location, Does.EndWith($"/api/v1/history/{id}"), "Location must address the new entry");

        var entry = await SendAsync(HttpMethod.Get, HistoryUrl($"/{id}"));
        Assert.That(entry.Status, Is.EqualTo(200), "GET /history/{id} must return HTTP 200");
        Assert.That(entry.Json()["id"]!.GetValue<int>(), Is.EqualTo(id), "The returned entry must match the id");
    }

    [Test]
    [Description("GET /history/{id} with an unknown id returns HTTP 404")]
    public async Task TestHistoryUnknownId()
    {
        var status = await GetStatusAsync(HistoryUrl("/999999999"));
        Assert.That(status, Is.EqualTo(404), "Unknown history entry must return HTTP 404");
    }

    [Test]
    [Description("GET /history returns the {items,total,limit,offset} envelope and honors limit/offset")]
    public async Task TestHistoryPagination()
    {
        await AddHistoryAsync(PlaceA);
        await AddHistoryAsync("MOCK_PLACE_102");

        var page = await GetJsonObjectAsync(HistoryUrl("?limit=1&offset=0"));
        Assert.That(page["items"]!.AsArray().Count, Is.EqualTo(1), "limit=1 must return one item");
        Assert.That(page["limit"]!.GetValue<int>(), Is.EqualTo(1), "limit must be echoed");
        Assert.That(page["offset"]!.GetValue<int>(), Is.EqualTo(0), "offset must be echoed");
        Assert.That(page["total"]!.GetValue<int>(), Is.GreaterThanOrEqualTo(2), "total counts all entries");

        var next = await GetJsonObjectAsync(HistoryUrl("?limit=1&offset=1"));
        Assert.That(next["offset"]!.GetValue<int>(), Is.EqualTo(1), "offset must be echoed");
        Assert.That(next["items"]!.AsArray().Count, Is.EqualTo(1), "second page must contain one item");
    }

    [Test]
    [Description("GET /history with limit out of range returns HTTP 422")]
    public async Task TestHistoryLimitOutOfRange()
    {
        Assert.That(await GetStatusAsync(HistoryUrl("?limit=0")), Is.EqualTo(422), "limit=0 must return HTTP 422");
        Assert.That(await GetStatusAsync(HistoryUrl("?limit=101")), Is.EqualTo(422), "limit=101 must return HTTP 422");
    }

    [Test]
    [Description("GET /history/popular returns HTTP 200 with a plain JSON array")]
    public async Task TestHistoryPopularIsArray()
    {
        var result = await SendAsync(HttpMethod.Get, HistoryUrl("/popular?limit=3"));
        Assert.That(result.Status, Is.EqualTo(200), "GET /history/popular must return HTTP 200");
        Assert.That(JsonNode.Parse(result.Body), Is.InstanceOf<JsonArray>(), "Popular must be a plain array");
    }


    [Test]
    [Description("POST /saved-for-later twice: first 201 + Location, second 200 with already_saved true and no Location")]
    public async Task TestSavedForLaterDuplicate()
    {
        var placeId = $"test_place_{Unique()}";

        var first = await SendAsync(HttpMethod.Post, SavedForLaterUrl(""), PlacePayload(placeId));
        var id = first.Json()["id"]!.GetValue<int>();
        Assert.That(first.Status, Is.EqualTo(201), "First save must return HTTP 201");
        Assert.That(first.Location, Does.EndWith($"/api/v1/saved-for-later/{id}"), "Location must address the entry");

        var second = await SendAsync(HttpMethod.Post, SavedForLaterUrl(""), PlacePayload(placeId));
        Assert.That(second.Status, Is.EqualTo(200), "Saving again must return HTTP 200");
        Assert.That(second.Json()["already_saved"]!.GetValue<bool>(), Is.True, "already_saved must be true");
        Assert.That(second.Location, Is.Null, "A repeated save must not return a Location header");
    }


    [Test]
    [Description("PUT /restaurants/{id}/rating returns 201 + Location when created, 200 when replaced; GET returns the own rating")]
    public async Task TestRatingUpsert()
    {
        var placeId = $"bc_put_{Unique()}";

        var created = await PutRatingAsync(placeId, 4, 4, 4, 4, "first");
        Assert.That(created.Status, Is.EqualTo(201), "First PUT must return HTTP 201");
        Assert.That(created.Location, Does.EndWith($"/api/v1/restaurants/{placeId}/rating"), "Location must address the rating");

        var replaced = await PutRatingAsync(placeId, 2, 2, 2, 2, "second");
        Assert.That(replaced.Status, Is.EqualTo(200), "Second PUT must return HTTP 200");

        var own = await GetJsonObjectAsync(RestaurantsUrl($"/{placeId}/rating"));
        Assert.That(own["quality"]!.GetValue<int>(), Is.EqualTo(2), "GET must return the replaced rating");
        Assert.That(own["comment"]!.GetValue<string>(), Is.EqualTo("second"), "comment must be the replaced one");
    }

    [Test]
    [Description("GET /restaurants/{id}/ratings returns the paginated envelope")]
    public async Task TestRestaurantRatingsEnvelope()
    {
        var placeId = $"bc_env_{Unique()}";
        await PutRatingAsync(placeId, 5, 5, 5, 5, "envelope");

        var page = await GetJsonObjectAsync(RestaurantsUrl($"/{placeId}/ratings"));
        Assert.That(page["items"], Is.InstanceOf<JsonArray>(), "items must be an array");
        Assert.That(page["total"]!.GetValue<int>(), Is.EqualTo(1), "total must be 1");
        Assert.That(page.ContainsKey("limit") && page.ContainsKey("offset"), Is.True, "limit and offset must be present");
    }

    [Test]
    [Description("POST/DELETE /ratings/{id}/likes by another user are idempotent (200/200, 204/204)")]
    public async Task TestLikesIdempotent()
    {
        var placeId = $"bc_like_{Unique()}";
        var ratingId = (await PutRatingAsync(placeId, 5, 5, 5, 5, "likeable")).Json()["id"]!.GetValue<int>();

        var ts = Unique() + 1;
        var email = UniqueEmail(ts);
        using var other = new HttpClient();
        await other.PostAsync(AuthUrl("/users"), Body(RegisterPayload(UniqueUsername(ts), email, Password, "Other", "User", "")));
        await other.PostAsync(AuthUrl("/sessions"), Body(LoginPayload(email, Password)));
        try
        {
            var url = RatingsUrl($"/{ratingId}/likes");
            Assert.That((int)(await other.PostAsync(url, null)).StatusCode, Is.EqualTo(200), "First like must return 200");
            var second = await other.PostAsync(url, null);
            Assert.That((int)second.StatusCode, Is.EqualTo(200), "Repeated like must return 200");
            var body = JsonNode.Parse(await second.Content.ReadAsStringAsync())!.AsObject();
            Assert.That(body["likes"]!.GetValue<int>(), Is.EqualTo(1), "Repeated like must not add a second like");

            Assert.That((int)(await other.DeleteAsync(url)).StatusCode, Is.EqualTo(204), "Unlike must return 204");
            Assert.That((int)(await other.DeleteAsync(url)).StatusCode, Is.EqualTo(204), "Repeated unlike must return 204");
        }
        finally
        {
            await other.DeleteAsync(AuthUrl($"/profile?password={Uri.EscapeDataString(Password)}"));
        }
    }


    [Test]
    [Description("POST /users with a duplicate username returns 409")]
    public async Task TestRegisterDuplicateUsername()
    {
        var ts = Unique() + 2;
        var username = UniqueUsername(ts);
        var first = await SendAsync(HttpMethod.Post, AuthUrl("/users"),
            RegisterPayload(username, UniqueEmail(ts), Password, "Ana", "García", ""));
        Assert.That(first.Status, Is.EqualTo(201), "First registration must return HTTP 201");

        var second = await SendAsync(HttpMethod.Post, AuthUrl("/users"),
            RegisterPayload(username, UniqueEmail(ts + 1), Password, "Ana", "García", ""));
        Assert.That(second.Status, Is.EqualTo(409), "Duplicate username must return HTTP 409");

        // Clean up the extra account
        using var cleanup = new HttpClient();
        await cleanup.PostAsync(AuthUrl("/sessions"), Body(LoginPayload(UniqueEmail(ts), Password)));
        await cleanup.DeleteAsync(AuthUrl($"/profile?password={Uri.EscapeDataString(Password)}"));
    }

    [Test]
    [Description("POST /users with an invalid email or a weak password returns 422")]
    public async Task TestRegisterValidationFailures()
    {
        var ts = Unique() + 3;
        var badEmail = await SendAsync(HttpMethod.Post, AuthUrl("/users"),
            RegisterPayload(UniqueUsername(ts), "not-an-email", Password, "Ana", "García", ""));
        Assert.That(badEmail.Status, Is.EqualTo(422), "Invalid email format must return HTTP 422");

        var weak = await SendAsync(HttpMethod.Post, AuthUrl("/users"),
            RegisterPayload(UniqueUsername(ts), UniqueEmail(ts), "weak", "Ana", "García", ""));
        Assert.That(weak.Status, Is.EqualTo(422), "Weak password must return HTTP 422");
    }

    private static StringContent Body(JsonNode payload) =>
        new(payload.ToJsonString(), System.Text.Encoding.UTF8, "application/json");
}
