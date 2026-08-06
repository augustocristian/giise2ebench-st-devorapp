package epigijon.devorapp.e2e.functional.pages;

import epigijon.devorapp.e2e.functional.common.ElementNotFoundException;
import epigijon.devorapp.e2e.functional.utils.Waiter;
import org.openqa.selenium.By;
import org.openqa.selenium.WebDriver;

/**
 * Page object for {@code /login}.
 * The constructor waits until the login form is visible before returning,
 * so any {@code LoginPage} instance is guaranteed to be ready to use.
 */
public class LoginPage extends BasePage {

    private static final By IDENTIFIER    = By.id("identifier");
    private static final By PASSWORD      = By.id("password");
    private static final By SUBMIT        = By.id("login-submit-btn");
    private static final By GOOGLE_BTN    = By.id("google-login-btn");
    private static final By REGISTER_LINK = By.id("go-register-link");
    private static final By ERROR_MSG     = By.cssSelector(".message.error");

    public LoginPage(WebDriver driver, Waiter waiter) {
        super(driver, waiter);
        waiter.waitForLoginPage();
    }

    /** Types into the identifier (email or username) field. Returns {@code this} for chaining. */
    public LoginPage enterIdentifier(String identifier) {
        fill(IDENTIFIER, identifier);
        return this;
    }

    /** Types into the password field. Returns {@code this} for chaining. */
    public LoginPage enterPassword(String password) {
        fill(PASSWORD, password);
        return this;
    }

    /**
     * Clicks the submit button and waits for the home page.
     * Returns the resulting {@link HomePage}.
     */
    public HomePage submitLogin() throws ElementNotFoundException {
        click(SUBMIT);
        return new HomePage(driver, waiter);
    }

    /**
     * Clicks the submit button expecting an error and waits for the error
     * message to appear. Returns {@code this} so callers can chain assertions.
     */
    public LoginPage submitLoginExpectingFailure() throws ElementNotFoundException {
        click(SUBMIT);
        waiter.waitForLoginError();
        return this;
    }

    /** Clicks the "register" link and returns the resulting {@link RegisterPage}. */
    public RegisterPage goToRegister() throws ElementNotFoundException {
        click(REGISTER_LINK);
        return new RegisterPage(driver, waiter);
    }
    
    /** Clicks the Google login button. */
    public HomePage clickGoogleLogin() throws ElementNotFoundException {
        click(GOOGLE_BTN);
        return new HomePage(driver, waiter);
    }

    /** Returns {@code true} if an error message is currently visible. */
    public boolean hasErrorMessage() {
        return isVisible(ERROR_MSG);
    }
}
