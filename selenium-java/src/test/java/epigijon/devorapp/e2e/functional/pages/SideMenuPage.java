package epigijon.devorapp.e2e.functional.pages;

import epigijon.devorapp.e2e.functional.common.ElementNotFoundException;
import epigijon.devorapp.e2e.functional.utils.Click;
import epigijon.devorapp.e2e.functional.utils.Waiter;
import org.openqa.selenium.By;
import org.openqa.selenium.WebDriver;
import org.openqa.selenium.WebElement;

import java.util.List;

/**
 * Page object for the side menu drawer (accessible from {@code /home} and other
 * authenticated pages via the hamburger button).
 *
 * <p>The drawer contains:
 * <ul>
 *   <li>Theme toggle group (Claro / Oscuro)</li>
 *   <li>Font-size toggle group (S / M / L)</li>
 * </ul>
 */
public class SideMenuPage extends BasePage {

    private static final By HAMBURGER    = By.cssSelector("button[aria-label='Abrir menú']");
    private static final By DRAWER       = By.cssSelector(".sidemenu-drawer");
    private static final By TOGGLE_GROUPS = By.cssSelector(".sidemenu-toggle-group");
    private static final By HTML_TAG     = By.tagName("html");

    public SideMenuPage(WebDriver driver, Waiter waiter) {
        super(driver, waiter);
    }

    /** Clicks the hamburger button to open the side menu. */
    public SideMenuPage open() throws ElementNotFoundException {
        click(HAMBURGER);
        waiter.waitForSideMenuDrawer();
        return this;
    }

    /** Returns {@code true} if the drawer is currently visible. */
    public boolean isOpen() { return isVisible(DRAWER); }

    // ── Theme toggle ──────────────────────────────────────────────────────────

    /**
     * Clicks the theme button with the given label inside the first toggle group.
     * @param label "Claro" or "Oscuro"
     */
    public SideMenuPage clickTheme(String label) throws ElementNotFoundException {
        WebElement group = getToggleGroup(0);
        WebElement btn = group.findElements(By.tagName("button")).stream()
                .filter(b -> b.getAttribute("textContent").contains(label))
                .findFirst()
                .orElseThrow(() -> new ElementNotFoundException("Theme button not found: " + label));
        Click.element(driver, waiter, btn);
        return this;
    }

    /** Returns {@code true} if the theme button {@code label} has the "active" class. */
    public boolean isThemeActive(String label) {
        WebElement group = getToggleGroup(0);
        return group.findElements(By.tagName("button")).stream()
                .anyMatch(b -> b.getAttribute("textContent").contains(label) && b.getAttribute("class").contains("active"));
    }

    /**
     * Returns the {@code data-theme} attribute of the {@code <html>} element,
     * or empty string if the attribute is absent.
     */
    public String getHtmlDataTheme() {
        String val = driver.findElement(HTML_TAG).getAttribute("data-theme");
        return val == null ? "" : val;
    }

    // ── Font-size toggle ──────────────────────────────────────────────────────

    /**
     * Clicks the font-size button with the given label inside the second toggle group.
     * @param label "S", "M", or "L"
     */
    public SideMenuPage clickFontSize(String label) throws ElementNotFoundException {
        WebElement group = getToggleGroup(1);
        WebElement btn = group.findElements(By.tagName("button")).stream()
                .filter(b -> b.getAttribute("textContent").trim().equals(label))
                .findFirst()
                .orElseThrow(() -> new ElementNotFoundException("Font-size button not found: " + label));
        Click.element(driver, waiter, btn);
        return this;
    }

    /** Returns {@code true} if the font-size button {@code label} has the "active" class. */
    public boolean isFontSizeActive(String label) {
        WebElement group = getToggleGroup(1);
        return group.findElements(By.tagName("button")).stream()
                .anyMatch(b -> b.getAttribute("textContent").trim().equals(label) && b.getAttribute("class").contains("active"));
    }

    /**
     * Returns the {@code data-font-size} attribute of the {@code <html>} element,
     * or empty string if absent.
     */
    public String getHtmlDataFontSize() {
        String val = driver.findElement(HTML_TAG).getAttribute("data-font-size");
        return val == null ? "" : val;
    }

    // ── Helper ────────────────────────────────────────────────────────────────

    private WebElement getToggleGroup(int index) {
        List<WebElement> groups = driver.findElements(TOGGLE_GROUPS);
        if (index >= groups.size()) throw new org.openqa.selenium.NoSuchElementException(
                "Toggle group #" + index + " not found in side menu");
        return groups.get(index);
    }
}
