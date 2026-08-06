using DevorApp.E2ETests.Common;
using NUnit.Framework;

namespace DevorApp.E2ETests.Tests.Api;

/// <summary>
/// Port of epigijon.devorapp.e2e.functional.tests.api.TestApiValoracionesBC.
///
/// API Base-Choice tests for the ratings (valoraciones) module. Adapts the
/// rating scenarios from rating.spec.ts (Playwright/TS) to pure REST
/// assertions.
///
/// Cases covered:
///   BASE  — full rating (all 4 aspects + comment) is stored and retrieved correctly.
///   S3    — calidad=1, precio=3 → scores match exactly.
///   S4    — calidad=3, precio=1 → scores match exactly.
///   S9    — higiene=1, trato=3 → scores match exactly.
///   S10   — higiene=3, trato=1 → scores match exactly.
///   S14   — empty comment is stored as empty string or null.
///   del   — deleting a rating removes it from GET /api/valoraciones.
/// </summary>
[TestFixture]
public class TestApiValoracionesBC : BaseApiClass
{
    [OneTimeSetUp]
    public async Task AuthSetup()
    {
        var ts = Unique();
        await RegisterAndLoginAsync(UniqueUsername(ts), UniqueEmail(ts), "Test1234!");
    }

    [OneTimeTearDown]
    public async Task AuthTeardown() => await DeleteTestUserAsync();

    // ── BASE: valoración completa → todos los campos almacenados ────────────

    [Test]
    [Description("BASE — full rating with all aspects at max stored and retrieved correctly")]
    public async Task TestBase_ValoracionCompleta()
    {
        var placeId = $"bc_base_{Unique()}";
        var val = await CreateValoracionAsync(placeId, 5, 5, 5, 5, "Excelente servicio y comida deliciosa");

        Assert.That(val["id"]!.GetValue<int>(), Is.GreaterThan(0), "id must be positive");
        Assert.That(val["calidad"]!.GetValue<int>(), Is.EqualTo(5), "calidad=5");
        Assert.That(val["precio"]!.GetValue<int>(), Is.EqualTo(5), "precio=5");
        Assert.That(val["higiene"]!.GetValue<int>(), Is.EqualTo(5), "higiene=5");
        Assert.That(val["trato"]!.GetValue<int>(), Is.EqualTo(5), "trato=5");
        Assert.That(val["comentario"]!.GetValue<string>(), Is.EqualTo("Excelente servicio y comida deliciosa"),
            "comentario matches");
    }

    // ── S3: calidad=1, precio=3 ───────────────────────────────────────────────

    [Test]
    [Description("S3 — calidad=1, precio=3, higiene=5, trato=5 stored correctly")]
    public async Task TestS3_CalidadBajaPrecioMedio()
    {
        var placeId = $"bc_s3_{Unique()}";
        var val = await CreateValoracionAsync(placeId, 1, 3, 5, 5, "OK");

        Assert.That(val["calidad"]!.GetValue<int>(), Is.EqualTo(1), "calidad=1");
        Assert.That(val["precio"]!.GetValue<int>(), Is.EqualTo(3), "precio=3");
        Assert.That(val["higiene"]!.GetValue<int>(), Is.EqualTo(5), "higiene=5");
        Assert.That(val["trato"]!.GetValue<int>(), Is.EqualTo(5), "trato=5");
    }

    // ── S4: calidad=3, precio=1 ───────────────────────────────────────────────

    [Test]
    [Description("S4 — calidad=3, precio=1, higiene=5, trato=5 stored correctly")]
    public async Task TestS4_CalidadMedioPrecioBajo()
    {
        var placeId = $"bc_s4_{Unique()}";
        var val = await CreateValoracionAsync(placeId, 3, 1, 5, 5, "OK");

        Assert.That(val["calidad"]!.GetValue<int>(), Is.EqualTo(3), "calidad=3");
        Assert.That(val["precio"]!.GetValue<int>(), Is.EqualTo(1), "precio=1");
    }

    // ── S9: higiene=1, trato=3 ────────────────────────────────────────────────

    [Test]
    [Description("S9 — calidad=5, precio=5, higiene=1, trato=3 stored correctly")]
    public async Task TestS9_HigieneBajoTratoMedio()
    {
        var placeId = $"bc_s9_{Unique()}";
        var val = await CreateValoracionAsync(placeId, 5, 5, 1, 3, "Regular higiene");

        Assert.That(val["higiene"]!.GetValue<int>(), Is.EqualTo(1), "higiene=1");
        Assert.That(val["trato"]!.GetValue<int>(), Is.EqualTo(3), "trato=3");
    }

    // ── S10: higiene=3, trato=1 ──────────────────────────────────────────────

    [Test]
    [Description("S10 — calidad=5, precio=5, higiene=3, trato=1 stored correctly")]
    public async Task TestS10_HigieneMedioTratoBajo()
    {
        var placeId = $"bc_s10_{Unique()}";
        var val = await CreateValoracionAsync(placeId, 5, 5, 3, 1, "Trato mejorable");

        Assert.That(val["higiene"]!.GetValue<int>(), Is.EqualTo(3), "higiene=3");
        Assert.That(val["trato"]!.GetValue<int>(), Is.EqualTo(1), "trato=1");
    }

    // ── S14: comentario vacío aceptado ───────────────────────────────────────

    [Test]
    [Description("S14 — rating with empty comment is accepted (HTTP 201)")]
    public async Task TestS14_ComentarioVacio()
    {
        var placeId = $"bc_s14_{Unique()}";
        var status = await PostStatusAsync(ValoracionesUrl(""), ValoracionPayload(placeId, 5, 5, 5, 5, ""));

        Assert.That(status, Is.EqualTo(201), "A rating with an empty comment must return HTTP 201");
    }

    // ── Eliminar valoración la quita de GET /api/valoraciones ────────────────

    [Test]
    [Description("Deleting a rating removes it from GET /api/valoraciones")]
    public async Task TestEliminarValoracion()
    {
        var placeId = $"bc_del_{Unique()}";
        await CreateValoracionAsync(placeId, 4, 3, 5, 4, "A delete test");

        var deleteStatus = await DeleteAsync(ValoracionesUrl($"/{placeId}"));
        Assert.That(deleteStatus, Is.EqualTo(204), "DELETE must return HTTP 204");

        var all = await GetJsonArrayAsync(ValoracionesUrl(""));
        var found = all.Any(el => el!["place_id"]!.GetValue<string>() == placeId);
        Assert.That(found, Is.False, "Deleted valoracion must not appear in GET list");
    }
}
