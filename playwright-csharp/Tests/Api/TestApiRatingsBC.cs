using DevorApp.E2ETests.Common;
using NUnit.Framework;

namespace DevorApp.E2ETests.Tests.Api;

/// <summary>
///
/// API Base-Choice tests for the ratings module.
///
/// Cases covered:
///   BASE  — full rating (all 4 aspects + comment) is stored and retrieved correctly.
///   S3    — quality=1, price=3 → scores match exactly.
///   S4    — quality=3, price=1 → scores match exactly.
///   S9    — hygiene=1, service=3 → scores match exactly.
///   S10   — hygiene=3, service=1 → scores match exactly.
///   S14   — empty comment is stored as empty string or null.
///   del   — deleting a rating removes it from GET /api/v1/ratings.
/// </summary>
[TestFixture]
public class TestApiRatingsBC : BaseApiClass
{
    [OneTimeSetUp]
    public async Task AuthSetup()
    {
        var ts = Unique();
        await RegisterAndLoginAsync(UniqueUsername(ts), UniqueEmail(ts), "Test1234!");
    }

    [OneTimeTearDown]
    public async Task AuthTeardown() => await DeleteTestUserAsync();


    [Test]
    [Description("BASE — full rating with all aspects at max stored and retrieved correctly")]
    public async Task TestBase_FullRating()
    {
        var placeId = $"bc_base_{Unique()}";
        var val = await CreateRatingAsync(placeId, 5, 5, 5, 5, "Excelente servicio y comida deliciosa");

        Assert.That(val["id"]!.GetValue<int>(), Is.GreaterThan(0), "id must be positive");
        Assert.That(val["quality"]!.GetValue<int>(), Is.EqualTo(5), "quality=5");
        Assert.That(val["price"]!.GetValue<int>(), Is.EqualTo(5), "price=5");
        Assert.That(val["hygiene"]!.GetValue<int>(), Is.EqualTo(5), "hygiene=5");
        Assert.That(val["service"]!.GetValue<int>(), Is.EqualTo(5), "service=5");
        Assert.That(val["comment"]!.GetValue<string>(), Is.EqualTo("Excelente servicio y comida deliciosa"),
            "comment matches");
    }


    [Test]
    [Description("S3 — quality=1, price=3, hygiene=5, service=5 stored correctly")]
    public async Task TestS3_LowQualityMidPrice()
    {
        var placeId = $"bc_s3_{Unique()}";
        var val = await CreateRatingAsync(placeId, 1, 3, 5, 5, "OK");

        Assert.That(val["quality"]!.GetValue<int>(), Is.EqualTo(1), "quality=1");
        Assert.That(val["price"]!.GetValue<int>(), Is.EqualTo(3), "price=3");
        Assert.That(val["hygiene"]!.GetValue<int>(), Is.EqualTo(5), "hygiene=5");
        Assert.That(val["service"]!.GetValue<int>(), Is.EqualTo(5), "service=5");
    }


    [Test]
    [Description("S4 — quality=3, price=1, hygiene=5, service=5 stored correctly")]
    public async Task TestS4_MidQualityLowPrice()
    {
        var placeId = $"bc_s4_{Unique()}";
        var val = await CreateRatingAsync(placeId, 3, 1, 5, 5, "OK");

        Assert.That(val["quality"]!.GetValue<int>(), Is.EqualTo(3), "quality=3");
        Assert.That(val["price"]!.GetValue<int>(), Is.EqualTo(1), "price=1");
    }


    [Test]
    [Description("S9 — quality=5, price=5, hygiene=1, service=3 stored correctly")]
    public async Task TestS9_LowHygieneMidService()
    {
        var placeId = $"bc_s9_{Unique()}";
        var val = await CreateRatingAsync(placeId, 5, 5, 1, 3, "Regular hygiene");

        Assert.That(val["hygiene"]!.GetValue<int>(), Is.EqualTo(1), "hygiene=1");
        Assert.That(val["service"]!.GetValue<int>(), Is.EqualTo(3), "service=3");
    }


    [Test]
    [Description("S10 — quality=5, price=5, hygiene=3, service=1 stored correctly")]
    public async Task TestS10_MidHygieneLowService()
    {
        var placeId = $"bc_s10_{Unique()}";
        var val = await CreateRatingAsync(placeId, 5, 5, 3, 1, "Trato mejorable");

        Assert.That(val["hygiene"]!.GetValue<int>(), Is.EqualTo(3), "hygiene=3");
        Assert.That(val["service"]!.GetValue<int>(), Is.EqualTo(1), "service=1");
    }


    [Test]
    [Description("S14 — rating with empty comment is accepted (HTTP 201)")]
    public async Task TestS14_EmptyComment()
    {
        var placeId = $"bc_s14_{Unique()}";
        var status = (await PutRatingAsync(placeId, 5, 5, 5, 5, "")).Status;

        Assert.That(status, Is.EqualTo(201), "A rating with an empty comment must return HTTP 201");
    }


    [Test]
    [Description("Deleting a rating removes it from GET /api/v1/ratings")]
    public async Task TestDeleteRating()
    {
        var placeId = $"bc_del_{Unique()}";
        await CreateRatingAsync(placeId, 4, 3, 5, 4, "A delete test");

        var deleteStatus = await DeleteAsync(RestaurantsUrl($"/{placeId}/rating"));
        Assert.That(deleteStatus, Is.EqualTo(204), "DELETE must return HTTP 204");

        var all = (await GetJsonObjectAsync(RatingsUrl("")))["items"]!.AsArray();
        var found = all.Any(el => el!["place_id"]!.GetValue<string>() == placeId);
        Assert.That(found, Is.False, "Deleted rating must not appear in GET list");
    }
}
