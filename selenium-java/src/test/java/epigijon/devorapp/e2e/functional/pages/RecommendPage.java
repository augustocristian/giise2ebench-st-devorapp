package epigijon.devorapp.e2e.functional.pages;

import epigijon.devorapp.e2e.functional.common.ElementNotFoundException;
import epigijon.devorapp.e2e.functional.common.TestId;
import epigijon.devorapp.e2e.functional.utils.Click;
import epigijon.devorapp.e2e.functional.utils.Waiter;
import org.openqa.selenium.By;
import org.openqa.selenium.WebDriver;
import org.openqa.selenium.WebElement;
import org.openqa.selenium.support.ui.ExpectedConditions;

/** Page object for {@code /recommend-restaurants}: search form and results panel. */
public class RecommendPage extends BasePage {

    private static final By CATEGORY_INPUT  = TestId.of("recommend-cuisine-input");
    private static final By SEARCH_BTN      = TestId.of("recommend-submit");
    private static final By LOC_PREF_RADIO  = TestId.of("recommend-location-preferred");
    private static final By LOC_OTHER_RADIO = TestId.of("recommend-location-custom");
    private static final By LOC_OTHER_INPUT = TestId.of("recommend-location-input");
    private static final By NO_PRICE_CHECK  = TestId.of("recommend-include-no-price");
    private static final By OPEN_NOW_CHECK  = TestId.of("recommend-open-now");

    private static final By RESULT_CARDS    = TestId.of("recommend-result-card");
    private static final By RESULTS_TITLE   = TestId.of("recommend-results-title");
    private static final By ERROR_MSG       = TestId.of("recommend-error");

    public RecommendPage(WebDriver driver, Waiter waiter) {
        super(driver, waiter);
        waiter.waitForRecommendPage();
    }

    /**
     * Types {@code query} in the cuisine input and picks the dropdown option for {@code tagId}
     * (id from {@code tags.json}, e.g. {@code mexican_restaurant}).
     */
    public RecommendPage addCategory(String query, String tagId) throws ElementNotFoundException {
        WebElement input = driver.findElement(CATEGORY_INPUT);
        Click.element(driver, waiter, input);
        input.clear();
        input.sendKeys(query);

        By option = TestId.of("cuisine-option-" + tagId);
        waiter.waitUntil(ExpectedConditions.visibilityOfElementLocated(option),
                "Cuisine option '" + tagId + "' did not appear");
        click(option);
        return this;
    }

    /** @param level 1 (cheapest) to 4 */
    public RecommendPage clickPrice(int level) throws ElementNotFoundException {
        click(TestId.ofIndexed("price", level));
        return this;
    }

    public RecommendPage setIncludeNoPrice(boolean checked) {
        WebElement cb = driver.findElement(NO_PRICE_CHECK);
        if (cb.isSelected() != checked) cb.click();
        return this;
    }

    public RecommendPage setOpenNow(boolean checked) {
        WebElement cb = driver.findElement(OPEN_NOW_CHECK);
        if (cb.isSelected() != checked) cb.click();
        return this;
    }

    public RecommendPage selectPreferredLocation() throws ElementNotFoundException {
        click(LOC_PREF_RADIO);
        return this;
    }

    public RecommendPage selectOtherLocation(String location) throws ElementNotFoundException {
        click(LOC_OTHER_RADIO);
        fill(LOC_OTHER_INPUT, location);
        return this;
    }

    public RecommendPage search() throws ElementNotFoundException {
        click(SEARCH_BTN);
        return this;
    }

    public int getResultCount() {
        return driver.findElements(RESULT_CARDS).size();
    }

    public boolean isResultsTitleVisible() {
        return isVisible(RESULTS_TITLE);
    }

    public String getErrorMessage() {
        return textOf(ERROR_MSG);
    }

    public boolean hasErrorMessage() {
        return isVisible(ERROR_MSG);
    }
}
