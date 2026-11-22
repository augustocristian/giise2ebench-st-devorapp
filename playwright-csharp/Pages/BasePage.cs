using Microsoft.Playwright;
using DevorApp.E2ETests.Common;

namespace DevorApp.E2ETests.Pages;

/// <summary>
/// Base class for the page objects. Locator actions already auto-wait, so pages call them directly.
/// </summary>
public abstract class BasePage
{
    protected readonly IPage Page;

    protected BasePage(IPage page)
    {
        Page = page;
    }

    /// <summary>Page-specific readiness wait. Constructors cannot be async, so each page exposes a
    /// <c>CreateAsync</c> factory that calls <see cref="InitAsync{T}"/>.</summary>
    protected virtual Task WaitReadyAsync() => Task.CompletedTask;

    protected static async Task<T> InitAsync<T>(T instance) where T : BasePage
    {
        await instance.WaitReadyAsync();
        return instance;
    }

    /// <summary>Locator for a <c>data-testid</c> value.</summary>
    protected ILocator ByTestId(string id) => Page.Locator(TestId.Of(id));

    /// <summary>Locator matching any of the given selectors (CSS union).</summary>
    protected ILocator AnyOf(params string[] selectors) => Page.Locator(string.Join(", ", selectors));

    /// <summary>Text of the first match, or "" when there is none.</summary>
    protected static async Task<string> TextOrEmptyAsync(ILocator locator) =>
        await locator.CountAsync() == 0 ? "" : (await locator.First.TextContentAsync() ?? "");

    /// <summary>Waits until the locator is hidden or absent.</summary>
    protected static Task WaitHiddenAsync(ILocator locator) =>
        locator.First.WaitForAsync(new LocatorWaitForOptions { State = WaitForSelectorState.Hidden });
}
