package epigijon.devorapp.e2e.functional.pages;

import epigijon.devorapp.e2e.functional.common.ElementNotFoundException;
import epigijon.devorapp.e2e.functional.utils.Click;
import epigijon.devorapp.e2e.functional.utils.Waiter;
import org.openqa.selenium.By;
import org.openqa.selenium.WebDriver;
import org.openqa.selenium.WebElement;

import java.util.List;

/**
 * Page object for the Favorites page (/favorites).
 */
public class FavoritesPage extends BasePage {

    private static final By LIST_CARDS = By.cssSelector(".fav-list-card");
    private static final By RESTAURANT_CARDS = By.cssSelector(".restaurant-compact-card");
    private static final By EMPTY_LISTS_TEXT = By.xpath("//*[contains(text(), 'Aún no tienes listas')]");
    private static final By EMPTY_DETAIL_TEXT = By.xpath("//*[contains(text(), 'Esta lista está vacía')]");
    private static final By SEARCH_INPUT = By.cssSelector("input[placeholder='Buscar en esta lista...']");

    public FavoritesPage(WebDriver driver, Waiter waiter) {
        super(driver, waiter);
        waiter.waitForFavoritesPage();
        // Wait for main loading spinner to disappear
        waiter.waitUntil(org.openqa.selenium.support.ui.ExpectedConditions.invisibilityOfElementLocated(
                By.cssSelector(".loading-spinner")), "Favorites page loading spinner did not disappear");
    }

    public int getListCount() {
        return driver.findElements(LIST_CARDS).size();
    }

    public void openListAt(int index) throws ElementNotFoundException {
        List<WebElement> lists = driver.findElements(LIST_CARDS);
        if (index < 0 || index >= lists.size()) {
            throw new ElementNotFoundException("Favorites list card not found at index: " + index);
        }
        Click.element(driver, waiter, lists.get(index));
        // Wait for list detail view search input to appear
        waiter.waitUntil(org.openqa.selenium.support.ui.ExpectedConditions.visibilityOfElementLocated(SEARCH_INPUT),
                "Search input in list detail did not appear");
        // Wait for list detail loading spinner to disappear
        waiter.waitUntil(org.openqa.selenium.support.ui.ExpectedConditions.invisibilityOfElementLocated(
                By.cssSelector(".fav-detail-view .loading-spinner")),
                "Detail loading spinner did not disappear");
    }

    public void openListByName(String name) throws ElementNotFoundException {
        List<WebElement> lists = driver.findElements(LIST_CARDS);
        WebElement targetList = lists.stream()
                .filter(el -> el.getText().toLowerCase().contains(name.toLowerCase()))
                .findFirst()
                .orElseThrow(() -> new ElementNotFoundException("Favorites list card not found with name: " + name));
        Click.element(driver, waiter, targetList);
        // Wait for list detail view search input to appear
        waiter.waitUntil(org.openqa.selenium.support.ui.ExpectedConditions.visibilityOfElementLocated(SEARCH_INPUT),
                "Search input in list detail did not appear");
        // Wait for list detail loading spinner to disappear
        waiter.waitUntil(org.openqa.selenium.support.ui.ExpectedConditions.invisibilityOfElementLocated(
                By.cssSelector(".fav-detail-view .loading-spinner")),
                "Detail loading spinner did not disappear");
    }

    public int getRestaurantCount() {
        return driver.findElements(RESTAURANT_CARDS).size();
    }

    public boolean isEmptyStateVisible() {
        return isVisible(EMPTY_LISTS_TEXT);
    }

    public boolean isDetailEmptyStateVisible() {
        return isVisible(EMPTY_DETAIL_TEXT);
    }

    public void searchWithin(String text) {
        fill(SEARCH_INPUT, text);
    }
}
