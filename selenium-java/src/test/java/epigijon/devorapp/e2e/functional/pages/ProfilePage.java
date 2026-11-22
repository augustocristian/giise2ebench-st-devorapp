package epigijon.devorapp.e2e.functional.pages;

import epigijon.devorapp.e2e.functional.common.ElementNotFoundException;
import epigijon.devorapp.e2e.functional.common.TestId;
import epigijon.devorapp.e2e.functional.utils.Click;
import epigijon.devorapp.e2e.functional.utils.Waiter;
import org.openqa.selenium.By;
import org.openqa.selenium.WebDriver;
import org.openqa.selenium.WebElement;

import java.util.List;

/**
 * Page object for {@code /profile}. Cards are addressed by key:
 * {@code personal}, {@code location}, {@code email}, {@code security}, {@code danger}.
 */
public class ProfilePage extends BasePage {

    private static final By TOAST_SUCCESS = TestId.of("toast-success");
    private static final By TOAST_ERROR   = TestId.of("toast-error");

    public ProfilePage(WebDriver driver, Waiter waiter) {
        super(driver, waiter);
        waiter.waitForProfilePage();
    }

    public String getCardText(String card) {
        return driver.findElement(TestId.of("profile-card-" + card)).getText();
    }

    private ProfilePage clickId(String id) throws ElementNotFoundException {
        click(TestId.of(id));
        return this;
    }

    private ProfilePage fillId(String id, String value) {
        fill(TestId.of(id), value);
        return this;
    }

    // Personal info
    public ProfilePage editPersonalInfo() throws ElementNotFoundException { return clickId("profile-personal-edit"); }
    public ProfilePage savePersonalInfo() throws ElementNotFoundException { return clickId("profile-personal-save"); }
    public ProfilePage cancelPersonalInfo() throws ElementNotFoundException { return clickId("profile-personal-cancel"); }
    public ProfilePage fillFirstName(String value) { return fillId("profile-personal-first-name", value); }
    public ProfilePage fillLastName(String value) { return fillId("profile-personal-last-name", value); }

    // Location
    public ProfilePage editLocation() throws ElementNotFoundException { return clickId("profile-location-edit"); }
    public ProfilePage saveLocation() throws ElementNotFoundException { return clickId("profile-location-save"); }
    public ProfilePage fillLocation(String value) { return fillId("profile-location-input", value); }

    // Email change
    public ProfilePage openEmailChange() throws ElementNotFoundException { return clickId("profile-email-edit"); }
    public ProfilePage fillNewEmail(String email) { return fillId("profile-email-input", email); }
    public ProfilePage fillEmailPassword(String password) { return fillId("profile-email-password", password); }
    public ProfilePage submitEmailChange() throws ElementNotFoundException { return clickId("profile-email-submit"); }
    public WebElement newEmailInput() { return driver.findElement(TestId.of("profile-email-input")); }
    public WebElement emailPasswordInput() { return driver.findElement(TestId.of("profile-email-password")); }

    // Password change
    public ProfilePage openPasswordChange() throws ElementNotFoundException { return clickId("profile-security-edit"); }
    public ProfilePage submitPasswordChange() throws ElementNotFoundException { return clickId("profile-security-submit"); }
    public WebElement currentPasswordInput() { return driver.findElement(TestId.of("profile-security-current")); }
    public WebElement newPasswordInput() { return driver.findElement(TestId.of("profile-security-new")); }

    public ProfilePage fillPasswordChange(String current, String newPass, String confirm) {
        fillId("profile-security-current", current);
        fillId("profile-security-new", newPass);
        return fillId("profile-security-confirm", confirm);
    }

    // Delete account
    public ProfilePage openDeleteAccount() throws ElementNotFoundException { return clickId("profile-danger-open"); }
    public ProfilePage fillDeleteConfirm(String text) { return fillId("profile-danger-confirm-input", text); }
    public ProfilePage submitDeleteAccount() throws ElementNotFoundException { return clickId("profile-danger-submit"); }

    public boolean isDeleteButtonEnabled() {
        return driver.findElement(TestId.of("profile-danger-submit")).isEnabled();
    }

    // Toasts
    public boolean hasSuccessToast() { return isVisible(TOAST_SUCCESS); }

    /** Text of the latest success toast, or empty string. */
    public String getSuccessToastText() { return lastText(TOAST_SUCCESS); }

    public boolean hasErrorToast() { return isVisible(TOAST_ERROR); }

    /** Text of the latest error toast, or empty string. */
    public String getErrorToastText() { return lastText(TOAST_ERROR); }

    /** Clicking a toast dismisses it. */
    public ProfilePage dismissSuccessToast() throws ElementNotFoundException { return dismissLast(TOAST_SUCCESS); }

    public ProfilePage dismissErrorToast() throws ElementNotFoundException { return dismissLast(TOAST_ERROR); }

    private String lastText(By locator) {
        List<WebElement> els = driver.findElements(locator);
        return els.isEmpty() ? "" : els.get(els.size() - 1).getText();
    }

    private ProfilePage dismissLast(By locator) throws ElementNotFoundException {
        List<WebElement> els = driver.findElements(locator);
        if (!els.isEmpty()) Click.element(driver, waiter, els.get(els.size() - 1));
        return this;
    }
}
