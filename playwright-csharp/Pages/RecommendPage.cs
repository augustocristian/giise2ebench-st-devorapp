using Microsoft.Playwright;
using DevorApp.E2ETests.Common;
using static Microsoft.Playwright.Assertions;

namespace DevorApp.E2ETests.Pages;

/// <summary>
/// Page object for /recommend-restaurants: the search form (cuisines, price levels, toggles,
/// location) and the results panel. Ready once the preferred location name has loaded.
/// </summary>
public class RecommendPage : BasePage
{
    private ILocator CategoryInput => ByTestId("recommend-cuisine-input");
    private ILocator SearchBtn => ByTestId("recommend-submit");
    private ILocator LocPrefRadio => ByTestId("recommend-location-preferred");
    private ILocator LocOtherRadio => ByTestId("recommend-location-custom");
    private ILocator LocOtherInput => ByTestId("recommend-location-input");
    private ILocator NoPriceCheck => ByTestId("recommend-include-no-price");
    private ILocator OpenNowCheck => ByTestId("recommend-open-now");
    private ILocator PreferredName => ByTestId("recommend-preferred-location-name");

    private ILocator ResultCards => ByTestId("recommend-result-card");
    private ILocator ResultsTitle => ByTestId("recommend-results-title");
    private ILocator ErrorMsg => ByTestId("recommend-error");

    private RecommendPage(IPage page) : base(page)
    {
    }

    public static Task<RecommendPage> CreateAsync(IPage page) => InitAsync(new RecommendPage(page));

    protected override async Task WaitReadyAsync()
    {
        await SearchBtn.WaitForAsync();
        await PreferredName.WaitForAsync();
        // The label shows "Desconocida" until the user's preferred location has loaded
        await Expect(PreferredName).Not.ToContainTextAsync("Desconocida");
    }

    /// <summary>Types <paramref name="query"/> in the cuisine input and picks the dropdown option for
    /// <paramref name="tagId"/> (id from the frontend tags.json, e.g. mexican_restaurant).</summary>
    public async Task<RecommendPage> AddCategoryAsync(string query, string tagId)
    {
        await CategoryInput.ClickAsync();
        await CategoryInput.FillAsync(query);

        var option = Page.Locator(TestId.CuisineOption(tagId));
        await option.WaitForAsync();
        await option.ClickAsync();
        return this;
    }

    /// <param name="level">1 (cheapest) to 4.</param>
    public async Task<RecommendPage> ClickPriceAsync(int level)
    {
        await Page.Locator(TestId.Price(level)).ClickAsync();
        return this;
    }

    public async Task<RecommendPage> SetIncludeNoPriceAsync(bool checkedState)
    {
        if (await NoPriceCheck.IsCheckedAsync() != checkedState) await NoPriceCheck.ClickAsync();
        return this;
    }

    public async Task<RecommendPage> SetOpenNowAsync(bool checkedState)
    {
        if (await OpenNowCheck.IsCheckedAsync() != checkedState) await OpenNowCheck.ClickAsync();
        return this;
    }

    public async Task<RecommendPage> SelectPreferredLocationAsync()
    {
        await LocPrefRadio.ClickAsync();
        return this;
    }

    /// <summary>Selects the "other location" option and types a location.</summary>
    public async Task<RecommendPage> SelectOtherLocationAsync(string location)
    {
        await LocOtherRadio.ClickAsync();
        await LocOtherInput.FillAsync(location);
        return this;
    }

    public async Task<RecommendPage> SearchAsync()
    {
        await SearchBtn.ClickAsync();
        return this;
    }

    public Task<int> GetResultCountAsync() => ResultCards.CountAsync();

    public Task<bool> IsResultsTitleVisibleAsync() => ResultsTitle.IsVisibleAsync();

    public Task<string> GetErrorMessageAsync() => TextOrEmptyAsync(ErrorMsg);

    public Task<bool> HasErrorMessageAsync() => ErrorMsg.IsVisibleAsync();

    /// <summary>Waits until exactly <paramref name="count"/> result cards are rendered.</summary>
    public Task WaitForResultCountAsync(int count) => Expect(ResultCards).ToHaveCountAsync(count);
}
