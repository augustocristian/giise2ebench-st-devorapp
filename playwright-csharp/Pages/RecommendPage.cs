using Microsoft.Playwright;
using DevorApp.E2ETests.Common;
using static Microsoft.Playwright.Assertions;

namespace DevorApp.E2ETests.Pages;

/// <summary>
/// Page object for /recommend-restaurants. Port of
/// epigijon.devorapp.e2e.functional.pages.RecommendPage.
///
/// Covers the search form (categories, price levels, boolean toggles,
/// location selector) and the results panel (suggestion cards).
/// </summary>
public class RecommendPage : BasePage
{
    // Filters
    private ILocator CategoryInput => Page.Locator("input[placeholder='+ Añadir tipo de cocina...']");
    private ILocator SearchBtn => ByXPath("//button[contains(.,'Buscar recomendaciones')]");
    private ILocator LocPrefRadio => ByXPath("//label[contains(.,'Usar ubicación preferida')]//input");
    private ILocator LocOtherRadio => ByXPath("//label[contains(.,'Escoger otra ubicación')]//input");
    private ILocator LocOtherInput => Page.Locator("input[placeholder='Ej. Madrid, Barcelona...']");
    private ILocator NoPriceCheck => ByXPath("//label[contains(.,'Incluir sitios sin precio confirmado')]//input");
    private ILocator OpenNowCheck => ByXPath("//label[contains(.,'Solo lugares abiertos ahora')]//input");
    private ILocator PrefLocLabel => ByXPath("//label[contains(.,'Usar ubicación preferida')]");

    // Results
    private ILocator ResultCards => Page.Locator(".suggestion-card");
    private ILocator ResultsTitle => ByXPath("//*[contains(text(),'Sugerencias para ti')]");
    private ILocator ErrorMsg => Page.Locator(".message.error");

    private RecommendPage(IPage page) : base(page)
    {
    }

    public static Task<RecommendPage> CreateAsync(IPage page) => InitAsync(new RecommendPage(page));

    protected override async Task WaitReadyAsync()
    {
        await SearchBtn.WaitForAsync();
        await PrefLocLabel.WaitForAsync();
        // Wait until the preferred-location label no longer shows the placeholder "Desconocida"
        await Expect(PrefLocLabel).Not.ToContainTextAsync("Desconocida");
    }

    // ── Category tags ────────────────────────────────────────────────────────

    /// <summary>Adds a cuisine category by typing <paramref name="query"/>
    /// in the autocomplete input and clicking the option containing
    /// <paramref name="optionLabel"/>.</summary>
    public async Task<RecommendPage> AddCategoryAsync(string query, string optionLabel)
    {
        await CategoryInput.ClickAsync();
        await CategoryInput.FillAsync(query);

        // The dropdown renders sibling div options next to the input
        var option = ByXPath(
            "//input[@placeholder='+ Añadir tipo de cocina...']" +
            $"/following-sibling::div//div[contains(text(),'{optionLabel}')]");
        await option.WaitForAsync();
        await option.ClickAsync();
        return this;
    }

    // ── Price levels ─────────────────────────────────────────────────────────

    /// <summary>Clicks the price button with the given label (e.g. "€", "€€", "€€€").</summary>
    public async Task<RecommendPage> ClickPriceAsync(string label)
    {
        var button = Page.Locator("button").Filter(ExactTextFilter(label));
        if (await button.CountAsync() == 0)
            throw new ElementNotFoundException($"Price button '{label}' not found");
        await button.First.ClickAsync();
        return this;
    }

    // ── Boolean toggles ──────────────────────────────────────────────────────

    /// <summary>Sets the "Incluir sitios sin precio confirmado" checkbox to <paramref name="checkedState"/>.</summary>
    public async Task<RecommendPage> SetIncludeNoPriceAsync(bool checkedState)
    {
        if (await NoPriceCheck.IsCheckedAsync() != checkedState) await NoPriceCheck.ClickAsync();
        return this;
    }

    /// <summary>Sets the "Solo lugares abiertos ahora" checkbox to <paramref name="checkedState"/>.</summary>
    public async Task<RecommendPage> SetOpenNowAsync(bool checkedState)
    {
        if (await OpenNowCheck.IsCheckedAsync() != checkedState) await OpenNowCheck.ClickAsync();
        return this;
    }

    // ── Location ─────────────────────────────────────────────────────────────

    /// <summary>Selects "Usar ubicación preferida".</summary>
    public async Task<RecommendPage> SelectPreferredLocationAsync()
    {
        await LocPrefRadio.ClickAsync();
        return this;
    }

    /// <summary>Selects "Escoger otra ubicación" and types a location string.</summary>
    public async Task<RecommendPage> SelectOtherLocationAsync(string location)
    {
        await LocOtherRadio.ClickAsync();
        await LocOtherInput.FillAsync(location);
        return this;
    }

    // ── Search ───────────────────────────────────────────────────────────────

    /// <summary>Clicks "Buscar recomendaciones".</summary>
    public async Task<RecommendPage> SearchAsync()
    {
        await SearchBtn.ClickAsync();
        return this;
    }

    // ── Results ──────────────────────────────────────────────────────────────

    /// <summary>Returns the number of result suggestion-cards shown.</summary>
    public Task<int> GetResultCountAsync() => ResultCards.CountAsync();

    /// <summary>Returns true if the "Sugerencias para ti" title is visible.</summary>
    public Task<bool> IsResultsTitleVisibleAsync() => ResultsTitle.IsVisibleAsync();

    /// <summary>Returns the text of the visible error message, or empty string.</summary>
    public Task<string> GetErrorMessageAsync() => TextOrEmptyAsync(ErrorMsg);

    /// <summary>Returns true if a validation error message is visible.</summary>
    public Task<bool> HasErrorMessageAsync() => ErrorMsg.IsVisibleAsync();
}
