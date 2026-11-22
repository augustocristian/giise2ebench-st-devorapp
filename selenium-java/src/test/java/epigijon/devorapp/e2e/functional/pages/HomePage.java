package epigijon.devorapp.e2e.functional.pages;

import epigijon.devorapp.e2e.functional.common.TestId;
import epigijon.devorapp.e2e.functional.utils.Waiter;
import org.openqa.selenium.By;
import org.openqa.selenium.WebDriver;

/** Page object for {@code /home}; the constructor waits for the URL and the top bar. */
public class HomePage extends BasePage {

    private static final By TOP_BAR = TestId.of("topbar");

    public HomePage(WebDriver driver, Waiter waiter) {
        super(driver, waiter);
        waiter.waitForHomePage();
        waiter.waitForTopBar();
    }

    public boolean isTopBarVisible() {
        return isVisible(TOP_BAR);
    }

    public String getCurrentUrl() {
        return driver.getCurrentUrl();
    }
}
