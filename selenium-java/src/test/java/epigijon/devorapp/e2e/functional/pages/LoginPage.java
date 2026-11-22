package epigijon.devorapp.e2e.functional.pages;

import epigijon.devorapp.e2e.functional.common.ElementNotFoundException;
import epigijon.devorapp.e2e.functional.common.TestId;
import epigijon.devorapp.e2e.functional.utils.Waiter;
import org.openqa.selenium.By;
import org.openqa.selenium.WebDriver;

/** Page object for {@code /login}; the constructor waits for the form. */
public class LoginPage extends BasePage {

    private static final By IDENTIFIER    = TestId.of("login-identifier");
    private static final By PASSWORD      = TestId.of("login-password");
    private static final By SUBMIT        = TestId.of("login-submit");
    private static final By GOOGLE_BTN    = TestId.of("login-google");
    private static final By REGISTER_LINK = TestId.of("login-register-link");
    private static final By ERROR_MSG     = TestId.of("login-message-error");

    public LoginPage(WebDriver driver, Waiter waiter) {
        super(driver, waiter);
        waiter.waitForLoginPage();
    }

    public LoginPage enterIdentifier(String identifier) {
        fill(IDENTIFIER, identifier);
        return this;
    }

    public LoginPage enterPassword(String password) {
        fill(PASSWORD, password);
        return this;
    }

    public HomePage submitLogin() throws ElementNotFoundException {
        click(SUBMIT);
        return new HomePage(driver, waiter);
    }

    /** Submits and waits for the error message. */
    public LoginPage submitLoginExpectingFailure() throws ElementNotFoundException {
        click(SUBMIT);
        waiter.waitForLoginError();
        return this;
    }

    public RegisterPage goToRegister() throws ElementNotFoundException {
        click(REGISTER_LINK);
        return new RegisterPage(driver, waiter);
    }

    public HomePage clickGoogleLogin() throws ElementNotFoundException {
        click(GOOGLE_BTN);
        return new HomePage(driver, waiter);
    }

    public boolean hasErrorMessage() {
        return isVisible(ERROR_MSG);
    }
}
