using System.Net.Http.Headers;
using System.Text;
using System.Text.Json.Nodes;
using NUnit.Framework;

namespace DevorApp.E2ETests.Common;

/// <summary>
/// Base class for DevorApp API tests: HTTP helpers, JSON payload builders,
/// auth lifecycle (RegisterAndLoginAsync / DeleteTestUserAsync) and fixture
/// creation methods. Port of the selenium-java BaseApiClass.
///
/// The shared <see cref="HttpClient"/> keeps the JWT cookie issued on login
/// (its cookie container is on by default). NUnit reuses one fixture
/// instance for all its tests, so the instance state below is shared.
/// </summary>
public abstract class BaseApiClass
{
    /// <summary>A stable Google Places ID used as a test restaurant in all test classes.</summary>
    protected const string TestPlaceId = "MOCK_PLACE_101";

    protected string SutUrl { get; private set; } = string.Empty;
    protected HttpClient Client { get; private set; } = null!;

    protected string? TestUsername { get; private set; }
    protected string? TestEmail { get; private set; }
    protected string? TestPassword { get; private set; }

    [OneTimeSetUp]
    public void SetupAll()
    {
        TestContext.Progress.WriteLine("Starting API test global setup");
        SutUrl = DevorAppConfig.GetApiBaseUrl();
        TestContext.Progress.WriteLine($"API base URL: {SutUrl}");
        Client = new HttpClient();
        Client.DefaultRequestHeaders.Accept.Add(new MediaTypeWithQualityHeaderValue("application/json"));
    }

    [OneTimeTearDown]
    public void TearDownAll()
    {
        Client.Dispose();
        TestContext.Progress.WriteLine("Shared HTTP client closed");
    }

    // ── URL builders ─────────────────────────────────────────────────────────

    protected string AuthUrl(string path) => $"{SutUrl}/api/v1{path}";
    protected string FavoritesUrl(string path) => $"{SutUrl}/api/v1/favorites{path}";
    protected string HistoryUrl(string path) => $"{SutUrl}/api/v1/history{path}";
    protected string SavedForLaterUrl(string path) => $"{SutUrl}/api/v1/saved-for-later{path}";
    protected string RatingsUrl(string path) => $"{SutUrl}/api/v1/ratings{path}";
    protected string RestaurantsUrl(string path) => $"{SutUrl}/api/v1/restaurants{path}";
    protected string RecommendationsUrl(string path) => $"{SutUrl}/api/v1/recommendations{path}";

    // ── HTTP verbs ───────────────────────────────────────────────────────────

    private static StringContent JsonBody(JsonNode payload) =>
        new(payload.ToJsonString(), Encoding.UTF8, "application/json");

    protected async Task<string> GetAsync(string url)
    {
        using var response = await Client.GetAsync(url);
        var body = await response.Content.ReadAsStringAsync();
        TestContext.Progress.WriteLine($"GET {url} -> {(int)response.StatusCode}");
        return body;
    }

    protected async Task<int> GetStatusAsync(string url)
    {
        using var response = await Client.GetAsync(url);
        return (int)response.StatusCode;
    }

    protected async Task<string> PostAsync(string url, JsonNode payload)
    {
        using var response = await Client.PostAsync(url, JsonBody(payload));
        var body = await response.Content.ReadAsStringAsync();
        TestContext.Progress.WriteLine($"POST {url} -> {(int)response.StatusCode}");
        return body;
    }

    protected async Task<int> PostStatusAsync(string url, JsonNode payload)
    {
        using var response = await Client.PostAsync(url, JsonBody(payload));
        return (int)response.StatusCode;
    }

    protected async Task<int> PatchAsync(string url, JsonNode payload)
    {
        using var request = new HttpRequestMessage(HttpMethod.Patch, url) { Content = JsonBody(payload) };
        using var response = await Client.SendAsync(request);
        return (int)response.StatusCode;
    }

    /// <summary>Sends a request with an optional JSON body and returns status, body and Location header.</summary>
    protected async Task<ApiResult> SendAsync(HttpMethod method, string url, JsonNode? payload = null)
    {
        using var request = new HttpRequestMessage(method, url);
        if (payload is not null) request.Content = JsonBody(payload);
        using var response = await Client.SendAsync(request);
        var body = await response.Content.ReadAsStringAsync();
        TestContext.Progress.WriteLine($"{method} {url} -> {(int)response.StatusCode}");
        return new ApiResult((int)response.StatusCode, body, response.Headers.Location?.ToString());
    }

    protected sealed record ApiResult(int Status, string Body, string? Location)
    {
        public JsonObject Json() => JsonNode.Parse(Body)!.AsObject();
    }

    protected async Task<int> DeleteAsync(string url)
    {
        using var response = await Client.DeleteAsync(url);
        return (int)response.StatusCode;
    }

    protected async Task<int> DeleteWithQueryAsync(string url, string queryParam, string value)
    {
        var separator = url.Contains('?') ? "&" : "?";
        using var response = await Client.DeleteAsync($"{url}{separator}{queryParam}={Uri.EscapeDataString(value)}");
        return (int)response.StatusCode;
    }

    protected async Task<JsonNode> GetJsonAsync(string url)
    {
        var body = await GetAsync(url);
        return JsonNode.Parse(body) ?? throw new InvalidOperationException($"Empty JSON body from {url}");
    }

    protected async Task<JsonObject> GetJsonObjectAsync(string url) => (await GetJsonAsync(url)).AsObject();

    protected async Task<JsonArray> GetJsonArrayAsync(string url) => (await GetJsonAsync(url)).AsArray();

    protected async Task<JsonObject> PostJsonObjectAsync(string url, JsonNode payload)
    {
        var body = await PostAsync(url, payload);
        return JsonNode.Parse(body)!.AsObject();
    }

    protected static bool ContainsByField(JsonArray array, string fieldName, string expected) =>
        array.Any(el => el is JsonObject obj && obj[fieldName]?.GetValue<string>() == expected);

    // ── Uniqueness helpers ───────────────────────────────────────────────────

    protected static long Unique() => DateTimeOffset.UtcNow.ToUnixTimeMilliseconds();

    protected static string UniqueEmail(long ts) => $"testuser{ts}@devorapp.test";

    protected static string UniqueUsername(long ts)
    {
        var raw = $"tst{ts}";
        return raw.Length > 30 ? raw[^30..] : raw;
    }

    // ── Auth lifecycle ───────────────────────────────────────────────────────

    /// <summary>Registers a new test user via POST /api/v1/users, then logs
    /// in via POST /api/v1/sessions. The JWT cookie is captured automatically by
    /// the shared HttpClient.</summary>
    protected async Task RegisterAndLoginAsync(string username, string email, string password)
    {
        TestUsername = username;
        TestEmail = email;
        TestPassword = password;

        await PostAsync(AuthUrl("/users"), RegisterPayload(username, email, password, "Test", "User", ""));
        TestContext.Progress.WriteLine($"Registered test user: {username} / {email}");

        await PostAsync(AuthUrl("/sessions"), LoginPayload(email, password));
        TestContext.Progress.WriteLine("Logged in test user");
    }

    /// <summary>Deletes the test user account. Call from [OneTimeTearDown].</summary>
    protected async Task DeleteTestUserAsync()
    {
        if (TestEmail is null || TestPassword is null) return;
        try
        {
            var status = await DeleteWithQueryAsync(AuthUrl("/profile"), "password", TestPassword);
            TestContext.Progress.WriteLine($"Deleted test user {TestEmail} -> HTTP {status}");
        }
        catch (Exception e)
        {
            TestContext.Progress.WriteLine($"Could not delete test user {TestEmail}: {e.Message}");
        }
    }

    // ── Payload builders ─────────────────────────────────────────────────────

    protected static JsonObject RegisterPayload(string username, string email, string password,
        string firstName, string lastName, string location) => new()
    {
        ["username"] = username,
        ["email"] = email,
        ["password"] = password,
        ["first_name"] = firstName,
        ["last_name"] = lastName,
        ["location"] = location,
    };

    protected static JsonObject LoginPayload(string identifier, string password) => new()
    {
        ["identifier"] = identifier,
        ["password"] = password,
    };

    protected static JsonObject ListPayload(string name, string icon = "Heart") => new()
    {
        ["name"] = name,
        ["icon"] = icon,
    };

    protected static JsonObject PlacePayload(string placeId) => new() { ["place_id"] = placeId };

    protected static JsonObject RatingPayload(int quality, int price,
        int hygiene, int service, string comment) => new()
    {
        ["quality"] = quality,
        ["price"] = price,
        ["hygiene"] = hygiene,
        ["service"] = service,
        ["comment"] = comment,
    };

    protected static JsonObject ProfileUpdatePayload(string firstName, string lastName, string location, string password) => new()
    {
        ["first_name"] = firstName,
        ["last_name"] = lastName,
        ["location"] = location,
        ["password"] = password,
    };

    /// <summary>Builds the request body for POST /api/v1/recommendations/search.</summary>
    protected static JsonObject SearchPayload(IEnumerable<string> categories, IEnumerable<string> prices,
        bool includeUnconfirmedPrice, string location, int maxResults, bool? openNow = null)
    {
        var payload = new JsonObject
        {
            ["categories"] = new JsonArray(categories.Select(c => (JsonNode)c).ToArray()),
            ["prices"] = new JsonArray(prices.Select(p => (JsonNode)p).ToArray()),
            ["include_unconfirmed_price"] = includeUnconfirmedPrice,
            ["location"] = location,
            ["sort_by"] = "rating",
            ["max_results"] = maxResults,
        };
        if (openNow is not null) payload["open_now"] = openNow.Value;
        return payload;
    }

    // ── CRUD helpers ─────────────────────────────────────────────────────────

    /// <summary>Creates a favorite list and returns its assigned id.</summary>
    protected async Task<int> CreateListAsync(string name)
    {
        var response = await PostJsonObjectAsync(FavoritesUrl("/lists"), ListPayload(name));
        return response["id"]!.GetValue<int>();
    }

    /// <summary>Adds a restaurant to a list and returns the favorite id.</summary>
    protected async Task<int> AddFavoriteAsync(int listId, string placeId)
    {
        var response = await PostJsonObjectAsync(FavoritesUrl($"/lists/{listId}/restaurants"), PlacePayload(placeId));
        return response["id"]!.GetValue<int>();
    }

    /// <summary>Adds a restaurant to the history and returns the entry id.</summary>
    protected async Task<int> AddHistoryAsync(string placeId)
    {
        var response = await PostJsonObjectAsync(HistoryUrl(""), PlacePayload(placeId));
        return response["id"]!.GetValue<int>();
    }

    /// <summary>Adds a restaurant to saved-for-later and returns the entry id.</summary>
    protected async Task<int> AddSavedForLaterAsync(string placeId)
    {
        var response = await PostJsonObjectAsync(SavedForLaterUrl(""), PlacePayload(placeId));
        return response["id"]!.GetValue<int>();
    }

    /// <summary>Creates or replaces the caller's rating via PUT and returns the full result.</summary>
    protected async Task<ApiResult> PutRatingAsync(string placeId, int quality, int price,
        int hygiene, int service, string comment) =>
        await SendAsync(HttpMethod.Put, RestaurantsUrl($"/{placeId}/rating"),
            RatingPayload(quality, price, hygiene, service, comment));

    /// <summary>Creates a rating and returns the response object.</summary>
    protected async Task<JsonObject> CreateRatingAsync(string placeId, int quality, int price,
        int hygiene, int service, string comment) =>
        (await PutRatingAsync(placeId, quality, price, hygiene, service, comment)).Json();
}
