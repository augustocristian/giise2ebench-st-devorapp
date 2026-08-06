namespace DevorApp.E2ETests.Common;

/// <summary>
/// Thrown by page objects when a required element cannot be located (e.g.
/// an index/name lookup within a dynamic list). Port of
/// epigijon.devorapp.e2e.functional.common.ElementNotFoundException.
///
/// Unlike the Java suite, ordinary locator actions (Click/Fill) never need
/// this here: Playwright's <see cref="Microsoft.Playwright.ILocator"/>
/// already auto-waits and raises a descriptive TimeoutException with its
/// own diagnostics if an element never becomes actionable. This exception
/// is reserved for explicit "not found in this list/index" business logic.
/// </summary>
public class ElementNotFoundException : Exception
{
    public ElementNotFoundException(string message) : base(message)
    {
    }
}
