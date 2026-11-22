namespace DevorApp.E2ETests.Common;

/// <summary>
/// Selector factory for the frontend <c>data-testid</c> contract (see cypress-js/TESTIDS.md).
/// Page objects locate elements only through these selectors or element ids.
/// </summary>
public static class TestId
{
    /// <summary>Selector for a plain test id, e.g. <c>login-submit</c>.</summary>
    public static string Of(string id) => $"[data-testid='{id}']";

    /// <summary>Selector for ids built from a prefix and a number, e.g. <c>price-2</c>.</summary>
    public static string Indexed(string prefix, int n) => Of($"{prefix}-{n}");

    /// <summary>Price level button, 1 (cheapest) to 4.</summary>
    public static string Price(int level) => Indexed("price", level);

    /// <summary>Star <paramref name="n"/> (1-5) of a rating aspect: quality, price, hygiene or service.</summary>
    public static string RatingStar(string aspect, int n) => Indexed($"rating-star-{aspect}", n);

    /// <summary>Side menu entry: home, recommend, favorites, saved, history, ratings, profile or logout.</summary>
    public static string SideMenu(string entry) => Of($"side-menu-{entry}");

    /// <summary>History card menu entry: details, rechoose, favorite, rate or delete.</summary>
    public static string HistoryMenu(string action) => Of($"history-menu-{action}");

    /// <summary>Cuisine dropdown option for a tag id from the frontend tags.json.</summary>
    public static string CuisineOption(string tagId) => Of($"cuisine-option-{tagId}");

    /// <summary>Profile card: personal, location, email, security or danger.</summary>
    public static string ProfileCard(string card) => Of($"profile-card-{card}");

    /// <summary>Toast of a type: success, error, info or warning.</summary>
    public static string Toast(string type) => Of($"toast-{type}");
}
