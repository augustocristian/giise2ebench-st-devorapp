using System.Text.Json.Nodes;
using DevorApp.E2ETests.Common;
using DevorApp.E2ETests.Pages;
using NUnit.Framework;

namespace DevorApp.E2ETests.Tests.E2E;

/// <summary>
/// Port of epigijon.devorapp.e2e.functional.tests.e2e.TestFavoritesView.
///
/// Browser tests for the DevorApp favorites page (/favorites).
///
/// Base-Choice coverage:
///   BASE — multiple lists, 0 restaurants, with search filter.
///   S2 — 0 lists created (empty state general).
///   S3 — 1 list, 0 restaurants, with search filter.
///   S4 — multiple lists, 1 restaurant, with search filter.
///   S5 — multiple lists, multiple restaurants, with search filter.
///   S6 — multiple lists, 0 restaurants, no search filter.
/// </summary>
[TestFixture]
public class TestFavoritesView : BaseLoggedClass
{
    private const string PlaceA = "ChIJN1t_tDeuEmsRUsoyG83frY4";
    private const string PlaceB = "ChIJdd4hrwug2EcRmSrV3Vo6llI";

    [OneTimeSetUp]
    public async Task CreateTestUser()
    {
        var ts = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds();
        await SetupTestUserAsync($"favui{ts % 100000}", $"favui{ts}@devorapp.test", "Test1234!");
    }

    [OneTimeTearDown]
    public async Task CleanupTestUser() => await TeardownTestUserAsync();

    // ── Fetch mocking helpers ────────────────────────────────────────────────

    private async Task InjectFavoritesMockAsync(JsonArray listas, JsonObject detail)
    {
        await Page.EvaluateAsync(
            @"([listasJson, detailJson]) => {
                window.mockFavoritesListas = JSON.parse(listasJson);
                window.mockFavoritesDetail = JSON.parse(detailJson);
                window.originalFetch = window.fetch;
                window.fetch = function(input, init) {
                    if (typeof input === 'string') {
                        if (input.includes('/api/favoritos/listas/')) {
                            return Promise.resolve(new Response(JSON.stringify(window.mockFavoritesDetail),
                                { status: 200, headers: { 'Content-Type': 'application/json' } }));
                        }
                        if (input.includes('/api/favoritos/listas')) {
                            return Promise.resolve(new Response(JSON.stringify(window.mockFavoritesListas),
                                { status: 200, headers: { 'Content-Type': 'application/json' } }));
                        }
                    }
                    return window.originalFetch(input, init);
                };
            }",
            new[] { listas.ToJsonString(), detail.ToJsonString() });
    }

    private async Task RestoreFetchAsync() =>
        await Page.EvaluateAsync("() => { if (window.originalFetch) { window.fetch = window.originalFetch; } }");

    private static JsonArray MockListas(int count)
    {
        var array = new JsonArray();
        for (var i = 1; i <= count; i++)
        {
            array.Add(new JsonObject
            {
                ["id"] = i,
                ["user_id"] = "uid",
                ["nombre"] = $"Lista {i}",
                ["icono"] = "Heart",
            });
        }
        return array;
    }

    private static JsonObject MockDetail(int listId, string listName, int restaurantCount)
    {
        string[] placeIds = { PlaceA, PlaceB };
        string[] names = { "Restaurante Uno", "Restaurante Dos" };

        var restaurantes = new JsonArray();
        for (var i = 0; i < restaurantCount; i++)
        {
            var placeId = placeIds[i % placeIds.Length];
            var name = names[i % names.Length];
            restaurantes.Add(new JsonObject
            {
                ["id"] = i + 1,
                ["lista_id"] = listId,
                ["place_id"] = placeId,
                ["restaurant"] = new JsonObject
                {
                    ["id"] = placeId,
                    ["name"] = name,
                    ["rating"] = 4.5,
                    ["user_ratings_total"] = 100,
                    ["address"] = $"Calle Falsa {i + 1}",
                    ["main_photo"] = null,
                    ["types"] = new JsonArray("restaurant"),
                },
            });
        }

        return new JsonObject
        {
            ["lista"] = new JsonObject { ["id"] = listId, ["user_id"] = "uid", ["nombre"] = listName, ["icono"] = "Heart" },
            ["restaurantes"] = restaurantes,
        };
    }

    private async Task<FavoritesPage> LoginGoToHomeAndInjectMockAsync(JsonArray listas, JsonObject detail)
    {
        await GoToLoginAsync();
        var loginPage = await LoginPage.CreateAsync(Page);
        await loginPage.EnterIdentifierAsync(TestEmail!);
        await loginPage.EnterPasswordAsync(TestPassword!);
        await loginPage.SubmitLoginAsync();

        await InjectFavoritesMockAsync(listas, detail);

        var menu = await SideMenuPage.CreateAsync(Page);
        await menu.OpenAsync();
        await Page.Locator("xpath=//button[contains(.,'Favoritos')]").ClickAsync();

        return await FavoritesPage.CreateAsync(Page);
    }

    // ── 1. BASE: varias listas, 0 restaurantes, con búsqueda ─────────────────

    [Test]
    [Description("BASE — varias listas, 0 restaurantes, con búsqueda")]
    public async Task TestBase_BusquedaListas()
    {
        var page = await LoginGoToHomeAndInjectMockAsync(MockListas(2), MockDetail(1, "Lista 1", 0));
        try
        {
            Assert.That(await page.GetListCountAsync(), Is.EqualTo(2), "Debe haber 2 listas visibles");

            await page.OpenListByNameAsync("Lista 1");
            Assert.That(await page.GetRestaurantCountAsync(), Is.EqualTo(0), "La lista debe estar vacía");

            await page.SearchWithinAsync("pizza");
            Assert.That(await page.GetRestaurantCountAsync(), Is.EqualTo(0), "La lista filtrada debe seguir vacía");
        }
        finally
        {
            await RestoreFetchAsync();
        }
    }

    // ── 2. S2, S3 y S6: vacíos, listas unitarias/múltiples ────────────────────

    [Test]
    [Description("S2, S3, S6 — gestión de estados vacíos y búsqueda")]
    public async Task TestCasosVacio()
    {
        // S2: 0 listas -> empty state
        var pageEmpty = await LoginGoToHomeAndInjectMockAsync(new JsonArray(), new JsonObject());
        try
        {
            Assert.That(await pageEmpty.GetListCountAsync(), Is.EqualTo(0), "S2: debe haber 0 listas");
            Assert.That(await pageEmpty.IsEmptyStateVisibleAsync(), Is.True, "S2: el texto de estado vacío debe ser visible");
        }
        finally
        {
            await RestoreFetchAsync();
        }

        // S3: 1 lista, 0 restaurantes, con búsqueda
        var pageS3 = await LoginGoToHomeAndInjectMockAsync(MockListas(1), MockDetail(1, "Lista 1", 0));
        try
        {
            Assert.That(await pageS3.GetListCountAsync(), Is.EqualTo(1), "S3: debe haber 1 lista");
            await pageS3.OpenListByNameAsync("Lista 1");
            await pageS3.SearchWithinAsync("pizza");
            Assert.That(await pageS3.GetRestaurantCountAsync(), Is.EqualTo(0), "S3: la lista filtrada debe estar vacía");
        }
        finally
        {
            await RestoreFetchAsync();
        }

        // S6: varias listas, 0 restaurantes, sin búsqueda
        var pageS6 = await LoginGoToHomeAndInjectMockAsync(MockListas(2), MockDetail(1, "Lista 1", 0));
        try
        {
            Assert.That(await pageS6.GetListCountAsync(), Is.EqualTo(2), "S6: debe haber 2 listas");
            await pageS6.OpenListByNameAsync("Lista 1");
            Assert.That(await pageS6.IsDetailEmptyStateVisibleAsync(), Is.True, "S6: el texto de lista vacía debe ser visible");
            Assert.That(await pageS6.GetRestaurantCountAsync(), Is.EqualTo(0), "S6: debe haber 0 restaurantes");
        }
        finally
        {
            await RestoreFetchAsync();
        }
    }

    // ── 3. S4 y S5: listas con restaurantes y búsquedas ───────────────────────

    [Test]
    [Description("S4, S5 — listas con restaurantes y búsquedas")]
    public async Task TestCasosConRestaurantes()
    {
        // S4: varias listas, 1 restaurante, con búsqueda
        var pageS4 = await LoginGoToHomeAndInjectMockAsync(MockListas(2), MockDetail(1, "Lista 1", 1));
        try
        {
            await pageS4.OpenListByNameAsync("Lista 1");
            Assert.That(await pageS4.GetRestaurantCountAsync(), Is.EqualTo(1), "S4: debe haber 1 restaurante inicialmente");

            await pageS4.SearchWithinAsync("Uno");
            Assert.That(await pageS4.GetRestaurantCountAsync(), Is.EqualTo(1), "S4: debe seguir habiendo 1 restaurante");

            await pageS4.SearchWithinAsync("zzz_no_match");
            Assert.That(await pageS4.GetRestaurantCountAsync(), Is.EqualTo(0),
                "S4: debe haber 0 restaurantes tras búsqueda fallida");
        }
        finally
        {
            await RestoreFetchAsync();
        }

        // S5: varias listas, varios restaurantes, con búsqueda
        var pageS5 = await LoginGoToHomeAndInjectMockAsync(MockListas(2), MockDetail(1, "Lista 1", 2));
        try
        {
            await pageS5.OpenListByNameAsync("Lista 1");
            Assert.That(await pageS5.GetRestaurantCountAsync(), Is.EqualTo(2), "S5: debe haber 2 restaurantes inicialmente");

            await pageS5.SearchWithinAsync("Dos");
            Assert.That(await pageS5.GetRestaurantCountAsync(), Is.EqualTo(1),
                "S5: debe haber 1 restaurante visible al filtrar por 'Dos'");

            await pageS5.SearchWithinAsync("zzz_no_match");
            Assert.That(await pageS5.GetRestaurantCountAsync(), Is.EqualTo(0),
                "S5: debe haber 0 restaurantes tras búsqueda fallida");
        }
        finally
        {
            await RestoreFetchAsync();
        }
    }
}
