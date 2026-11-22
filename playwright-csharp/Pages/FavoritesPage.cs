using Microsoft.Playwright;
using DevorApp.E2ETests.Common;

namespace DevorApp.E2ETests.Pages;

/// <summary>
/// Page object for /favorites: the list overview and the detail view of one list.
/// Ready once the lists (or the empty state) are shown and the spinner is gone.
/// </summary>
public class FavoritesPage : BasePage
{
    private ILocator ListCards => ByTestId("favorites-list-card");
    private ILocator RestaurantCards => ByTestId("restaurant-card");
    private ILocator EmptyLists => ByTestId("favorites-empty");
    private ILocator EmptyDetail => ByTestId("favorites-detail-empty");
    private ILocator SearchInput => ByTestId("favorites-search");
    private ILocator Loading => ByTestId("favorites-loading");
    private ILocator DetailLoading => ByTestId("favorites-detail-loading");

    private FavoritesPage(IPage page) : base(page)
    {
    }

    public static Task<FavoritesPage> CreateAsync(IPage page) => InitAsync(new FavoritesPage(page));

    protected override async Task WaitReadyAsync()
    {
        await AnyOf(TestId.Of("favorites-list-card"), TestId.Of("favorites-empty")).First.WaitForAsync();
        await WaitHiddenAsync(Loading);
    }

    public Task<int> GetListCountAsync() => ListCards.CountAsync();

    public async Task OpenListAtAsync(int index)
    {
        var count = await ListCards.CountAsync();
        if (index < 0 || index >= count)
            throw new ElementNotFoundException($"Favorites list card not found at index: {index}");
        await OpenListAsync(ListCards.Nth(index));
    }

    /// <summary>Opens the list whose name contains <paramref name="name"/> (case-insensitive).</summary>
    public async Task OpenListByNameAsync(string name)
    {
        var target = ListCards.Filter(new LocatorFilterOptions { Has = ByTestId("favorites-list-name").Filter(new LocatorFilterOptions { HasText = name }) });
        if (await target.CountAsync() == 0)
            throw new ElementNotFoundException($"Favorites list card not found with name: {name}");
        await OpenListAsync(target.First);
    }

    private async Task OpenListAsync(ILocator card)
    {
        await card.Locator(TestId.Of("favorites-list-open")).ClickAsync();
        await SearchInput.WaitForAsync();
        await WaitHiddenAsync(DetailLoading);
    }

    public Task<int> GetRestaurantCountAsync() => RestaurantCards.CountAsync();

    public Task<bool> IsEmptyStateVisibleAsync() => EmptyLists.IsVisibleAsync();

    public Task<bool> IsDetailEmptyStateVisibleAsync() => EmptyDetail.IsVisibleAsync();

    public Task SearchWithinAsync(string text) => SearchInput.FillAsync(text);
}
