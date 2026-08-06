package epigijon.devorapp.e2e.functional.pages;

import epigijon.devorapp.e2e.functional.common.ElementNotFoundException;
import epigijon.devorapp.e2e.functional.utils.Waiter;
import org.openqa.selenium.By;
import org.openqa.selenium.WebDriver;

import java.util.List;

/**
 * Page object for {@code /register}.
 *
 * <p>Covers both registration steps:
 * <ul>
 *   <li><b>Step 1</b> — email, username, password, nombre, apellidos.</li>
 *   <li><b>Step 2</b> — location (GPS button or manual text) and final submit.</li>
 * </ul>
 *
 * <p>Each mutating method returns {@code this} for fluent chaining.
 * The constructor blocks until the form (step 1) is visible.
 */
public class RegisterPage extends BasePage {

    private static final By FORM = By.id("register-form");

    // ── Step 1 ────────────────────────────────────────────────────────────────
    private static final By EMAIL        = By.id("reg-email");
    private static final By USERNAME     = By.id("reg-username");
    private static final By PASSWORD     = By.id("reg-password");
    private static final By NOMBRE       = By.id("reg-nombre");
    private static final By APELLIDOS    = By.id("reg-apellidos");
    private static final By CONTINUE_BTN = By.id("register-continue-btn");

    // ── Step 2 ────────────────────────────────────────────────────────────────
    private static final By GPS_BTN    = By.id("use-gps-btn");
    private static final By UBICACION  = By.id("reg-ubicacion");
    private static final By SUBMIT_BTN = By.id("register-submit-btn");
    private static final By BACK_BTN   = By.id("register-back-btn");

    // ── Feedback ──────────────────────────────────────────────────────────────
    private static final By ERROR_MSG   = By.cssSelector(".message.error");
    private static final By EMAIL_ERROR = By.id("email-error");
    private static final By USER_ERROR  = By.id("username-error");
    private static final By STEP1_LABEL = By.xpath("//*[contains(text(),'Paso 1 de 2')]");
    private static final By STEP2_LABEL = By.xpath("//*[contains(text(),'Paso 2 de 2')]");
    private static final By VERIFY_MSG  = By.xpath("//*[contains(text(),'Verifica tu correo')]");
    private static final By LOC_NAME    = By.cssSelector(".location-detected-name");

    public RegisterPage(WebDriver driver, Waiter waiter) {
        super(driver, waiter);
        waiter.waitForRegisterPage();
    }

    // ── Step 1 actions ────────────────────────────────────────────────────────

    public RegisterPage enterEmail(String email) {
        fill(EMAIL, email);
        return this;
    }

    public RegisterPage enterUsername(String username) {
        fill(USERNAME, username);
        return this;
    }

    public RegisterPage enterPassword(String password) {
        fill(PASSWORD, password);
        return this;
    }

    public RegisterPage enterNombre(String nombre) {
        fill(NOMBRE, nombre);
        return this;
    }

    public RegisterPage enterApellidos(String apellidos) {
        fill(APELLIDOS, apellidos);
        return this;
    }

    /** Clicks "Continuar" to advance to step 2. */
    public RegisterPage clickContinue() throws ElementNotFoundException {
        click(CONTINUE_BTN);
        return this;
    }

    // ── Step 2 actions ────────────────────────────────────────────────────────

    /** Clicks the GPS button to auto-detect location. */
    public RegisterPage clickUseGps() throws ElementNotFoundException {
        click(GPS_BTN);
        return this;
    }

    /** Types a location manually into the text field (without selecting from autocomplete). */
    public RegisterPage enterUbicacion(String location) {
        fill(UBICACION, location);
        return this;
    }

    /** Clicks the final submit button to complete registration. */
    public RegisterPage clickSubmit() throws ElementNotFoundException {
        click(SUBMIT_BTN);
        return this;
    }

    /** Clicks the back button to return to step 1. */
    public RegisterPage clickBack() throws ElementNotFoundException {
        click(BACK_BTN);
        return this;
    }

    /** Waits until the page advances to Step 2. */
    public RegisterPage waitForStep2() {
        waiter.waitUntil(org.openqa.selenium.support.ui.ExpectedConditions.visibilityOfElementLocated(STEP2_LABEL),
                "Register page did not advance to Step 2");
        return this;
    }

    // ── State queries ─────────────────────────────────────────────────────────

    /** Returns the current inline error message text, or empty string if none. */
    public String getErrorMessage() {
        List<org.openqa.selenium.WebElement> els = driver.findElements(ERROR_MSG);
        return els.isEmpty() ? "" : els.get(0).getText();
    }

    /** Returns the email field inline error, or empty string. */
    public String getEmailError() {
        List<org.openqa.selenium.WebElement> els = driver.findElements(EMAIL_ERROR);
        return els.isEmpty() ? "" : els.get(0).getText();
    }

    /** Returns the username field inline error, or empty string. */
    public String getUsernameError() {
        List<org.openqa.selenium.WebElement> els = driver.findElements(USER_ERROR);
        return els.isEmpty() ? "" : els.get(0).getText();
    }

    /** Returns {@code true} if "Paso 1 de 2" label is visible. */
    public boolean isOnStep1() { return isVisible(STEP1_LABEL); }

    /** Returns {@code true} if "Paso 2 de 2" label is visible. */
    public boolean isOnStep2() { return isVisible(STEP2_LABEL); }

    /** Returns {@code true} if the email-verification screen is shown. */
    public boolean isVerifyEmailVisible() { return isVisible(VERIFY_MSG); }

    /** Returns the text of the detected location name displayed in step 2. */
    public String getDetectedLocationText() {
        List<org.openqa.selenium.WebElement> els = driver.findElements(LOC_NAME);
        return els.isEmpty() ? "" : els.get(0).getText();
    }

    /** Returns {@code true} if the registration form is present in the DOM. */
    public boolean isLoaded() { return isVisible(FORM); }
}
