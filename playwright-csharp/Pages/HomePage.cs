using Microsoft.Playwright;
using DevorApp.E2ETests.Common;

namespace DevorApp.E2ETests.Pages;

/// <summary>Page object for /home. Ready once the URL contains /home and the top bar is visible.</summary>
public class HomePage : BasePage
{
    private ILocator TopBar => Page.Locator(TestId.Of("topbar"));

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
