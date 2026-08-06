package epigijon.devorapp.e2e.functional.pages;

import epigijon.devorapp.e2e.functional.common.ElementNotFoundException;
import epigijon.devorapp.e2e.functional.utils.Click;
import epigijon.devorapp.e2e.functional.utils.Waiter;
import org.openqa.selenium.By;
import org.openqa.selenium.WebDriver;
import org.openqa.selenium.WebElement;

import java.util.List;

/**
 * Page object for {@code /history}.
 *
 * <p>The history page groups visited restaurants by month. Each group
 * ({@code .history-group-header}) can be expanded or collapsed; only the
 * most-recent group is expanded by default.
 */
public class HistoryPage extends BasePage {

    private static final By GROUP_TITLES  = By.cssSelector(".history-group-title");
    private static final By GROUP_HEADERS = By.cssSelector(".history-group-header");
    private static final By CARDS         = By.cssSelector(".restaurant-compact-card");
    private static final By SEARCH_INPUT  = By.cssSelector("input[placeholder='Buscar en historial...']");
    private static final By COUNT_BADGE   = By.cssSelector("[class*='count'], .history-count");

    public HistoryPage(WebDriver driver, Waiter waiter) {
        super(driver, waiter);
        waiter.waitForHistoryPage();
        // Wait for loading spinner to disappear
        waiter.waitUntil(org.openqa.selenium.support.ui.ExpectedConditions.invisibilityOfElementLocated(
                By.cssSelector(".loading-spinner")), "History loading spinner did not disappear");
    }

    // ── Month groups ──────────────────────────────────────────────────────────

    /** Returns the number of visible month group titles. */
    public int getGroupCount() {
        return driver.findElements(GROUP_TITLES).size();
    }

    /** Returns the text of the month group title at the given 0-based index. */
    public String getGroupTitleAt(int index) {
        List<WebElement> titles = driver.findElements(GROUP_TITLES);
        return index < titles.size() ? titles.get(index).getText() : "";
    }

    /** Returns {@code true} if a group title containing {@code text} is visible. */
    public boolean isGroupVisible(String text) {
        return driver.findElements(GROUP_TITLES).stream()
                .anyMatch(el -> el.getText().contains(text));
    }

    /**
     * Clicks the group header whose title contains {@code monthText} to
     * expand/collapse it (e.g. "MAYO 2026").
     */
    public HistoryPage toggleGroup(String monthText) throws ElementNotFoundException {
        WebElement header = driver.findElements(GROUP_HEADERS).stream()
                .filter(el -> el.getText().contains(monthText))
                .findFirst()
                .orElseThrow(() -> new ElementNotFoundException("Group header not found: " + monthText));
        Click.element(driver, waiter, header);
        return this;
    }

    // ── Restaurant cards ──────────────────────────────────────────────────────

    /** Returns the number of currently visible restaurant cards. */
    public int getCardCount() {
        return driver.findElements(CARDS).size();
    }

    /** Returns the name text of the card at the given 0-based index. */
    public String getCardNameAt(int index) {
        List<WebElement> cards = driver.findElements(CARDS);
        if (index >= cards.size()) return "";
        List<WebElement> names = cards.get(index).findElements(By.cssSelector(".compact-name"));
        return names.isEmpty() ? "" : names.get(0).getText();
    }

    /**
     * Opens the three-dot menu of the card at the given index.
     * The first button inside the card is assumed to be the menu trigger.
     */
    public HistoryPage openCardMenu(int index) throws ElementNotFoundException {
        List<WebElement> cards = driver.findElements(CARDS);
        if (index >= cards.size()) throw new ElementNotFoundException("Card at index " + index + " not found");
        WebElement menuBtn = cards.get(index).findElements(By.tagName("button")).get(0);
        Click.element(driver, waiter, menuBtn);
        return this;
    }

    // ── Search ────────────────────────────────────────────────────────────────

    /** Types a search term in the history search input. */
    public HistoryPage search(String query) {
        fill(SEARCH_INPUT, query);
        return this;
    }
}
