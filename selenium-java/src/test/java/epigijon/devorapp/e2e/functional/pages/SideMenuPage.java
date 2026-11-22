package epigijon.devorapp.e2e.functional.pages;

import epigijon.devorapp.e2e.functional.common.ElementNotFoundException;
import epigijon.devorapp.e2e.functional.common.TestId;
import epigijon.devorapp.e2e.functional.utils.Waiter;
import org.openqa.selenium.By;
import org.openqa.selenium.WebDriver;

/** Page object for the side menu drawer (hamburger button on authenticated pages). */
public class SideMenuPage extends BasePage {

    private static final By HAMBURGER = TestId.of("side-menu-open");
    private static final By DRAWER    = TestId.of("side-menu-drawer");
    // data-theme / data-font-size live on <html>; they are read as attributes, not used as locators
    private static final By HTML_TAG  = By.tagName("html");

    public SideMenuPage(WebDriver driver, Waiter waiter) {
        super(driver, waiter);
    }

    public SideMenuPage open() throws ElementNotFoundException {
        click(HAMBURGER);
        waiter.waitForSideMenuDrawer();
        return this;
    }

    public boolean isOpen() {
        return isVisible(DRAWER);
    }

    /** Clicks an entry such as {@code home}, {@code recommend}, {@code favorites}, {@code saved}, {@code history}, {@code ratings}. */
    public SideMenuPage goTo(String entry) throws ElementNotFoundException {
        click(TestId.of("side-menu-" + entry));
        return this;
    }

    /** @param theme "light" or "dark" */
    public SideMenuPage clickTheme(String theme) throws ElementNotFoundException {
        click(TestId.of("theme-" + theme));
        return this;
    }

    public boolean isThemeActive(String theme) {
        return hasActiveClass(TestId.of("theme-" + theme));
    }

    /** Value of {@code data-theme} on {@code <html>}, or empty string when absent. */
    public String getHtmlDataTheme() {
        return htmlAttribute("data-theme");
    }

    /** @param size "S", "M" or "L" */
    public SideMenuPage clickFontSize(String size) throws ElementNotFoundException {
        click(TestId.of("font-size-" + size.toLowerCase()));
        return this;
    }

    public boolean isFontSizeActive(String size) {
        return hasActiveClass(TestId.of("font-size-" + size.toLowerCase()));
    }

    /** Value of {@code data-font-size} on {@code <html>}, or empty string when absent. */
    public String getHtmlDataFontSize() {
        return htmlAttribute("data-font-size");
    }

    private boolean hasActiveClass(By locator) {
        String cls = driver.findElement(locator).getAttribute("class");
        return cls != null && cls.contains("active");
    }

    private String htmlAttribute(String name) {
        String val = driver.findElement(HTML_TAG).getAttribute(name);
        return val == null ? "" : val;
    }
}
