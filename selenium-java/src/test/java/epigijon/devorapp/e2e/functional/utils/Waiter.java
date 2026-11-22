package epigijon.devorapp.e2e.functional.utils;

import epigijon.devorapp.e2e.functional.common.TestId;
import org.openqa.selenium.By;
import org.openqa.selenium.WebDriver;
import org.openqa.selenium.support.ui.ExpectedCondition;
import org.openqa.selenium.support.ui.ExpectedConditions;
import org.openqa.selenium.support.ui.WebDriverWait;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.time.Duration;

/** Explicit waits; each {@code waitFor*} is the readiness condition of one page object. */
public class Waiter {

    private static final Logger log = LoggerFactory.getLogger(Waiter.class);
    private static final int WAIT_SECONDS = 20;

    private final WebDriverWait wait;

    public Waiter(WebDriver driver) {
        wait = new WebDriverWait(driver, Duration.ofSeconds(WAIT_SECONDS));
    }

    /** Waits for the condition; on timeout throws a TimeoutException carrying {@code errorMessage}. */
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
        waitUntil(ExpectedConditions.visibilityOfElementLocated(TestId.of("login-form")),
                "Login page did not load");
    }

    public void waitForHomePage() {
        waitUntil(ExpectedConditions.urlContains("/home"),
                "Home page did not load after login");
    }

    public void waitForRegisterPage() {
        waitUntil(ExpectedConditions.visibilityOfElementLocated(TestId.of("register-email")),
                "Register page did not load");
    }

    public void waitForLoginError() {
        waitUntil(ExpectedConditions.visibilityOfElementLocated(TestId.of("login-message-error")),
                "Login error message did not appear");
    }

    public void waitForTopBar() {
        waitUntil(ExpectedConditions.visibilityOfElementLocated(TestId.of("topbar")),
                "Top navigation bar did not appear");
    }

    public void waitForFavoritesPage() {
        waitUntil(ExpectedConditions.or(
                ExpectedConditions.visibilityOfElementLocated(TestId.of("favorites-list-card")),
                ExpectedConditions.visibilityOfElementLocated(TestId.of("favorites-empty"))),
                "Favorites page did not load");
    }

    public void waitForHistoryPage() {
        waitUntil(ExpectedConditions.or(
                ExpectedConditions.visibilityOfElementLocated(TestId.of("history-group-title")),
                ExpectedConditions.visibilityOfElementLocated(TestId.of("history-search"))),
                "History page did not load");
    }

    public void waitForRecommendPage() {
        waitUntil(ExpectedConditions.visibilityOfElementLocated(TestId.of("recommend-submit")),
                "Recommend page did not load");
        By preferredName = TestId.of("recommend-preferred-location-name");
        waitUntil(ExpectedConditions.visibilityOfElementLocated(preferredName),
                "Preferred location label did not appear");
        waitUntil(ExpectedConditions.not(ExpectedConditions.textToBePresentInElementLocated(
                preferredName, "Desconocida")),
                "Preferred location did not load in time (remained 'Desconocida')");
    }

    public void waitForProfilePage() {
        waitUntil(ExpectedConditions.visibilityOfElementLocated(TestId.of("profile-card-personal")),
                "Profile page did not load");
    }

    public void waitForSideMenuDrawer() {
        waitUntil(ExpectedConditions.visibilityOfElementLocated(TestId.of("side-menu-drawer")),
                "Side menu drawer did not open");
    }

    /** @param type toast type: "success", "error", "info" or "warning" */
    public void waitForToast(String type) {
        waitUntil(ExpectedConditions.visibilityOfElementLocated(TestId.of("toast-" + type)),
                "Toast of type '" + type + "' did not appear");
    }
}
