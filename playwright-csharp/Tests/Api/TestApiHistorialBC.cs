using System.Text;
using System.Text.Json.Nodes;
using DevorApp.E2ETests.Common;
using NUnit.Framework;

namespace DevorApp.E2ETests.Tests.Api;

/// <summary>
/// Port of epigijon.devorapp.e2e.functional.tests.api.TestApiHistorialBC.
///
/// API Base-Choice tests for the history (historial) module. Adapts the
/// history scenarios from history.spec.ts (Playwright/TS) to pure REST
/// assertions.
///
/// Cases covered:
///   BASE   — multiple history entries are returned by GET /api/historial.
///   Caso 2 — a fresh user has an empty history (0 entries).
///   Caso 5 — exactly 1 history entry is returned with correct fields.
///   Caso 6 — deleting an entry removes it from the history list.
///   Caso 3 — entry has a fecha_acceso (timestamp) field populated.
/// </summary>
[TestFixture]
public class TestApiHistorialBC : BaseApiClass
{
    private const string PlaceA = "ChIJN1t_tDeuEmsRUsoyG83frY4";
    private const string PlaceB = "ChIJdd4hrwug2EcRmSrV3Vo6llI";
    private const string PlaceC = "ChIJ2eUgeAK6j4ARbn5u_wAGqWA";

    [OneTimeSetUp]
    public async Task AuthSetup()
    {
        var ts = Unique();
        await RegisterAndLoginAsync(UniqueUsername(ts), UniqueEmail(ts), "Test1234!");
    }

    [OneTimeTearDown]
    public async Task AuthTeardown() => await DeleteTestUserAsync();

    // ── BASE: múltiples entradas devueltas ────────────────────────────────────

    [Test]
    [Description("BASE — adding 3 history entries returns all 3 via GET /api/historial")]
    public async Task TestBase_MultipleEntradas()
    {
        await AddHistorialAsync(PlaceA);
        await AddHistorialAsync(PlaceB);
        await AddHistorialAsync(PlaceC);

        var historial = await GetJsonArrayAsync(HistorialUrl(""));
        Assert.That(historial.Count, Is.GreaterThanOrEqualTo(3),
            "After adding 3 entries historial must have at least 3 items (BASE)");
    }

    // ── Caso 2: historial vacío → array vacío ──────────────────────────────

    [Test]
    [Description("Caso 2 — fresh user with no history gets an empty array")]
    public async Task TestCaso2_HistorialVacio()
    {
        var ts = Unique();
        var email = UniqueEmail(ts);
        var username = UniqueUsername(ts);
        const string password = "Test1234!";

        using var localClient = new HttpClient();

        await localClient.PostAsync(AuthUrl("/register"), JsonBody(RegisterPayload(username, email, password, "Test", "User", "")));
        await localClient.PostAsync(AuthUrl("/login"), JsonBody(LoginPayload(email, password)));

        var response = await localClient.GetAsync(HistorialUrl(""));
        var body = await response.Content.ReadAsStringAsync();
        var historial = JsonNode.Parse(body)!.AsArray();
        Assert.That(historial, Is.Empty, "A brand-new user must have an empty history");

        await localClient.DeleteAsync(AuthUrl($"/profile?password={Uri.EscapeDataString(password)}"));
    }

    // ── Caso 5: exactamente 1 entrada ────────────────────────────────────────

    [Test]
    [Description("Caso 5 — adding 1 history entry returns it with id, place_id and fecha_acceso")]
    public async Task TestCaso5_UnaEntrada()
    {
        var entry = await PostJsonObjectAsync(HistorialUrl(""), HistorialPayload(PlaceA));

        Assert.That(entry["id"]!.GetValue<int>(), Is.GreaterThan(0), "Entry id must be positive");
        Assert.That(entry["place_id"]!.GetValue<string>(), Is.EqualTo(PlaceA), "place_id must match");
        Assert.That(entry.ContainsKey("fecha_acceso"), Is.True, "Entry must have a fecha_acceso timestamp field");
    }

    // ── Caso 6: eliminar entrada la quita del historial ─────────────────────

    [Test]
    [Description("Caso 6 — deleting a history entry removes it from GET /api/historial")]
    public async Task TestCaso6_EliminarEntrada()
    {
        var entryId = await AddHistorialAsync(PlaceA);

        var deleteStatus = await DeleteAsync(HistorialUrl($"/{entryId}"));
        Assert.That(deleteStatus, Is.EqualTo(204), "DELETE historial entry must return HTTP 204");

        var historial = await GetJsonArrayAsync(HistorialUrl(""));
        var stillPresent = historial.Any(el => el!["id"]!.GetValue<int>() == entryId);
        Assert.That(stillPresent, Is.False, "Deleted entry must not appear in GET /api/historial");
    }

    // ── Caso 3: la entrada tiene fecha_acceso (timestamp) ────────────────────

    [Test]
    [Description("Caso 3 — each history entry has a non-null fecha_acceso field")]
    public async Task TestCaso3_FechaAcceso()
    {
        await AddHistorialAsync(PlaceB);

        var historial = await GetJsonArrayAsync(HistorialUrl(""));
        Assert.That(historial, Is.Not.Empty, "Historial must have at least 1 entry");

        var latest = historial[^1]!.AsObject();
        Assert.That(latest.ContainsKey("fecha_acceso"), Is.True, "Entry must have fecha_acceso field");
        // System.Text.Json.Nodes represents a JSON `null` value as an actual C# null reference,
        // so a plain null-check is the correct equivalent of Gson's JsonElement.isJsonNull().
        Assert.That(latest["fecha_acceso"], Is.Not.Null, "fecha_acceso must not be null");
    }

    private static StringContent JsonBody(JsonNode payload) =>
        new(payload.ToJsonString(), Encoding.UTF8, "application/json");
}
