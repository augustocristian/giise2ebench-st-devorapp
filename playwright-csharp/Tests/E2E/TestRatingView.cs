using DevorApp.E2ETests.Common;
using DevorApp.E2ETests.Pages;
using Microsoft.Playwright;
using NUnit.Framework;
using static Microsoft.Playwright.Assertions;

namespace DevorApp.E2ETests.Tests.E2E;

/// <summary>
/// Browser tests for the rating modal opened from the history page (BASE, S2-S14).
///
/// Base-Choice coverage:
///   BASE — all aspects at maximum with a comment: the submission succeeds.
///   S2, S5, S8, S11 — any single aspect at 0 stars disables the submit button.
///   S3, S4, S6, S7 — varying quality/price with the rest at maximum: succeeds.
///   S9, S10, S12, S13 — varying hygiene/service with the rest at maximum: succeeds.
///   S14 — an empty comment is accepted.
/// </summary>
[TestFixture]
public class TestRatingView : BaseLoggedClass
{
    private const string PlaceId = "MOCK_PLACE_101";

    [OneTimeSetUp]
    public async Task CreateTestUser()
    {
        var ts = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds();
        await SetupTestUserAsync($"ratingui{ts % 100000}", $"ratingui{ts}@devorapp.test", "Test1234!");
    }

    [SetUp]
    public async Task EnsureHistoryEntry()
    {
        await ApiLoginAsync();
        var apiBase = Properties.GetValueOrDefault("LOCALHOST_URL", "http://localhost:8000");
        await ApiDeleteAsync($"{apiBase}/api/v1/restaurants/{PlaceId}/rating");
        await ApiPostAsync($"{apiBase}/api/v1/history", new System.Text.Json.Nodes.JsonObject { ["place_id"] = PlaceId });
    }

    [OneTimeTearDown]
    public async Task CleanupTestUser() => await TeardownTestUserAsync();

    private async Task<HistoryPage> LoginAndGoToHistoryAsync()
    {
        await GoToLoginAsync();
        var loginPage = await LoginPage.CreateAsync(Page);
        await loginPage.EnterIdentifierAsync(TestEmail!);
        await loginPage.EnterPasswordAsync(TestPassword!);
        await loginPage.SubmitLoginAsync();
        return await ReloadHistoryAsync();
    }

    private async Task<HistoryPage> ReloadHistoryAsync()
    {
        await Page.GotoAsync($"{SutUrl}/history");
        return await HistoryPage.CreateAsync(Page);
    }

    private async Task OpenRatingModalAsync(HistoryPage page)
    {
        await page.OpenCardMenuAsync(0);
        await page.ChooseMenuActionAsync("rate");
        await Page.Locator(TestId.Of("rating-modal")).WaitForAsync();
    }

    private async Task SelectStarsAsync(string aspect, int stars)
    {
        if (stars <= 0) return;
        await Page.Locator(TestId.RatingStar(aspect, stars)).ClickAsync();
    }

    private async Task<bool> IsSubmitEnabledAsync() =>
        await Page.Locator(TestId.Of("rating-submit")).IsEnabledAsync();

    private async Task FillRatingsAsync(int quality, int price, int hygiene, int service, string? comment)
    {
        await SelectStarsAsync("quality", quality);
        await SelectStarsAsync("price", price);
        await SelectStarsAsync("hygiene", hygiene);
        await SelectStarsAsync("service", service);
        await Page.Locator(TestId.Of("rating-comment")).FillAsync(comment ?? "");
    }

    private async Task SubmitRatingAndVerifySuccessAsync()
    {
        await Page.Locator(TestId.Of("rating-submit")).ClickAsync();
        await Page.Locator(TestId.Of("rating-modal")).WaitForAsync(new LocatorWaitForOptions { State = WaitForSelectorState.Hidden });
        await Expect(Page.Locator(TestId.Toast("success")).First).ToBeVisibleAsync();
    }

    [Test]
    [Description("Save a rating with all aspects at maximum and a comment (BASE)")]
    public async Task TestSaveFullRatingBase()
    {
        var page = await LoginAndGoToHistoryAsync();
        await OpenRatingModalAsync(page);
        await FillRatingsAsync(5, 5, 5, 5, "Excelente servicio y comida deliciosa");
        Assert.That(await IsSubmitEnabledAsync(), Is.True, "Submit button must be enabled when all aspects are rated");
        await SubmitRatingAndVerifySuccessAsync();
    }

    [Test]
    [Description("Submit is disabled with 0 stars in any aspect (S2, S5, S8, S11) and an empty comment is accepted (S14)")]
    public async Task TestZeroStarsDisableSubmitAndEmptyCommentAccepted()
    {
        // S2: quality = 0
        var page = await LoginAndGoToHistoryAsync();
        await OpenRatingModalAsync(page);
        await FillRatingsAsync(0, 5, 5, 5, "Comment");
        Assert.That(await IsSubmitEnabledAsync(), Is.False, "S2: submit must be disabled when quality has 0 stars");

        // S5: price = 0
        page = await ReloadHistoryAsync();
        await OpenRatingModalAsync(page);
        await FillRatingsAsync(5, 0, 5, 5, "Comment");
        Assert.That(await IsSubmitEnabledAsync(), Is.False, "S5: submit must be disabled when price has 0 stars");

        // S8: hygiene = 0
        page = await ReloadHistoryAsync();
        await OpenRatingModalAsync(page);
        await FillRatingsAsync(5, 5, 0, 5, "Comment");
        Assert.That(await IsSubmitEnabledAsync(), Is.False, "S8: submit must be disabled when hygiene has 0 stars");

        // S11: service = 0
        page = await ReloadHistoryAsync();
        await OpenRatingModalAsync(page);
        await FillRatingsAsync(5, 5, 5, 0, "Comment");
        Assert.That(await IsSubmitEnabledAsync(), Is.False, "S11: submit must be disabled when service has 0 stars");

        // S14: empty comment is accepted
        page = await ReloadHistoryAsync();
        await OpenRatingModalAsync(page);
        await FillRatingsAsync(5, 5, 5, 5, "");
        Assert.That(await IsSubmitEnabledAsync(), Is.True, "S14: submit must be enabled even with empty comment");
        await SubmitRatingAndVerifySuccessAsync();
    }

    [Test]
    [Description("Save ratings with varying quality, price, hygiene and service (S3, S4, S6, S7, S9, S10, S12, S13)")]
    public async Task TestVariableRatings()
    {
        // S3 & S7: quality = 1, price = 3 (rest at the base value 5)
        var page = await LoginAndGoToHistoryAsync();
        await OpenRatingModalAsync(page);
        await FillRatingsAsync(1, 3, 5, 5, "Comment");
        Assert.That(await IsSubmitEnabledAsync(), Is.True, "S3/S7: submit must be enabled");
        await SubmitRatingAndVerifySuccessAsync();

        // S4 & S6: quality = 3, price = 1
        await EnsureHistoryEntry();
        page = await ReloadHistoryAsync();
        await OpenRatingModalAsync(page);
        await FillRatingsAsync(3, 1, 5, 5, "Comment");
        Assert.That(await IsSubmitEnabledAsync(), Is.True, "S4/S6: submit must be enabled");
        await SubmitRatingAndVerifySuccessAsync();

        // S9 & S13: hygiene = 1, service = 3
        await EnsureHistoryEntry();
        page = await ReloadHistoryAsync();
        await OpenRatingModalAsync(page);
        await FillRatingsAsync(5, 5, 1, 3, "Comment");
        Assert.That(await IsSubmitEnabledAsync(), Is.True, "S9/S13: submit must be enabled");
        await SubmitRatingAndVerifySuccessAsync();

        // S10 & S12: hygiene = 3, service = 1
        await EnsureHistoryEntry();
        page = await ReloadHistoryAsync();
        await OpenRatingModalAsync(page);
        await FillRatingsAsync(5, 5, 3, 1, "Comment");
        Assert.That(await IsSubmitEnabledAsync(), Is.True, "S10/S12: submit must be enabled");
        await SubmitRatingAndVerifySuccessAsync();
    }
}
