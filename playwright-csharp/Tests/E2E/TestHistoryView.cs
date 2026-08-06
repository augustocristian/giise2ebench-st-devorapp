using System.Text.Json.Nodes;
using DevorApp.E2ETests.Common;
using DevorApp.E2ETests.Pages;
using NUnit.Framework;

namespace DevorApp.E2ETests.Tests.E2E;

/// <summary>
/// Port of epigijon.devorapp.e2e.functional.tests.e2e.TestHistoryView.
///
/// Browser tests for the DevorApp history page (/history). Adapts
/// history.spec.ts (Playwright/TS) to Playwright/NUnit. History entries
/// are mocked via a fetch override so the browser tests can verify
/// grouping by month, card counts, and the search/filter behaviour.
///
/// Base-Choice coverage:
///   BASE — multiple months, multiple restaurants, no search filter.
///   S2 — empty history shows 0 groups and 0 cards.
///   S3 — 1 month with multiple restaurants.
///   S5 — exactly 1 restaurant in history.
///   S6 — search term filters cards and hides non-matching months.
/// </summary>
[TestFixture]
public class TestHistoryView : BaseLoggedClass
{
    private const string PlaceA = "ChIJN1t_tDeuEmsRUsoyG83frY4";
    private const string PlaceB = "ChIJdd4hrwug2EcRmSrV3Vo6llI";

    [OneTimeSetUp]
    public async Task CreateTestUser()
    {
        var ts = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds();
        await SetupTestUserAsync($"histui{ts % 100000}", $"histui{ts}@devorapp.test", "Test1234!");
    }

    [OneTimeTearDown]
    public async Task CleanupTestUser() => await TeardownTestUserAsync();

    // ── Fetch mocking helpers ────────────────────────────────────────────────

    private async Task InjectHistorialMockAsync(JsonArray entries)
    {
        await Page.EvaluateAsync(
            @"(entriesJson) => {
                window.originalFetch = window.fetch;
                window.fetch = function(input, init) {
                    if (typeof input === 'string' && input.includes('/api/historial')) {
                        return Promise.resolve(new Response(entriesJson,
                            { status: 200, headers: { 'Content-Type': 'application/json' } }));
                    }
                    return window.originalFetch(input, init);
                };
            }",
            entries.ToJsonString());
    }

    private async Task RestoreFetchAsync() =>
        await Page.EvaluateAsync("() => { if (window.originalFetch) { window.fetch = window.originalFetch; } }");

    private static JsonObject Entry(string id, string date, string name, double rating, int total, bool openNow) => new()
    {
        ["id"] = 1,
        ["user_id"] = "uid",
        ["place_id"] = id,
        ["fecha_acceso"] = date,
        ["restaurant"] = new JsonObject
        {
            ["id"] = id,
            ["name"] = name,
            ["rating"] = rating,
            ["user_ratings_total"] = total,
            ["types"] = new JsonArray("restaurant"),
            ["address"] = "Calle Falsa 123",
            ["main_photo"] = null,
            ["summary"] = "Excelente",
            ["open_now"] = openNow,
        },
    };

    private static JsonArray MockHistorial(string date1, string date2) => new(
        new JsonObject
        {
            ["id"] = 1,
            ["user_id"] = "uid",
            ["place_id"] = PlaceA,
            ["fecha_acceso"] = date1,
            ["restaurant"] = new JsonObject
            {
                ["id"] = PlaceA,
                ["name"] = "Restaurante Uno",
                ["rating"] = 4.5,
                ["user_ratings_total"] = 100,
                ["types"] = new JsonArray("restaurant"),
                ["address"] = "Calle Falsa 123",
                ["main_photo"] = null,
                ["summary"] = "Excelente",
                ["open_now"] = true,
            },
        },
        new JsonObject
        {
            ["id"] = 2,
            ["user_id"] = "uid",
            ["place_id"] = PlaceB,
            ["fecha_acceso"] = date2,
            ["restaurant"] = new JsonObject
            {
                ["id"] = PlaceB,
                ["name"] = "Restaurante Dos",
                ["rating"] = 4.0,
                ["user_ratings_total"] = 50,
                ["types"] = new JsonArray("restaurant"),
                ["address"] = "Avenida Siempreviva 742",
                ["main_photo"] = null,
                ["summary"] = "Agradable",
                ["open_now"] = false,
            },
        });

    private static JsonArray SingleMockEntry(string date) => new(Entry(PlaceA, date, "Restaurante Uno", 4.5, 100, true));

    private async Task<HistoryPage> LoginGoToHomeAndInjectMockAsync(JsonArray entries)
    {
        await GoToLoginAsync();
        var loginPage = await LoginPage.CreateAsync(Page);
        await loginPage.EnterIdentifierAsync(TestEmail!);
        await loginPage.EnterPasswordAsync(TestPassword!);
        await loginPage.SubmitLoginAsync();

        await InjectHistorialMockAsync(entries);

        var menu = await SideMenuPage.CreateAsync(Page);
        await menu.OpenAsync();
        await Page.Locator("xpath=//button[contains(.,'Historial')]").ClickAsync();

        return await HistoryPage.CreateAsync(Page);
    }

    // ── BASE: múltiples entradas en historial ─────────────────────────────────

    [Test]
    [Description("BASE — history page shows at least 1 group and multiple restaurant cards")]
    public async Task TestBase_MultiplesEntradas()
    {
        var page = await LoginGoToHomeAndInjectMockAsync(MockHistorial("2026-05-15T12:00:00Z", "2026-06-15T12:00:00Z"));
        try
        {
            Assert.That(await page.GetGroupCountAsync(), Is.EqualTo(2), "Debe haber 2 grupos");

            // Expand the second group (JUNIO 2026 is collapsed by default since
            // MAYO 2026 is index 0 in mock)
            await page.ToggleGroupAsync("JUNIO 2026");

            Assert.That(await page.GetCardCountAsync(), Is.EqualTo(2), "Debe haber 2 tarjetas de restaurante visibles");
        }
        finally
        {
            await RestoreFetchAsync();
        }
    }

    // ── S2, S3 y S5 condensados: vacío, 1 mes varios restaurantes, 1 restaurante ──

    [Test]
    [Description("debe gestionar historial vacío (S2), con 1 restaurante (S5) y 1 mes con varios (S3)")]
    public async Task TestCasosVacioYUnitario()
    {
        // S2: empty history
        var pageEmpty = await LoginGoToHomeAndInjectMockAsync(new JsonArray());
        try
        {
            Assert.That(await pageEmpty.GetGroupCountAsync(), Is.EqualTo(0), "S2: debe haber 0 grupos");
            Assert.That(await pageEmpty.GetCardCountAsync(), Is.EqualTo(0), "S2: debe haber 0 tarjetas");
        }
        finally
        {
            await RestoreFetchAsync();
        }

        // S5: exactly 1 restaurant entry
        var pageOne = await LoginGoToHomeAndInjectMockAsync(SingleMockEntry("2026-05-15T12:00:00Z"));
        try
        {
            Assert.That(await pageOne.GetGroupCountAsync(), Is.EqualTo(1), "S5: debe haber 1 grupo");
            Assert.That(await pageOne.GetCardCountAsync(), Is.EqualTo(1), "S5: debe haber 1 tarjeta");
        }
        finally
        {
            await RestoreFetchAsync();
        }

        // S3: 1 month with multiple restaurants
        var pageSameMonth = await LoginGoToHomeAndInjectMockAsync(MockHistorial("2026-05-15T12:00:00Z", "2026-05-20T12:00:00Z"));
        try
        {
            Assert.That(await pageSameMonth.GetGroupCountAsync(), Is.EqualTo(1), "S3: debe haber 1 grupo");
            Assert.That(await pageSameMonth.GetCardCountAsync(), Is.EqualTo(2), "S3: debe haber 2 tarjetas");
        }
        finally
        {
            await RestoreFetchAsync();
        }
    }

    // ── S6: búsqueda filtra por nombre ────────────────────────────────────────

    [Test]
    [Description("S6 — searching in history filters cards; a non-matching term shows 0 cards")]
    public async Task TestBusquedaFiltros()
    {
        var page = await LoginGoToHomeAndInjectMockAsync(MockHistorial("2026-05-15T12:00:00Z", "2026-06-15T12:00:00Z"));
        try
        {
            await page.ToggleGroupAsync("JUNIO 2026");
            Assert.That(await page.GetCardCountAsync(), Is.EqualTo(2), "Debe haber 2 tarjetas inicialmente");

            await page.SearchAsync("Uno");
            Assert.That(await page.GetGroupCountAsync(), Is.EqualTo(1), "Debe haber 1 grupo después de buscar 'Uno'");
            Assert.That(await page.GetCardCountAsync(), Is.EqualTo(1), "Debe haber 1 tarjeta después de buscar 'Uno'");
            Assert.That(await page.GetCardNameAtAsync(0), Is.EqualTo("Restaurante Uno"),
                "La tarjeta visible debe ser 'Restaurante Uno'");

            await page.SearchAsync("zzz_nada_xyzzy_no_match");
            Assert.That(await page.GetGroupCountAsync(), Is.EqualTo(0), "Debe haber 0 grupos tras una búsqueda sin coincidencias");
            Assert.That(await page.GetCardCountAsync(), Is.EqualTo(0), "Debe haber 0 tarjetas tras una búsqueda sin coincidencias");
        }
        finally
        {
            await RestoreFetchAsync();
        }
    }
}
