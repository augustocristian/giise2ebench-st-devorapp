namespace DevorApp.E2ETests.Common;

/// <summary>
/// Thrown by page objects when an item cannot be found in a dynamic list (by index or name).
/// Plain locator actions do not need it: Playwright auto-waits and times out with its own message.
/// </summary>
public class ElementNotFoundException : Exception
{
    public ElementNotFoundException(string message) : base(message)
    {
    }
}
