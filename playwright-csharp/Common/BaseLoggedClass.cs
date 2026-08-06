using System.Text.Json.Nodes;
using Microsoft.Playwright.NUnit;
using NUnit.Framework;

namespace DevorApp.E2ETests.Common;

/// <summary>
/// Base class for all DevorApp browser (Playwright) tests. Port of
/// epigijon.devorapp.e2e.functional.common.BaseLoggedClass.
///
/// Browser/page lifecycle is entirely delegated to
/// <see cref="Microsoft.Playwright.NUnit.PageTest"/>: it launches one
/// Chromium instance per test worker (reused across the whole run) and
/// hands each [Test] method a brand-new <c>Page</c> in its own, fully
/// isolated <c>IBrowserContext</c>. Unlike the Java suite there is no
/// manual clearSession() step (cookies/localStorage/sessionStorage/
/// IndexedDB wipe) anywhere in this port: every test already starts from a
/// pristine, storage-free context, which is exactly what clearSession() was
/// working around Selenium's lack of for.
///
/// This class layers DevorApp's test-user lifecycle on top: SetupTestUserAsync
/// / TeardownTestUserAsync so every subclass creates and deletes a real
/// backend user in a couple of lines, without duplicating HTTP-client
/// boilerplate.
///
/// NUnit note: unlike JUnit5 (one test-class instance per [Test] method by
/// default), NUnit instantiates a TestFixture class ONCE and reuses that
/// SAME instance for every [Test] method in the fixture. That means plain
/// instance fields set in [OneTimeSetUp] (TestEmail/TestUsername/TestPassword
/// below) are already visible to every test in the class — no class-keyed
/// dictionary or per-test re-read is needed here, unlike the Java suite
/// (which works around JUnit5's per-method instantiation with static maps)
/// or the Python port (which needs a Dict[Type, ...] for the same reason).
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
        // Matches the Java suite's Waiter.WAIT_SECONDS = 20 default.
        Page.SetDefaultTimeout(20_000);
    }

    /// <summary>Navigates to /login. Equivalent to the Java suite's
    /// repeated <c>clearSession(); driver.get(sutUrl + "/login");</c> — the
    /// clear step is unnecessary here since every test already runs in a
    /// fresh, isolated browser context.</summary>
    protected async Task GoToLoginAsync() => await Page.GotoAsync($"{SutUrl}/login");

    // ── Test-user helpers ────────────────────────────────────────────────────

    /// <summary>Registers a new test user via POST /api/register and stores
    /// the credentials for later teardown. Call from a subclass
    /// [OneTimeSetUp].</summary>
    protected async Task SetupTestUserAsync(string username, string email, string password)
    {
        TestUsername = username;
        TestEmail = email;
        TestPassword = password;

        var apiBase = Properties.GetValueOrDefault("LOCALHOST_URL", "http://localhost:8000");
        await PostJsonAsync($"{apiBase}/api/register", RegisterPayload(username, email, password));
        TestContext.Progress.WriteLine($"Registered browser test user: {email}");
    }

    /// <summary>Registers a username/email/password created during a test
    /// so it is cleaned up automatically in
    /// <see cref="TeardownTestUserAsync"/>.</summary>
    protected void RegisterEmailForCleanup(string email, string password) =>
        _registeredUsers.Add((email, password));

    /// <summary>Registers a new test user via POST /api/register directly,
    /// without storing it as the fixture's primary test user (avoids
    /// session pollution for other tests).</summary>
    protected async Task RegisterUserApiAsync(string username, string email, string password)
    {
        RegisterEmailForCleanup(email, password);
        var apiBase = Properties.GetValueOrDefault("LOCALHOST_URL", "http://localhost:8000");
        await PostJsonAsync($"{apiBase}/api/register", RegisterPayload(username, email, password));
        TestContext.Progress.WriteLine($"Registered API-only test user: {email}");
    }

    private static JsonObject RegisterPayload(string username, string email, string password) => new()
    {
        ["username"] = username,
        ["email"] = email,
        ["password"] = password,
        ["nombre"] = "UITester",
        ["apellidos"] = "Test",
        ["ubicacion"] = "Gijón",
    };

    /// <summary>Logs in and calls DELETE /api/profile to permanently remove
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
                await PostJsonAsync($"{apiBase}/api/login",
                    new JsonObject { ["identifier"] = email, ["password"] = password });
                await _apiClient.DeleteAsync($"{apiBase}/api/profile?password={Uri.EscapeDataString(password)}");
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
            await PostJsonAsync($"{apiBase}/api/login",
                new JsonObject { ["identifier"] = TestEmail, ["password"] = TestPassword });
            await _apiClient.DeleteAsync($"{apiBase}/api/profile?password={Uri.EscapeDataString(TestPassword)}");
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
        await PostJsonAsync($"{apiBase}/api/login",
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
