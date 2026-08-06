using Microsoft.Playwright;

namespace DevorApp.E2ETests.Pages;

/// <summary>
/// Page object for /home. Port of
/// epigijon.devorapp.e2e.functional.pages.HomePage. <c>CreateAsync</c>
/// waits until the URL contains /home and the top navigation bar is
/// visible before returning.
/// </summary>
public class HomePage : BasePage
{
    private ILocator TopBar => Page.Locator(".topbar, header, nav");

    private HomePage(IPage page) : base(page)
    {
    }

    public static Task<HomePage> CreateAsync(IPage page) => InitAsync(new HomePage(page));

    protected override async Task WaitReadyAsync()
    {
        await Page.WaitForURLAsync(url => url.Contains("/home"));
        await TopBar.WaitForAsync();
    }

    public Task<bool> IsTopBarVisibleAsync() => TopBar.IsVisibleAsync();

    public string GetCurrentUrl() => Page.Url;
}
