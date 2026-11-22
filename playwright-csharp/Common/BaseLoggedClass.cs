using System.Text.Json.Nodes;
using Microsoft.Playwright.NUnit;
using NUnit.Framework;

namespace DevorApp.E2ETests.Common;

/// <summary>
/// Base class for the DevorApp browser tests. Port of the selenium-java BaseLoggedClass.
///
/// <see cref="PageTest"/> launches one Chromium per worker and gives every test a fresh page in its
/// own browser context, so there is no session clearing between tests. This class adds the
/// test-user lifecycle (register via API, delete on teardown). NUnit reuses one fixture instance
/// for all its tests, so the credentials set in [OneTimeSetUp] are visible to every test.
/// </summary>
public abstract class BaseLoggedClass : PageTest
{
    protected static IReadOnlyDictionary<string, string> Properties => DevorAppConfig.Properties;

    protected string SutUrl { get; private set; } = string.Empty;
    private HttpClient _apiClient = null!;
    private readonly List<(string Email, string Password)> _registeredUsers = new();

    protected string? TestUsername { get; private set; }
    protected string? TestEmail { get; private set; }
    protected string? TestPassword { get; private set; }

    [OneTimeSetUp]
    public void LoggedFixtureSetup()
    {
        SutUrl = DevorAppConfig.GetFrontendBaseUrl();
        _apiClient = new HttpClient();
        TestContext.Progress.WriteLine($"Browser base URL: {SutUrl}");
    }

    [OneTimeTearDown]
    public void LoggedFixtureTeardown()
    {
        _apiClient.Dispose();
    }

    [SetUp]
    public void LoggedTestSetup()
    {
        // Same 20 s default as the Selenium suite.
        Page.SetDefaultTimeout(20_000);
    }

    /// <summary>Navigates to /login (each test already starts with clean storage).</summary>
    protected async Task GoToLoginAsync() => await Page.GotoAsync($"{SutUrl}/login");

    // ── Test-user helpers ────────────────────────────────────────────────────

    /// <summary>Registers a new test user via POST /api/v1/users and stores
    /// the credentials for later teardown. Call from a subclass
    /// [OneTimeSetUp].</summary>
    protected async Task SetupTestUserAsync(string username, string email, string password)
    {
        TestUsername = username;
        TestEmail = email;
        TestPassword = password;

        var apiBase = Properties.GetValueOrDefault("LOCALHOST_URL", "http://localhost:8000");
        await PostJsonAsync($"{apiBase}/api/v1/users", RegisterPayload(username, email, password));
        TestContext.Progress.WriteLine($"Registered browser test user: {email}");
    }

    /// <summary>Registers a username/email/password created during a test
    /// so it is cleaned up automatically in
    /// <see cref="TeardownTestUserAsync"/>.</summary>
    protected void RegisterEmailForCleanup(string email, string password) =>
        _registeredUsers.Add((email, password));

    /// <summary>Registers a new test user via POST /api/v1/users directly,
    /// without storing it as the fixture's primary test user (avoids
    /// session pollution for other tests).</summary>
    protected async Task RegisterUserApiAsync(string username, string email, string password)
    {
        RegisterEmailForCleanup(email, password);
        var apiBase = Properties.GetValueOrDefault("LOCALHOST_URL", "http://localhost:8000");
        await PostJsonAsync($"{apiBase}/api/v1/users", RegisterPayload(username, email, password));
        TestContext.Progress.WriteLine($"Registered API-only test user: {email}");
    }

    private static JsonObject RegisterPayload(string username, string email, string password) => new()
    {
        ["username"] = username,
        ["email"] = email,
        ["password"] = password,
        ["first_name"] = "UITester",
        ["last_name"] = "Test",
        ["location"] = "Gijón",
    };

    /// <summary>Logs in and calls DELETE /api/v1/profile to permanently remove
    /// the test user created by <see cref="SetupTestUserAsync"/>, as well
    /// as any extra users registered during the test. Call from a subclass
    /// [OneTimeTearDown].</summary>
    protected async Task TeardownTestUserAsync()
    {
        var apiBase = Properties.GetValueOrDefault("LOCALHOST_URL", "http://localhost:8000");

        foreach (var (email, password) in _registeredUsers)
        {
            try
            {
                await PostJsonAsync($"{apiBase}/api/v1/sessions",
                    new JsonObject { ["identifier"] = email, ["password"] = password });
                await _apiClient.DeleteAsync($"{apiBase}/api/v1/profile?password={Uri.EscapeDataString(password)}");
                TestContext.Progress.WriteLine($"Deleted extra registered test user: {email}");
            }
            catch (Exception e)
            {
                TestContext.Progress.WriteLine($"Could not delete extra registered test user {email}: {e.Message}");
            }
        }
        _registeredUsers.Clear();

        if (TestEmail is null || TestPassword is null) return;
        try
        {
            await PostJsonAsync($"{apiBase}/api/v1/sessions",
                new JsonObject { ["identifier"] = TestEmail, ["password"] = TestPassword });
            await _apiClient.DeleteAsync($"{apiBase}/api/v1/profile?password={Uri.EscapeDataString(TestPassword)}");
            TestContext.Progress.WriteLine($"Deleted browser test user: {TestEmail}");
        }
        catch (Exception e)
        {
            TestContext.Progress.WriteLine($"Could not delete browser test user {TestEmail}: {e.Message}");
        }
    }

    /// <summary>POSTs a JSON body to the given absolute URL using the
    /// shared API client. Already authenticated if
    /// <see cref="SetupTestUserAsync"/> was called. Returns the parsed JSON
    /// response body.</summary>
    protected async Task<JsonObject> ApiPostAsync(string url, JsonNode payload)
    {
        var body = await PostJsonAsync(url, payload);
        return JsonNode.Parse(body)!.AsObject();
    }

    private async Task<string> PostJsonAsync(string url, JsonNode payload)
    {
        using var content = new StringContent(payload.ToJsonString(), System.Text.Encoding.UTF8, "application/json");
        using var response = await _apiClient.PostAsync(url, content);
        return await response.Content.ReadAsStringAsync();
    }

    /// <summary>Logs in the test user (using TestEmail/TestPassword) with
    /// the shared API client so subsequent ApiPostAsync/ApiDeleteAsync
    /// calls carry the JWT session cookie.</summary>
    protected async Task ApiLoginAsync()
    {
        var apiBase = Properties.GetValueOrDefault("LOCALHOST_URL", "http://localhost:8000");
        await PostJsonAsync($"{apiBase}/api/v1/sessions",
            new JsonObject { ["identifier"] = TestEmail, ["password"] = TestPassword });
    }

    /// <summary>DELETEs the given absolute URL using the shared API client.
    /// Returns the HTTP status code.</summary>
    protected async Task<int> ApiDeleteAsync(string url)
    {
        var response = await _apiClient.DeleteAsync(url);
        return (int)response.StatusCode;
    }

    // ── Google Maps Autocomplete mock ───────────────────────────────────────

    /// <summary>Injects a bulletproof Google Maps Autocomplete mock into the window object.</summary>
    protected async Task InjectAutocompleteMockAsync()
    {
        await Page.EvaluateAsync(@"() => {
            const mockAutocompleteClass = class {
              constructor(input, options) {
                window.mockAutocompleteInstance = this;
                this.input = input;
              }
              addListener(event, callback) {
                if (!this.listeners) this.listeners = {};
                if (!this.listeners[event]) this.listeners[event] = [];
                this.listeners[event].push(callback);
                return { remove: () => {} };
              }
              getPlace() {
                return {
                  formatted_address: this.input ? this.input.value : 'Barcelona, España'
                };
              }
              setTypes() {}
              setBounds() {}
              setFields() {}
              setComponentRestrictions() {}
              getBounds() { return {}; }
              getFields() { return []; }
              setOptions() {}
            };
            const mockPlaces = {};
            Object.defineProperty(mockPlaces, 'Autocomplete', { value: mockAutocompleteClass, writable: false, configurable: false });
            const mockMaps = {};
            Object.defineProperty(mockMaps, 'places', { value: mockPlaces, writable: false, configurable: false });
            const mockGoogle = {};
            Object.defineProperty(mockGoogle, 'maps', { value: mockMaps, writable: false, configurable: false });
            Object.defineProperty(window, 'google', { value: mockGoogle, writable: false, configurable: false });
        }");
    }

    /// <summary>Waits for the mock Autocomplete instance to be initialized
    /// and have a 'place_changed' listener, then triggers all its
    /// callbacks.</summary>
    protected async Task TriggerAutocompletePlaceChangedAsync()
    {
        await Page.WaitForFunctionAsync(
            "() => window.mockAutocompleteInstance?.listeners?.['place_changed'] !== undefined");
        await Page.EvaluateAsync(
            "() => window.mockAutocompleteInstance.listeners['place_changed'].forEach((cb) => cb())");
    }
}
