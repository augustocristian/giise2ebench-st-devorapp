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

/** Page object for {@code /favorites}. */
public class FavoritesPage extends BasePage {

    private static final By LIST_CARDS        = TestId.of("favorites-list-card");
    private static final By LIST_NAME         = TestId.of("favorites-list-name");
    private static final By LIST_OPEN         = TestId.of("favorites-list-open");
    private static final By RESTAURANT_CARDS  = TestId.of("restaurant-card");
    private static final By EMPTY_LISTS       = TestId.of("favorites-empty");
    private static final By EMPTY_DETAIL      = TestId.of("favorites-detail-empty");
    private static final By SEARCH_INPUT      = TestId.of("favorites-search");
    private static final By LOADING           = TestId.of("favorites-loading");
    private static final By DETAIL_LOADING    = TestId.of("favorites-detail-loading");

    public FavoritesPage(WebDriver driver, Waiter waiter) {
        super(driver, waiter);
        waiter.waitForFavoritesPage();
        waiter.waitUntil(ExpectedConditions.invisibilityOfElementLocated(LOADING),
                "Favorites page loading spinner did not disappear");
    }

    public int getListCount() {
        return driver.findElements(LIST_CARDS).size();
    }

    public void openListAt(int index) throws ElementNotFoundException {
        List<WebElement> lists = driver.findElements(LIST_CARDS);
        if (index < 0 || index >= lists.size()) {
            throw new ElementNotFoundException("Favorites list card not found at index: " + index);
        }
        openList(lists.get(index));
    }

    public void openListByName(String name) throws ElementNotFoundException {
        WebElement target = driver.findElements(LIST_CARDS).stream()
                .filter(card -> card.findElement(LIST_NAME).getText().toLowerCase().contains(name.toLowerCase()))
                .findFirst()
                .orElseThrow(() -> new ElementNotFoundException("Favorites list card not found with name: " + name));
        openList(target);
    }

    private void openList(WebElement card) throws ElementNotFoundException {
        Click.element(driver, waiter, card.findElement(LIST_OPEN));
        waiter.waitUntil(ExpectedConditions.visibilityOfElementLocated(SEARCH_INPUT),
                "Search input in list detail did not appear");
        waiter.waitUntil(ExpectedConditions.invisibilityOfElementLocated(DETAIL_LOADING),
                "Detail loading spinner did not disappear");
    }

    public int getRestaurantCount() {
        return driver.findElements(RESTAURANT_CARDS).size();
    }

    public boolean isEmptyStateVisible() {
        return isVisible(EMPTY_LISTS);
    }

    public boolean isDetailEmptyStateVisible() {
        return isVisible(EMPTY_DETAIL);
    }

    public void searchWithin(String text) {
        fill(SEARCH_INPUT, text);
    }
}
