using System.Net.Http.Headers;
using System.Text;
using System.Text.Json.Nodes;
using NUnit.Framework;

namespace DevorApp.E2ETests.Common;

/// <summary>
/// Base class for DevorApp API tests. Provides HTTP request helpers, JSON
/// payload builders, auth lifecycle (RegisterAndLoginAsync /
/// DeleteTestUserAsync), and fixture creation methods. Port of
/// epigijon.devorapp.e2e.functional.common.BaseApiClass.
///
/// <see cref="HttpClient"/> plays the role of the Java suite's
/// CloseableHttpClient + BasicCookieStore: HttpClientHandler's cookie
/// container (enabled by default) automatically captures the JWT
/// access_token cookie issued on login and resends it on every subsequent
/// request made through the same client.
///
/// NUnit note: unlike JUnit5, which creates a new test-class instance per
/// [Test] method by default, NUnit instantiates a TestFixture class ONCE
/// and reuses that same instance across every [Test] method in the fixture.
/// That means the instance state below (Client, SutUrl, TestEmail, ...) is
/// safely shared across a class's tests without needing static fields or
/// any of the reflection-based "who's my calling subclass" workaround the
/// Java version doesn't need either (its fields genuinely are static there)
/// but the Python port had to build for itself.
/// </summary>
public abstract class BaseApiClass
{
    /// <summary>A stable Google Places ID used as a test restaurant in all test classes.</summary>
    protected const string TestPlaceId = "ChIJN1t_tDeuEmsRUsoyG83frY4";

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

    protected string AuthUrl(string path) => $"{SutUrl}/api{path}";
    protected string FavoritosUrl(string path) => $"{SutUrl}/api/favoritos{path}";
    protected string HistorialUrl(string path) => $"{SutUrl}/api/historial{path}";
    protected string MasTardeUrl(string path) => $"{SutUrl}/api/mas-tarde{path}";
    protected string ValoracionesUrl(string path) => $"{SutUrl}/api/valoraciones{path}";
    protected string RecommendationsUrl(string path) => $"{SutUrl}/api/recommendations{path}";

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

    /// <summary>Registers a new test user via POST /api/register, then logs
    /// in via POST /api/login. The JWT cookie is captured automatically by
    /// the shared HttpClient.</summary>
    protected async Task RegisterAndLoginAsync(string username, string email, string password)
    {
        TestUsername = username;
        TestEmail = email;
        TestPassword = password;

        await PostAsync(AuthUrl("/register"), RegisterPayload(username, email, password, "Test", "User", ""));
        TestContext.Progress.WriteLine($"Registered test user: {username} / {email}");

        await PostAsync(AuthUrl("/login"), LoginPayload(email, password));
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
        string nombre, string apellidos, string ubicacion) => new()
    {
        ["username"] = username,
        ["email"] = email,
        ["password"] = password,
        ["nombre"] = nombre,
        ["apellidos"] = apellidos,
        ["ubicacion"] = ubicacion,
    };

    protected static JsonObject LoginPayload(string identifier, string password) => new()
    {
        ["identifier"] = identifier,
        ["password"] = password,
    };

    protected static JsonObject ListaPayload(string nombre, string icono = "Heart") => new()
    {
        ["nombre"] = nombre,
        ["icono"] = icono,
    };

    protected static JsonObject FavoritoPayload(string placeId) => new() { ["place_id"] = placeId };
    protected static JsonObject MasTardePayload(string placeId) => new() { ["place_id"] = placeId };
    protected static JsonObject HistorialPayload(string placeId) => new() { ["place_id"] = placeId };

    protected static JsonObject ValoracionPayload(string placeId, int calidad, int precio,
        int higiene, int trato, string comentario) => new()
    {
        ["place_id"] = placeId,
        ["calidad"] = calidad,
        ["precio"] = precio,
        ["higiene"] = higiene,
        ["trato"] = trato,
        ["comentario"] = comentario,
    };

    protected static JsonObject ProfileUpdatePayload(string nombre, string apellidos, string ubicacion, string password) => new()
    {
        ["nombre"] = nombre,
        ["apellidos"] = apellidos,
        ["ubicacion"] = ubicacion,
        ["password"] = password,
    };

    protected static JsonObject PopularesPayload(int limit) => new() { ["limit"] = limit };

    /// <summary>Builds the request body for POST /api/recommendations/search.</summary>
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
    protected async Task<int> CreateListaAsync(string nombre)
    {
        var response = await PostJsonObjectAsync(FavoritosUrl("/listas"), ListaPayload(nombre));
        return response["id"]!.GetValue<int>();
    }

    /// <summary>Adds a restaurant to a list and returns the favorito id.</summary>
    protected async Task<int> AddFavoritoAsync(int listaId, string placeId)
    {
        var response = await PostJsonObjectAsync(FavoritosUrl($"/listas/{listaId}"), FavoritoPayload(placeId));
        return response["id"]!.GetValue<int>();
    }

    /// <summary>Adds a restaurant to historial and returns the entry id.</summary>
    protected async Task<int> AddHistorialAsync(string placeId)
    {
        var response = await PostJsonObjectAsync(HistorialUrl(""), HistorialPayload(placeId));
        return response["id"]!.GetValue<int>();
    }

    /// <summary>Adds a restaurant to mas-tarde and returns the entry id.</summary>
    protected async Task<int> AddMasTardeAsync(string placeId)
    {
        var response = await PostJsonObjectAsync(MasTardeUrl(""), MasTardePayload(placeId));
        return response["id"]!.GetValue<int>();
    }

    /// <summary>Creates a valoracion and returns the full response object.</summary>
    protected async Task<JsonObject> CreateValoracionAsync(string placeId, int calidad, int precio,
        int higiene, int trato, string comentario) =>
        await PostJsonObjectAsync(ValoracionesUrl(""), ValoracionPayload(placeId, calidad, precio, higiene, trato, comentario));

    /// <summary>Returns the id of the first lista named "Favoritos" in the
    /// user's lista collection, or -1 if not found.</summary>
    protected async Task<int> GetDefaultListaIdAsync()
    {
        var listas = await GetJsonArrayAsync(FavoritosUrl("/listas"));
        foreach (var node in listas)
        {
            if (node is JsonObject obj && obj["nombre"]?.GetValue<string>() == "Favoritos")
                return obj["id"]!.GetValue<int>();
        }
        return -1;
    }
}
