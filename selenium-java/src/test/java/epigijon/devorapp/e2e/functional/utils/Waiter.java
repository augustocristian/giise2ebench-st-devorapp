package epigijon.devorapp.e2e.functional.utils;

import org.openqa.selenium.By;
import org.openqa.selenium.WebDriver;
import org.openqa.selenium.support.ui.ExpectedCondition;
import org.openqa.selenium.support.ui.ExpectedConditions;
import org.openqa.selenium.support.ui.WebDriverWait;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.time.Duration;

/**
 * Centralised explicit-wait utility for DevorApp page objects.
 * Each {@code waitFor*} method corresponds to a specific page-readiness
 * condition and is called by the matching page-object constructor.
 */
public class Waiter {

    private static final Logger log = LoggerFactory.getLogger(Waiter.class);
    private static final int WAIT_SECONDS = 20;

    private final WebDriverWait wait;

    public Waiter(WebDriver driver) {
        wait = new WebDriverWait(driver, Duration.ofSeconds(WAIT_SECONDS));
    }

    /** General-purpose wait. Throws a descriptive {@link org.openqa.selenium.TimeoutException} on failure. */
    public void waitUntil(ExpectedCondition<?> condition, String errorMessage) {
        try {
            wait.until(condition);
        } catch (org.openqa.selenium.TimeoutException e) {
            log.error(errorMessage);
            throw new org.openqa.selenium.TimeoutException(
                    "\"" + errorMessage + "\" > " + e.getMessage());
        }
    }

    public void waitForLoginPage() {
        waitUntil(ExpectedConditions.visibilityOfElementLocated(By.id("login-form")),
                "Login page did not load");
    }

    public void waitForHomePage() {
        waitUntil(ExpectedConditions.urlContains("/home"),
                "Home page did not load after login");
    }

    public void waitForRegisterPage() {
        waitUntil(ExpectedConditions.visibilityOfElementLocated(By.id("reg-email")),
                "Register page did not load");
    }

    public void waitForLoginError() {
        waitUntil(ExpectedConditions.visibilityOfElementLocated(By.cssSelector(".message.error")),
                "Login error message did not appear");
    }

    public void waitForTopBar() {
        waitUntil(ExpectedConditions.visibilityOfElementLocated(By.cssSelector(".topbar, header, nav")),
                "Top navigation bar did not appear");
    }

    public void waitForFavoritesPage() {
        waitUntil(ExpectedConditions.or(
                ExpectedConditions.visibilityOfElementLocated(By.cssSelector(".fav-list-card")),
                ExpectedConditions.visibilityOfElementLocated(By.xpath("//*[contains(text(),'Aún no tienes listas')]")),
                ExpectedConditions.visibilityOfElementLocated(By.cssSelector(".favorites-container, .fav-page"))),
                "Favorites page did not load");
    }

    public void waitForHistoryPage() {
        waitUntil(ExpectedConditions.or(
                ExpectedConditions.visibilityOfElementLocated(By.cssSelector(".history-group-title")),
                ExpectedConditions.visibilityOfElementLocated(By.cssSelector("input[placeholder='Buscar en historial...']")),
                ExpectedConditions.visibilityOfElementLocated(By.cssSelector(".history-container, .history-page"))),
                "History page did not load");
    }

    public void waitForRecommendPage() {
        waitUntil(ExpectedConditions.visibilityOfElementLocated(
                By.xpath("//button[contains(.,'Buscar recomendaciones')]")),
                "Recommend page did not load");
        By prefLocLabel = By.xpath("//label[contains(.,'Usar ubicación preferida')]");
        waitUntil(ExpectedConditions.visibilityOfElementLocated(prefLocLabel), 
                "Preferred location radio label did not appear");
        waitUntil(ExpectedConditions.not(ExpectedConditions.textToBePresentInElementLocated(
                prefLocLabel, "Desconocida")), 
                "Preferred location did not load in time (remained 'Desconocida')");
    }

    public void waitForProfilePage() {
        waitUntil(ExpectedConditions.visibilityOfElementLocated(
                By.cssSelector(".location-info-card")),
                "Profile page did not load");
    }

    public void waitForSideMenuDrawer() {
        waitUntil(ExpectedConditions.visibilityOfElementLocated(
                By.cssSelector(".sidemenu-drawer")),
                "Side menu drawer did not open");
    }

    /** Waits for a toast of the given CSS type, e.g. "success" or "error". */
    public void waitForToast(String type) {
        waitUntil(ExpectedConditions.visibilityOfElementLocated(
                By.cssSelector(".toast." + type)),
                "Toast of type '" + type + "' did not appear");
    }
}
