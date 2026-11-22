package epigijon.devorapp.e2e.functional.pages;

import epigijon.devorapp.e2e.functional.common.ElementNotFoundException;
import epigijon.devorapp.e2e.functional.common.TestId;
import epigijon.devorapp.e2e.functional.utils.Waiter;
import org.openqa.selenium.By;
import org.openqa.selenium.WebDriver;
import org.openqa.selenium.support.ui.ExpectedConditions;

/** Page object for {@code /register} (step 1: account data, step 2: location + submit). */
public class RegisterPage extends BasePage {

    private static final By STEP1        = TestId.of("register-step1");
    private static final By STEP_LABEL   = TestId.of("register-step-label");
    private static final By EMAIL        = TestId.of("register-email");
    private static final By USERNAME     = TestId.of("register-username");
    private static final By PASSWORD     = TestId.of("register-password");
    private static final By FIRST_NAME       = TestId.of("register-first-name");
    private static final By LAST_NAME    = TestId.of("register-last-name");
    private static final By CONTINUE_BTN = TestId.of("register-continue");

    private static final By GPS_BTN    = TestId.of("register-gps");
    private static final By LOCATION  = TestId.of("register-location");
    private static final By SUBMIT_BTN = TestId.of("register-submit");
    private static final By BACK_BTN   = TestId.of("register-back");

    private static final By ERROR_MSG   = TestId.of("register-message-error");
    private static final By STEP_ERROR  = TestId.of("register-step-error");
    private static final By EMAIL_ERROR = TestId.of("register-email-error");
    private static final By USER_ERROR  = TestId.of("register-username-error");
    private static final By VERIFY_MSG  = TestId.of("register-verify-title");
    private static final By LOC_NAME    = TestId.of("register-location-name");

    public RegisterPage(WebDriver driver, Waiter waiter) {
        super(driver, waiter);
        waiter.waitForRegisterPage();
    }

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

    public RegisterPage enterFirstName(String firstName) {
        fill(FIRST_NAME, firstName);
        return this;
    }

    public RegisterPage enterLastName(String lastName) {
        fill(LAST_NAME, lastName);
        return this;
    }

    public RegisterPage clickContinue() throws ElementNotFoundException {
        click(CONTINUE_BTN);
        return this;
    }

    public RegisterPage clickUseGps() throws ElementNotFoundException {
        click(GPS_BTN);
        return this;
    }

    /** Types a location without picking an autocomplete suggestion. */
    public RegisterPage enterLocation(String location) {
        fill(LOCATION, location);
        return this;
    }

    public RegisterPage clickSubmit() throws ElementNotFoundException {
        click(SUBMIT_BTN);
        return this;
    }

    public RegisterPage clickBack() throws ElementNotFoundException {
        click(BACK_BTN);
        return this;
    }

    public RegisterPage waitForStep2() {
        waiter.waitUntil(ExpectedConditions.textToBePresentInElementLocated(STEP_LABEL, "Paso 2 de 2"),
                "Register page did not advance to step 2");
        return this;
    }

    /** Step 1 validation banner, or the API/step 2 error message. */
    public String getErrorMessage() {
        String step = textOf(STEP_ERROR);
        return step.isEmpty() ? textOf(ERROR_MSG) : step;
    }

    public String getEmailError() {
        return textOf(EMAIL_ERROR);
    }

    public String getUsernameError() {
        return textOf(USER_ERROR);
    }

    public boolean isOnStep1() {
        return textOf(STEP_LABEL).contains("Paso 1 de 2");
    }

    public boolean isOnStep2() {
        return textOf(STEP_LABEL).contains("Paso 2 de 2");
    }

    public boolean isVerifyEmailVisible() {
        return isVisible(VERIFY_MSG);
    }

    public String getDetectedLocationText() {
        return textOf(LOC_NAME);
    }

    public boolean isLoaded() {
        return isVisible(STEP1);
    }
}
