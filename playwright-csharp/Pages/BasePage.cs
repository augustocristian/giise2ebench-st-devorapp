using System.Text.RegularExpressions;
using Microsoft.Playwright;

namespace DevorApp.E2ETests.Pages;

/// <summary>
/// Base class for all DevorApp page objects. Port of
/// epigijon.devorapp.e2e.functional.pages.BasePage.
///
/// Playwright's <see cref="ILocator"/> actions (ClickAsync, FillAsync, ...)
/// already auto-wait for the target to be visible, stable, and receiving
/// events before acting, and auto-retry on transient failures — so, unlike
/// the Java suite, this port has no equivalent of its Waiter/Click utility
/// classes: concrete pages just call locator methods directly.
/// </summary>
public abstract class BasePage
{
    protected readonly IPage Page;

    protected BasePage(IPage page)
    {
        Page = page;
    }

    /// <summary>Runs the page-specific readiness wait. Overridden by
    /// subclasses; no-op by default. Called by each concrete page's
    /// <c>CreateAsync</c> factory (via <see cref="InitAsync{T}"/>),
    /// mirroring the blocking-constructor pattern of the Java page objects
    /// (<c>new LoginPage(driver, waiter)</c> etc.) — C# constructors can't
    /// be asynchronous, so an async factory takes their place.</summary>
    protected virtual Task WaitReadyAsync() => Task.CompletedTask;

    /// <summary>Shared factory helper: builds <paramref name="instance"/>,
    /// waits for it to be ready, then returns it. Concrete pages each add a
    /// one-line <c>public static Task&lt;XxxPage&gt; CreateAsync(IPage page)</c>
    /// that calls this.</summary>
    protected static async Task<T> InitAsync<T>(T instance) where T : BasePage
    {
        await instance.WaitReadyAsync();
        return instance;
    }

    /// <summary>Builds an XPath-based locator, equivalent to Selenium's <c>By.xpath(...)</c>.</summary>
    protected ILocator ByXPath(string expression) => Page.Locator("xpath=" + expression);

    /// <summary>A single locator that matches if ANY of the given selectors
    /// match (Playwright resolves comma-separated selector lists as a
    /// union) — equivalent to Selenium's <c>ExpectedConditions.or(...)</c>.</summary>
    protected ILocator AnyOf(params string[] selectors) => Page.Locator(string.Join(", ", selectors));

    /// <summary>Filter options for a case-sensitive substring match,
    /// equivalent to Java's <c>element.getText().contains(text)</c>.</summary>
    protected static LocatorFilterOptions ContainsTextFilter(string text) =>
        new() { HasTextRegex = new Regex(Regex.Escape(text)) };

    /// <summary>Filter options for a case-insensitive substring match,
    /// equivalent to Java's <c>element.getText().toLowerCase().contains(text.toLowerCase())</c>.
    /// (Playwright's plain string <c>HasText</c> already matches case-insensitively.)</summary>
    protected static LocatorFilterOptions ContainsTextIgnoreCaseFilter(string text) =>
        new() { HasText = text };

    /// <summary>Filter options for an exact, whitespace-trimmed match,
    /// equivalent to Java's <c>element.getText().trim().equals(text)</c>.</summary>
    protected static LocatorFilterOptions ExactTextFilter(string text) =>
        new() { HasTextRegex = new Regex($"^\\s*{Regex.Escape(text)}\\s*$") };

    /// <summary>Returns the text content of the first match of
    /// <paramref name="locator"/>, or "" if it currently has no matches.
    /// Equivalent to the Java suite's repeated
    /// <c>List&lt;WebElement&gt; els = ...; return els.isEmpty() ? "" : els.get(0).getText();</c>
    /// pattern.</summary>
    protected static async Task<string> TextOrEmptyAsync(ILocator locator) =>
        await locator.CountAsync() == 0 ? "" : (await locator.First.TextContentAsync() ?? "");
}
