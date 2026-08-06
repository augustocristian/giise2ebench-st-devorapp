using DevorApp.E2ETests.Common;
using NUnit.Framework;

namespace DevorApp.E2ETests.Tests.Api;

/// <summary>
/// Port of epigijon.devorapp.e2e.functional.tests.api.TestApiFavoritosBC.
///
/// API Base-Choice tests for the favorites module. Adapts the favorites
/// scenarios from favorites.spec.ts (Playwright/TS) to pure REST
/// assertions using <see cref="BaseApiClass"/>.
///
/// Cases covered:
///   BASE   — create list, add several restaurants, GET returns all.
///   Caso 2 — GET empty list returns empty restaurantes array.
///   Caso 3 — GET list with 1 restaurant returns array of size 1.
///   Caso 4 — GET all lists returns the expected count.
///   Caso 5 — DELETE restaurant removes it from the list detail.
///   Caso 6 — DELETE list removes it from the user's collection.
/// </summary>
[TestFixture]
public class TestApiFavoritosBC : BaseApiClass
{
    private const string PlaceA = "ChIJN1t_tDeuEmsRUsoyG83frY4";
    private const string PlaceB = "ChIJdd4hrwug2EcRmSrV3Vo6llI";
    private const string PlaceC = "ChIJ2eUgeAK6j4ARbn5u_wAGqWA";

    private int _listaId;

    [OneTimeSetUp]
    public async Task AuthSetup()
    {
        var ts = Unique();
        await RegisterAndLoginAsync(UniqueUsername(ts), UniqueEmail(ts), "Test1234!");
    }

    [OneTimeTearDown]
    public async Task AuthTeardown() => await DeleteTestUserAsync();

    [SetUp]
    public async Task CreateFreshList() => _listaId = await CreateListaAsync($"BCTest{Unique()}");

    // ── BASE: varias listas + varios restaurantes ───────────────────────────

    [Test]
    [Description("BASE — adding 3 restaurants to a list returns all 3 in the detail endpoint")]
    public async Task TestBase_VariosRestaurantes()
    {
        await PostAsync(FavoritosUrl($"/listas/{_listaId}"), FavoritoPayload(PlaceA));
        await PostAsync(FavoritosUrl($"/listas/{_listaId}"), FavoritoPayload(PlaceB));
        await PostAsync(FavoritosUrl($"/listas/{_listaId}"), FavoritoPayload(PlaceC));

        var detail = await GetJsonObjectAsync(FavoritosUrl($"/listas/{_listaId}"));
        var restaurantes = detail["restaurantes"]!.AsArray();

        Assert.That(restaurantes.Count, Is.EqualTo(3),
            "After adding 3 restaurants the detail must return exactly 3");
    }

    // ── Caso 2: lista vacía → restaurantes array vacío ──────────────────────

    [Test]
    [Description("Caso 2 — a new list has an empty restaurantes array")]
    public async Task TestCaso2_ListaVacia()
    {
        var detail = await GetJsonObjectAsync(FavoritosUrl($"/listas/{_listaId}"));
        var restaurantes = detail["restaurantes"]!.AsArray();

        Assert.That(restaurantes, Is.Empty, "A brand-new list must have 0 restaurants");
    }

    // ── Caso 3: lista con 1 restaurante ──────────────────────────────────────

    [Test]
    [Description("Caso 3 — adding 1 restaurant returns a restaurantes array of size 1")]
    public async Task TestCaso3_UnRestaurante()
    {
        await PostAsync(FavoritosUrl($"/listas/{_listaId}"), FavoritoPayload(PlaceA));

        var detail = await GetJsonObjectAsync(FavoritosUrl($"/listas/{_listaId}"));
        var restaurantes = detail["restaurantes"]!.AsArray();

        Assert.That(restaurantes.Count, Is.EqualTo(1), "After adding 1 restaurant the detail must return exactly 1");
        Assert.That(restaurantes[0]!["place_id"]!.GetValue<string>(), Is.EqualTo(PlaceA),
            "The place_id must match the added restaurant");
    }

    // ── Caso 4: GET /api/favoritos/listas devuelve las listas del usuario ───

    [Test]
    [Description("Caso 4 — GET /api/favoritos/listas returns a non-empty array with the created list")]
    public async Task TestCaso4_GetListas()
    {
        var listas = await GetJsonArrayAsync(FavoritosUrl("/listas"));

        Assert.That(listas, Is.Not.Empty, "The listas array must not be empty after creating a list");
        var found = listas.Any(el => el!["id"]!.GetValue<int>() == _listaId);
        Assert.That(found, Is.True, $"The created list id={_listaId} must appear in GET /api/favoritos/listas");
    }

    // ── Caso 5: eliminar un restaurante lo quita del detalle ────────────────

    [Test]
    [Description("Caso 5 — deleting a restaurant removes it from the list detail")]
    public async Task TestCaso5_EliminarRestaurante()
    {
        var favIdA = await AddFavoritoAsync(_listaId, PlaceA);
        await PostAsync(FavoritosUrl($"/listas/{_listaId}"), FavoritoPayload(PlaceB));

        var deleteStatus = await DeleteAsync(FavoritosUrl($"/{favIdA}"));
        Assert.That(deleteStatus, Is.EqualTo(204), "DELETE favorito must return HTTP 204");

        var restaurantes = (await GetJsonObjectAsync(FavoritosUrl($"/listas/{_listaId}")))["restaurantes"]!.AsArray();

        Assert.That(ContainsByField(restaurantes, "place_id", PlaceA), Is.False,
            "Deleted restaurant (PLACE_A) must not appear in list detail");
        Assert.That(ContainsByField(restaurantes, "place_id", PlaceB), Is.True,
            "Non-deleted restaurant (PLACE_B) must still appear");
    }

    // ── Caso 6: eliminar lista la quita de la colección ──────────────────────

    [Test]
    [Description("Caso 6 — deleting a list removes it from GET /api/favoritos/listas")]
    public async Task TestCaso6_EliminarLista()
    {
        var status = await DeleteAsync(FavoritosUrl($"/listas/{_listaId}"));
        Assert.That(status, Is.EqualTo(204), "DELETE lista must return HTTP 204");

        var listas = await GetJsonArrayAsync(FavoritosUrl("/listas"));
        var stillPresent = listas.Any(el => el!["id"]!.GetValue<int>() == _listaId);
        Assert.That(stillPresent, Is.False, "Deleted list must not appear in GET /api/favoritos/listas");

        // Prevent the next [SetUp]-created list from being confused with this deleted one
        _listaId = -1;
    }
}
