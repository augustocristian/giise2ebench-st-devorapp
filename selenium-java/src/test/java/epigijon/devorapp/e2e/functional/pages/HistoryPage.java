package epigijon.devorapp.e2e.functional.pages;

import epigijon.devorapp.e2e.functional.common.ElementNotFoundException;
import epigijon.devorapp.e2e.functional.common.TestId;
import epigijon.devorapp.e2e.functional.utils.Click;
import epigijon.devorapp.e2e.functional.utils.Waiter;
import org.openqa.selenium.By;
import org.openqa.selenium.WebDriver;
import org.openqa.selenium.WebElement;
import org.openqa.selenium.support.ui.ExpectedConditions;

import java.util.List;

/** Page object for {@code /history}: restaurants grouped by month; only the newest group starts expanded. */
public class HistoryPage extends BasePage {

    private static final By GROUP_TITLES  = TestId.of("history-group-title");
    private static final By GROUP_HEADERS = TestId.of("history-group-header");
    private static final By CARDS         = TestId.of("restaurant-card");
    private static final By CARD_NAME     = TestId.of("restaurant-card-name");
    private static final By CARD_MENU     = TestId.of("history-card-menu");
    private static final By SEARCH_INPUT  = TestId.of("history-search");
    private static final By LOADING       = TestId.of("history-loading");

    public HistoryPage(WebDriver driver, Waiter waiter) {
        super(driver, waiter);
        waiter.waitForHistoryPage();
        waiter.waitUntil(ExpectedConditions.invisibilityOfElementLocated(LOADING),
                "History loading spinner did not disappear");
    }

    public int getGroupCount() {
        return driver.findElements(GROUP_TITLES).size();
    }

    public String getGroupTitleAt(int index) {
        List<WebElement> titles = driver.findElements(GROUP_TITLES);
        return index < titles.size() ? titles.get(index).getText() : "";
    }

    public boolean isGroupVisible(String text) {
        return driver.findElements(GROUP_TITLES).stream()
                .anyMatch(el -> el.getText().contains(text));
    }

    /** Expands/collapses the group whose header contains {@code monthText} (e.g. "MAYO 2026"). */
    public HistoryPage toggleGroup(String monthText) throws ElementNotFoundException {
        waiter.waitUntil(d -> d.findElements(GROUP_HEADERS).stream().anyMatch(el -> el.getText().contains(monthText)),
                "Group header not found: " + monthText);
        WebElement header = driver.findElements(GROUP_HEADERS).stream()
                .filter(el -> el.getText().contains(monthText))
                .findFirst()
                .orElseThrow(() -> new ElementNotFoundException("Group header not found: " + monthText));
        Click.element(driver, waiter, header);
        return this;
    }

    public int getCardCount() {
        return driver.findElements(CARDS).size();
    }

    public String getCardNameAt(int index) {
        List<WebElement> cards = driver.findElements(CARDS);
        if (index >= cards.size()) return "";
        List<WebElement> names = cards.get(index).findElements(CARD_NAME);
        return names.isEmpty() ? "" : names.get(0).getText();
    }

    public HistoryPage openCardMenu(int index) throws ElementNotFoundException {
        List<WebElement> cards = driver.findElements(CARDS);
        if (index >= cards.size()) throw new ElementNotFoundException("Card at index " + index + " not found");
        Click.element(driver, waiter, cards.get(index).findElement(CARD_MENU));
        return this;
    }

    /** Clicks an entry of the open card menu: details, rechoose, favorite, rate or delete. */
    public HistoryPage chooseMenuAction(String action) throws ElementNotFoundException {
        By locator = TestId.of("history-menu-" + action);
        waiter.waitUntil(ExpectedConditions.elementToBeClickable(locator),
                "History menu action '" + action + "' did not appear");
        click(locator);
        return this;
    }

    public HistoryPage search(String query) {
        fill(SEARCH_INPUT, query);
        return this;
    }
}
