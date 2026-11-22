using Microsoft.Playwright;
using DevorApp.E2ETests.Common;

namespace DevorApp.E2ETests.Pages;

/// <summary>
/// Page object for /history. Visited restaurants are grouped by month; each group header expands or
/// collapses its cards (only the most recent group starts expanded).
/// </summary>
public class HistoryPage : BasePage
{
    private ILocator GroupTitles => ByTestId("history-group-title");
    private ILocator GroupHeaders => ByTestId("history-group-header");
    private ILocator Cards => ByTestId("restaurant-card");
    private ILocator SearchInput => ByTestId("history-search");
    private ILocator Loading => ByTestId("history-loading");

    private HistoryPage(IPage page) : base(page)
    {
    }

    public static Task<HistoryPage> CreateAsync(IPage page) => InitAsync(new HistoryPage(page));

    protected override async Task WaitReadyAsync()
    {
        await AnyOf(TestId.Of("history-group-title"), TestId.Of("history-search")).First.WaitForAsync();
        await WaitHiddenAsync(Loading);
    }

    public Task<int> GetGroupCountAsync() => GroupTitles.CountAsync();

    public async Task<string> GetGroupTitleAtAsync(int index)
    {
        var count = await GroupTitles.CountAsync();
        return index < count ? (await GroupTitles.Nth(index).TextContentAsync() ?? "") : "";
    }

    public async Task<bool> IsGroupVisibleAsync(string text) =>
        await GroupTitles.Filter(new LocatorFilterOptions { HasText = text }).CountAsync() > 0;

    /// <summary>Expands or collapses the group whose header contains <paramref name="monthText"/>
    /// (e.g. "MAYO 2026").</summary>
    public async Task<HistoryPage> ToggleGroupAsync(string monthText)
    {
        var header = GroupHeaders.Filter(new LocatorFilterOptions { HasText = monthText });
        await header.First.WaitForAsync();
        await header.First.ClickAsync();
        return this;
    }

    public Task<int> GetCardCountAsync() => Cards.CountAsync();

    public async Task<string> GetCardNameAtAsync(int index)
    {
        var count = await Cards.CountAsync();
        if (index >= count) return "";
        return await TextOrEmptyAsync(Cards.Nth(index).Locator(TestId.Of("restaurant-card-name")));
    }

    /// <summary>Opens the three-dot menu of the card at <paramref name="index"/>.</summary>
    public async Task<HistoryPage> OpenCardMenuAsync(int index)
    {
        var count = await Cards.CountAsync();
        if (index >= count) throw new ElementNotFoundException($"Card at index {index} not found");
        await Cards.Nth(index).Locator(TestId.Of("history-card-menu")).ClickAsync();
        return this;
    }

    /// <summary>Clicks an entry of the open card menu: details, rechoose, favorite, rate or delete.</summary>
    public async Task<HistoryPage> ChooseMenuActionAsync(string action)
    {
        await Page.Locator(TestId.HistoryMenu(action)).ClickAsync();
        return this;
    }

    public async Task<HistoryPage> SearchAsync(string query)
    {
        await SearchInput.FillAsync(query);
        return this;
    }
}
