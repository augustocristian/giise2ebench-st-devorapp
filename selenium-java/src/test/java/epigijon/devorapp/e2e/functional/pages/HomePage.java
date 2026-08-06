package epigijon.devorapp.e2e.functional.pages;

import epigijon.devorapp.e2e.functional.utils.Waiter;
import org.openqa.selenium.By;
import org.openqa.selenium.WebDriver;

/**
 * Page object for {@code /home}.
 * The constructor waits until the URL contains {@code /home} and the top
 * navigation bar is visible before returning.
 */
public class HomePage extends BasePage {

    private static final By TOP_BAR = By.cssSelector(".topbar, header, nav");

    public HomePage(WebDriver driver, Waiter waiter) {
        super(driver, waiter);
        waiter.waitForHomePage();
        waiter.waitForTopBar();
    }

    /** Returns {@code true} if the top navigation bar is present in the DOM. */
    public boolean isTopBarVisible() {
        return isVisible(TOP_BAR);
    }

    /** Returns the browser's current URL. */
    public String getCurrentUrl() {
        return driver.getCurrentUrl();
    }
}
