using Microsoft.Playwright;
using DevorApp.E2ETests.Common;

namespace DevorApp.E2ETests.Pages;

/// <summary>
/// Page object for /history. Port of
/// epigijon.devorapp.e2e.functional.pages.HistoryPage.
///
/// The history page groups visited restaurants by month. Each group
/// (.history-group-header) can be expanded or collapsed; only the
/// most-recent group is expanded by default.
/// </summary>
public class HistoryPage : BasePage
{
    private ILocator GroupTitles => Page.Locator(".history-group-title");
    private ILocator GroupHeaders => Page.Locator(".history-group-header");
    private ILocator Cards => Page.Locator(".restaurant-compact-card");
    private ILocator SearchInput => Page.Locator("input[placeholder='Buscar en historial...']");
    private ILocator LoadingSpinner => Page.Locator(".loading-spinner");

    private HistoryPage(IPage page) : base(page)
    {
    }

    public static Task<HistoryPage> CreateAsync(IPage page) => InitAsync(new HistoryPage(page));

    protected override async Task WaitReadyAsync()
    {
        await AnyOf(".history-group-title", "input[placeholder='Buscar en historial...']",
            ".history-container, .history-page").First.WaitForAsync();
        await LoadingSpinner.WaitForAsync(new LocatorWaitForOptions { State = WaitForSelectorState.Hidden });
    }

    // ── Month groups ─────────────────────────────────────────────────────────

    /// <summary>Returns the number of visible month group titles.</summary>
    public Task<int> GetGroupCountAsync() => GroupTitles.CountAsync();

    /// <summary>Returns the text of the month group title at the given 0-based index.</summary>
    public async Task<string> GetGroupTitleAtAsync(int index)
    {
        var count = await GroupTitles.CountAsync();
        return index < count ? (await GroupTitles.Nth(index).TextContentAsync() ?? "") : "";
    }

    /// <summary>Returns true if a group title containing <paramref name="text"/> is visible.</summary>
    public async Task<bool> IsGroupVisibleAsync(string text) =>
        await GroupTitles.Filter(ContainsTextFilter(text)).CountAsync() > 0;

    /// <summary>Clicks the group header whose title contains
    /// <paramref name="monthText"/> to expand/collapse it (e.g. "MAYO 2026").</summary>
    public async Task<HistoryPage> ToggleGroupAsync(string monthText)
    {
        var header = GroupHeaders.Filter(ContainsTextFilter(monthText));
        if (await header.CountAsync() == 0)
            throw new ElementNotFoundException($"Group header not found: {monthText}");
        await header.First.ClickAsync();
        return this;
    }

    // ── Restaurant cards ─────────────────────────────────────────────────────

    /// <summary>Returns the number of currently visible restaurant cards.</summary>
    public Task<int> GetCardCountAsync() => Cards.CountAsync();

    /// <summary>Returns the name text of the card at the given 0-based index.</summary>
    public async Task<string> GetCardNameAtAsync(int index)
    {
        var count = await Cards.CountAsync();
        if (index >= count) return "";
        return await TextOrEmptyAsync(Cards.Nth(index).Locator(".compact-name"));
    }

    /// <summary>Opens the three-dot menu of the card at the given index.
    /// The first button inside the card is assumed to be the menu trigger.</summary>
    public async Task<HistoryPage> OpenCardMenuAsync(int index)
    {
        var count = await Cards.CountAsync();
        if (index >= count) throw new ElementNotFoundException($"Card at index {index} not found");
        await Cards.Nth(index).Locator("button").First.ClickAsync();
        return this;
    }

    // ── Search ───────────────────────────────────────────────────────────────

    /// <summary>Types a search term in the history search input.</summary>
    public async Task<HistoryPage> SearchAsync(string query)
    {
        await SearchInput.FillAsync(query);
        return this;
    }
}
