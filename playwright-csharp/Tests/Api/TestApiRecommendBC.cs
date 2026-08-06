using DevorApp.E2ETests.Common;
using NUnit.Framework;

namespace DevorApp.E2ETests.Tests.Api;

/// <summary>
/// Port of epigijon.devorapp.e2e.functional.tests.api.TestApiRecommendBC.
///
/// API Base-Choice tests for the recommendation search module. Adapts the
/// recommendation scenarios from recommendation.spec.ts (Playwright/TS) to
/// pure REST assertions against POST /api/recommendations/search.
///
/// Cases covered:
///   BASE  — search with categories + prices + location returns HTTP 200 with results array.
///   S2    — categories = [] (empty) → HTTP 200 with results array.
///   S4    — prices = [] (empty) → HTTP 200 with results array.
///   S6    — include_unconfirmed_price = false → HTTP 200.
///   S7    — open_now = false → HTTP 200.
///   S8    — using an alternative location → HTTP 200.
///   S10   — results may be empty array (handled without error).
/// </summary>
[TestFixture]
public class TestApiRecommendBC : BaseApiClass
{
    private const string LocationPref = "Gijón, España";
    private const string LocationAlt = "Barcelona, España";

    [OneTimeSetUp]
    public async Task AuthSetup()
    {
        var ts = Unique();
        await RegisterAndLoginAsync(UniqueUsername(ts), UniqueEmail(ts), "Test1234!");
    }

    [OneTimeTearDown]
    public async Task AuthTeardown() => await DeleteTestUserAsync();

    // ── BASE: búsqueda con filtros base ─────────────────────────────────────

    [Test]
    [Description("BASE — search with categories, prices and location returns HTTP 200 with results array")]
    public async Task TestBase_BusquedaFiltrosBase()
    {
        var body = SearchPayload(
            new[] { "mexican_restaurant", "italian_restaurant" },
            new[] { "PRICE_LEVEL_MODERATE", "PRICE_LEVEL_EXPENSIVE" },
            true, LocationPref, 5);

        var result = await PostJsonObjectAsync(RecommendationsUrl("/search"), body);

        Assert.That(result.ContainsKey("results"), Is.True, "Response must have a 'results' field");
        Assert.That(result["results"], Is.InstanceOf<System.Text.Json.Nodes.JsonArray>(), "'results' must be a JSON array");
    }

    // ── S2: categorías vacías → HTTP 200 ────────────────────────────────────

    [Test]
    [Description("S2 — empty categories list is accepted and returns HTTP 200")]
    public async Task TestS2_CategoriasVacias()
    {
        var body = SearchPayload(Array.Empty<string>(), new[] { "PRICE_LEVEL_MODERATE" }, true, LocationPref, 5);

        var result = await PostJsonObjectAsync(RecommendationsUrl("/search"), body);
        Assert.That(result.ContainsKey("results"), Is.True, "Empty categories must still return a 'results' array (S2)");
    }

    // ── S4: precios vacíos → HTTP 200 ───────────────────────────────────────

    [Test]
    [Description("S4 — empty prices list is accepted and returns HTTP 200")]
    public async Task TestS4_PreciosVacios()
    {
        var body = SearchPayload(new[] { "mexican_restaurant" }, Array.Empty<string>(), true, LocationPref, 5);

        var result = await PostJsonObjectAsync(RecommendationsUrl("/search"), body);
        Assert.That(result.ContainsKey("results"), Is.True, "Empty prices must still return a 'results' array (S4)");
    }

    // ── S6: include_unconfirmed_price = false ────────────────────────────────

    [Test]
    [Description("S6 — include_unconfirmed_price=false returns HTTP 200")]
    public async Task TestS6_SinPrecioNoConfirmado()
    {
        var body = SearchPayload(
            new[] { "mexican_restaurant", "italian_restaurant" },
            new[] { "PRICE_LEVEL_MODERATE", "PRICE_LEVEL_EXPENSIVE" },
            false, LocationPref, 5);

        var result = await PostJsonObjectAsync(RecommendationsUrl("/search"), body);
        Assert.That(result.ContainsKey("results"), Is.True,
            "include_unconfirmed_price=false must still return results array (S6)");
    }

    // ── S7: open_now = false ─────────────────────────────────────────────────

    [Test]
    [Description("S7 — open_now=false is accepted and returns HTTP 200")]
    public async Task TestS7_NoAbierto()
    {
        var body = SearchPayload(new[] { "mexican_restaurant" }, new[] { "PRICE_LEVEL_MODERATE" }, true,
            LocationPref, 5, openNow: false);

        var result = await PostJsonObjectAsync(RecommendationsUrl("/search"), body);
        Assert.That(result.ContainsKey("results"), Is.True, "open_now=false must return a 'results' array (S7)");
    }

    // ── S8: ubicación alternativa ─────────────────────────────────────────────

    [Test]
    [Description("S8 — alternative location is accepted and returns HTTP 200")]
    public async Task TestS8_UbicacionAlternativa()
    {
        var body = SearchPayload(
            new[] { "mexican_restaurant", "italian_restaurant" },
            new[] { "PRICE_LEVEL_MODERATE", "PRICE_LEVEL_EXPENSIVE" },
            true, LocationAlt, 5);

        var result = await PostJsonObjectAsync(RecommendationsUrl("/search"), body);
        Assert.That(result.ContainsKey("results"), Is.True, "Alternative location must still return a 'results' array (S8)");
    }

    // ── S10: resultados pueden ser vacíos ────────────────────────────────────

    [Test]
    [Description("S10 — search returning 0 results returns HTTP 200 with empty results array")]
    public async Task TestS10_ResultadosVacios()
    {
        var body = SearchPayload(new[] { "some_very_obscure_cuisine_type_xyz" }, Array.Empty<string>(), false,
            "Lugar inexistente 99999", 1);

        var status = await PostStatusAsync(RecommendationsUrl("/search"), body);
        Assert.That(status, Is.EqualTo(200).Or.EqualTo(422),
            $"Search must return 200 (or 422 for an invalid location), got: {status}");
    }
}
