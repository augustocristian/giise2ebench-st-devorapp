package epigijon.devorapp.e2e.functional.pages;

import epigijon.devorapp.e2e.functional.common.ElementNotFoundException;
import epigijon.devorapp.e2e.functional.utils.Click;
import epigijon.devorapp.e2e.functional.utils.Waiter;
import org.openqa.selenium.By;
import org.openqa.selenium.WebDriver;
import org.openqa.selenium.WebElement;

import java.util.List;

/**
 * Page object for {@code /recommend-restaurants}.
 *
 * <p>Covers the search form (categories, price levels, boolean toggles,
 * location selector) and the results panel (suggestion cards).
 */
public class RecommendPage extends BasePage {

    // ── Filters ───────────────────────────────────────────────────────────────
    private static final By CATEGORY_INPUT   = By.cssSelector("input[placeholder='+ Añadir tipo de cocina...']");
    private static final By SEARCH_BTN       = By.xpath("//button[contains(.,'Buscar recomendaciones')]");
    private static final By LOC_PREF_RADIO   = By.xpath("//label[contains(.,'Usar ubicación preferida')]//input");
    private static final By LOC_OTHER_RADIO  = By.xpath("//label[contains(.,'Escoger otra ubicación')]//input");
    private static final By LOC_OTHER_INPUT  = By.cssSelector("input[placeholder='Ej. Madrid, Barcelona...']");
    private static final By NO_PRICE_CHECK   = By.xpath("//label[contains(.,'Incluir sitios sin precio confirmado')]//input");
    private static final By OPEN_NOW_CHECK   = By.xpath("//label[contains(.,'Solo lugares abiertos ahora')]//input");

    // ── Results ───────────────────────────────────────────────────────────────
    private static final By RESULT_CARDS     = By.cssSelector(".suggestion-card");
    private static final By RESULTS_TITLE    = By.xpath("//*[contains(text(),'Sugerencias para ti')]");
    private static final By ERROR_MSG        = By.cssSelector(".message.error");

    public RecommendPage(WebDriver driver, Waiter waiter) {
        super(driver, waiter);
        waiter.waitForRecommendPage();
    }

    // ── Category tags ─────────────────────────────────────────────────────────

    /**
     * Adds a cuisine category by typing {@code query} in the autocomplete input
     * and clicking the option containing {@code optionLabel}.
     */
    public RecommendPage addCategory(String query, String optionLabel) throws ElementNotFoundException {
        WebElement input = driver.findElement(CATEGORY_INPUT);
        Click.element(driver, waiter, input);
        input.clear();
        input.sendKeys(query);

        // The dropdown renders sibling div options next to the input
        By optionBy = By.xpath("//input[@placeholder='+ Añadir tipo de cocina...']" +
                "/following-sibling::div//div[contains(text(),'" + optionLabel + "')]");
        waiter.waitUntil(
                org.openqa.selenium.support.ui.ExpectedConditions.visibilityOfElementLocated(optionBy),
                "Category dropdown option '" + optionLabel + "' did not appear");
        click(optionBy);
        return this;
    }

    // ── Price levels ──────────────────────────────────────────────────────────

    /** Clicks the price button with the given label (e.g. "€", "€€", "€€€"). */
    public RecommendPage clickPrice(String label) throws ElementNotFoundException {
        WebElement btn = driver.findElements(By.tagName("button")).stream()
                .filter(b -> b.getText().trim().equals(label))
                .findFirst()
                .orElseThrow(() -> new ElementNotFoundException("Price button '" + label + "' not found"));
        Click.element(driver, waiter, btn);
        return this;
    }

    // ── Boolean toggles ───────────────────────────────────────────────────────

    /** Sets the "Incluir sitios sin precio confirmado" checkbox to {@code checked}. */
    public RecommendPage setIncludeNoPrice(boolean checked) {
        WebElement cb = driver.findElement(NO_PRICE_CHECK);
        if (cb.isSelected() != checked) cb.click();
        return this;
    }

    /** Sets the "Solo lugares abiertos ahora" checkbox to {@code checked}. */
    public RecommendPage setOpenNow(boolean checked) {
        WebElement cb = driver.findElement(OPEN_NOW_CHECK);
        if (cb.isSelected() != checked) cb.click();
        return this;
    }

    // ── Location ──────────────────────────────────────────────────────────────

    /** Selects "Usar ubicación preferida". */
    public RecommendPage selectPreferredLocation() throws ElementNotFoundException {
        click(LOC_PREF_RADIO);
        return this;
    }

    /** Selects "Escoger otra ubicación" and types a location string. */
    public RecommendPage selectOtherLocation(String location) throws ElementNotFoundException {
        click(LOC_OTHER_RADIO);
        fill(LOC_OTHER_INPUT, location);
        return this;
    }

    // ── Search ────────────────────────────────────────────────────────────────

    /** Clicks "Buscar recomendaciones". */
    public RecommendPage search() throws ElementNotFoundException {
        click(SEARCH_BTN);
        return this;
    }

    // ── Results ───────────────────────────────────────────────────────────────

    /** Returns the number of result suggestion-cards shown. */
    public int getResultCount() {
        return driver.findElements(RESULT_CARDS).size();
    }

    /** Returns {@code true} if the "Sugerencias para ti" title is visible. */
    public boolean isResultsTitleVisible() { return isVisible(RESULTS_TITLE); }

    /** Returns the text of the visible error message, or empty string. */
    public String getErrorMessage() {
        List<WebElement> els = driver.findElements(ERROR_MSG);
        return els.isEmpty() ? "" : els.get(0).getText();
    }

    /** Returns {@code true} if a validation error message is visible. */
    public boolean hasErrorMessage() { return isVisible(ERROR_MSG); }
}
