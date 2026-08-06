using Microsoft.Playwright;
using DevorApp.E2ETests.Common;

namespace DevorApp.E2ETests.Pages;

/// <summary>
/// Page object for the Favorites page (/favorites). Port of
/// epigijon.devorapp.e2e.functional.pages.FavoritesPage.
/// </summary>
public class FavoritesPage : BasePage
{
    private ILocator ListCards => Page.Locator(".fav-list-card");
    private ILocator RestaurantCards => Page.Locator(".restaurant-compact-card");
    private ILocator EmptyListsText => ByXPath("//*[contains(text(), 'Aún no tienes listas')]");
    private ILocator EmptyDetailText => ByXPath("//*[contains(text(), 'Esta lista está vacía')]");
    private ILocator SearchInput => Page.Locator("input[placeholder='Buscar en esta lista...']");
    private ILocator LoadingSpinner => Page.Locator(".loading-spinner");
    private ILocator DetailLoadingSpinner => Page.Locator(".fav-detail-view .loading-spinner");

    private FavoritesPage(IPage page) : base(page)
    {
    }

    public static Task<FavoritesPage> CreateAsync(IPage page) => InitAsync(new FavoritesPage(page));

    protected override async Task WaitReadyAsync()
    {
        await AnyOf(".fav-list-card", "xpath=//*[contains(text(),'Aún no tienes listas')]",
            ".favorites-container, .fav-page").First.WaitForAsync();
        // Wait for main loading spinner to disappear
        await LoadingSpinner.WaitForAsync(new LocatorWaitForOptions { State = WaitForSelectorState.Hidden });
    }

    public Task<int> GetListCountAsync() => ListCards.CountAsync();

    public async Task OpenListAtAsync(int index)
    {
        var count = await ListCards.CountAsync();
        if (index < 0 || index >= count)
            throw new ElementNotFoundException($"Favorites list card not found at index: {index}");
        await ListCards.Nth(index).ClickAsync();
        // Wait for list detail view search input to appear
        await SearchInput.WaitForAsync();
        // Wait for list detail loading spinner to disappear
        await DetailLoadingSpinner.WaitForAsync(new LocatorWaitForOptions { State = WaitForSelectorState.Hidden });
    }

    public async Task OpenListByNameAsync(string name)
    {
        var target = ListCards.Filter(ContainsTextIgnoreCaseFilter(name));
        if (await target.CountAsync() == 0)
            throw new ElementNotFoundException($"Favorites list card not found with name: {name}");
        await target.First.ClickAsync();
        await SearchInput.WaitForAsync();
        await DetailLoadingSpinner.WaitForAsync(new LocatorWaitForOptions { State = WaitForSelectorState.Hidden });
    }

    public Task<int> GetRestaurantCountAsync() => RestaurantCards.CountAsync();

    public Task<bool> IsEmptyStateVisibleAsync() => EmptyListsText.IsVisibleAsync();

    public Task<bool> IsDetailEmptyStateVisibleAsync() => EmptyDetailText.IsVisibleAsync();

    public Task SearchWithinAsync(string text) => SearchInput.FillAsync(text);
}
