package epigijon.devorapp.e2e.functional.pages;

import epigijon.devorapp.e2e.functional.common.ElementNotFoundException;
import epigijon.devorapp.e2e.functional.utils.Click;
import epigijon.devorapp.e2e.functional.utils.Waiter;
import org.openqa.selenium.By;
import org.openqa.selenium.WebDriver;
import org.openqa.selenium.WebElement;

/**
 * Base class for all DevorApp page objects.
 * Encapsulates the WebDriver and Waiter references and exposes low-level
 * helpers (fill, click, isVisible) so concrete pages never import Selenium
 * classes directly.
 */
public abstract class BasePage {

    protected final WebDriver driver;
    protected final Waiter waiter;

    protected BasePage(WebDriver driver, Waiter waiter) {
        this.driver = driver;
        this.waiter = waiter;
    }

    protected void fill(By locator, String text) {
        WebElement el = driver.findElement(locator);
        el.clear();
        el.sendKeys(text);
    }

    protected void click(By locator) throws ElementNotFoundException {
        Click.element(driver, waiter, driver.findElement(locator));
    }

    protected boolean isVisible(By locator) {
        return !driver.findElements(locator).isEmpty();
    }
}
