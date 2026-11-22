using System.Text;
using System.Text.Json.Nodes;
using DevorApp.E2ETests.Common;
using NUnit.Framework;

namespace DevorApp.E2ETests.Tests.Api;

/// <summary>
///
/// API Base-Choice tests for the history module.
///
/// Cases covered:
///   BASE   — multiple history entries are returned by GET /api/v1/history.
///   Case 2 — a fresh user has an empty history (0 entries).
///   Case 5 — exactly 1 history entry is returned with correct fields.
///   Case 6 — deleting an entry removes it from the history list.
///   Case 3 — entry has an accessed_at (timestamp) field populated.
/// </summary>
[TestFixture]
public class TestApiHistoryBC : BaseApiClass
{
    private const string PlaceA = "MOCK_PLACE_101";
    private const string PlaceB = "MOCK_PLACE_102";
    private const string PlaceC = "MOCK_PLACE_103";

    [OneTimeSetUp]
    public async Task AuthSetup()
    {
        var ts = Unique();
        await RegisterAndLoginAsync(UniqueUsername(ts), UniqueEmail(ts), "Test1234!");
    }

    [OneTimeTearDown]
    public async Task AuthTeardown() => await DeleteTestUserAsync();


    [Test]
    [Description("BASE — adding 3 history entries returns all 3 via GET /api/v1/history")]
    public async Task TestBase_MultipleEntries()
    {
        await AddHistoryAsync(PlaceA);
        await AddHistoryAsync(PlaceB);
        await AddHistoryAsync(PlaceC);

        var history = (await GetJsonObjectAsync(HistoryUrl("")))["items"]!.AsArray();
        Assert.That(history.Count, Is.GreaterThanOrEqualTo(3),
            "After adding 3 entries history must have at least 3 items (BASE)");
    }


    [Test]
    [Description("Case 2 — fresh user with no history gets an empty array")]
    public async Task TestCase2_EmptyHistory()
    {
        var ts = Unique();
        var email = UniqueEmail(ts);
        var username = UniqueUsername(ts);
        const string password = "Test1234!";

        using var localClient = new HttpClient();

        await localClient.PostAsync(AuthUrl("/users"), JsonBody(RegisterPayload(username, email, password, "Test", "User", "")));
        await localClient.PostAsync(AuthUrl("/sessions"), JsonBody(LoginPayload(email, password)));

        var response = await localClient.GetAsync(HistoryUrl(""));
        var body = await response.Content.ReadAsStringAsync();
        var history = JsonNode.Parse(body)!["items"]!.AsArray();
        Assert.That(history, Is.Empty, "A brand-new user must have an empty history");

        await localClient.DeleteAsync(AuthUrl($"/profile?password={Uri.EscapeDataString(password)}"));
    }


    [Test]
    [Description("Case 5 — adding 1 history entry returns it with id, place_id and accessed_at")]
    public async Task TestCase5_SingleEntry()
    {
        var entry = await PostJsonObjectAsync(HistoryUrl(""), PlacePayload(PlaceA));

        Assert.That(entry["id"]!.GetValue<int>(), Is.GreaterThan(0), "Entry id must be positive");
        Assert.That(entry["place_id"]!.GetValue<string>(), Is.EqualTo(PlaceA), "place_id must match");
        Assert.That(entry.ContainsKey("accessed_at"), Is.True, "Entry must have a accessed_at timestamp field");
    }


    [Test]
    [Description("Case 6 — deleting a history entry removes it from GET /api/v1/history")]
    public async Task TestCase6_DeleteEntry()
    {
        var entryId = await AddHistoryAsync(PlaceA);

        var deleteStatus = await DeleteAsync(HistoryUrl($"/{entryId}"));
        Assert.That(deleteStatus, Is.EqualTo(204), "DELETE history entry must return HTTP 204");

        var history = (await GetJsonObjectAsync(HistoryUrl("")))["items"]!.AsArray();
        var stillPresent = history.Any(el => el!["id"]!.GetValue<int>() == entryId);
        Assert.That(stillPresent, Is.False, "Deleted entry must not appear in GET /api/v1/history");
    }


    [Test]
    [Description("Case 3 — each history entry has a non-null accessed_at field")]
    public async Task TestCase3_AccessDate()
    {
        await AddHistoryAsync(PlaceB);

        var history = (await GetJsonObjectAsync(HistoryUrl("")))["items"]!.AsArray();
        Assert.That(history, Is.Not.Empty, "History must have at least 1 entry");

        var latest = history[^1]!.AsObject();
        Assert.That(latest.ContainsKey("accessed_at"), Is.True, "Entry must have accessed_at field");
        // System.Text.Json.Nodes represents a JSON `null` value as an actual C# null reference,
        // so a plain null-check is the correct equivalent of Gson's JsonElement.isJsonNull().
        Assert.That(latest["accessed_at"], Is.Not.Null, "accessed_at must not be null");
    }

    private static StringContent JsonBody(JsonNode payload) =>
        new(payload.ToJsonString(), Encoding.UTF8, "application/json");
}
