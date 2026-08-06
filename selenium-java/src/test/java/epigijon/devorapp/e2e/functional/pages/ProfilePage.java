package epigijon.devorapp.e2e.functional.pages;

import epigijon.devorapp.e2e.functional.common.ElementNotFoundException;
import epigijon.devorapp.e2e.functional.utils.Click;
import epigijon.devorapp.e2e.functional.utils.Waiter;
import org.openqa.selenium.By;
import org.openqa.selenium.WebDriver;
import org.openqa.selenium.WebElement;

import java.util.List;

/**
 * Page object for {@code /profile}.
 *
 * <p>The profile page renders several card sections identified by their heading:
 * Información Personal, Ubicación Preferida, Correo Electrónico, Seguridad,
 * and Zona de Peligro.  Each card exposes its own edit/save/cancel actions.
 */
public class ProfilePage extends BasePage {

    // ── Card containers (located by heading text) ─────────────────────────────
    private static final By CARDS          = By.cssSelector(".location-info-card");

    // ── Toast notifications ───────────────────────────────────────────────────
    private static final By TOAST_SUCCESS  = By.cssSelector(".toast.success");
    private static final By TOAST_ERROR    = By.cssSelector(".toast.error");

    // ── Delete-account form ───────────────────────────────────────────────────
    private static final By DELETE_INPUT   = By.id("delete-confirm-input");

    // ── Password change inputs ────────────────────────────────────────────────
    private static final By CURRENT_PASS   = By.id("current-password-input");
    private static final By NEW_PASS       = By.id("new-password-input");
    private static final By CONFIRM_PASS   = By.id("confirm-password-input");

    // ── Email change inputs ───────────────────────────────────────────────────
    private static final By EMAIL_INPUT    = By.cssSelector("input[type='email']");
    private static final By EMAIL_PASS     = By.id("email-password-input");

    public ProfilePage(WebDriver driver, Waiter waiter) {
        super(driver, waiter);
        waiter.waitForProfilePage();
    }

    // ── Card helpers ──────────────────────────────────────────────────────────

    /**
     * Returns the card element whose text contains {@code heading}
     * (e.g. "Información Personal", "Seguridad").
     */
    private WebElement cardWith(String heading) throws ElementNotFoundException {
        return driver.findElements(CARDS).stream()
                .filter(el -> el.getText().toLowerCase().contains(heading.toLowerCase()))
                .findFirst()
                .orElseThrow(() -> new ElementNotFoundException("Profile card not found: " + heading));
    }

    /** Returns the full text of the card with the given heading. */
    public String getCardText(String heading) throws ElementNotFoundException {
        return cardWith(heading).getText();
    }

    /** Clicks a button inside the card identified by {@code heading}. */
    public ProfilePage clickButtonInCard(String heading, String buttonText) throws ElementNotFoundException {
        WebElement card = cardWith(heading);
        WebElement btn = card.findElements(By.tagName("button")).stream()
                .filter(b -> b.getText().contains(buttonText))
                .findFirst()
                .orElseThrow(() -> new ElementNotFoundException("Button '" + buttonText + "' not found in card: " + heading));
        Click.element(driver, waiter, btn);
        return this;
    }

    /** Fills the nth input (0-based) inside the card identified by {@code heading}. */
    public ProfilePage fillInputInCard(String heading, int index, String value) throws ElementNotFoundException {
        WebElement card = cardWith(heading);
        List<WebElement> inputs = card.findElements(By.tagName("input"));
        if (index >= inputs.size()) throw new ElementNotFoundException(
                "Input #" + index + " not found in card: " + heading);
        inputs.get(index).clear();
        inputs.get(index).sendKeys(value);
        return this;
    }

    // ── Personal info ─────────────────────────────────────────────────────────

    /** Clicks "Editar" in the Información Personal card. */
    public ProfilePage editPersonalInfo() throws ElementNotFoundException {
        return clickButtonInCard("Información Personal", "Editar");
    }

    /** Clicks "Guardar cambios" in the Información Personal card. */
    public ProfilePage savePersonalInfo() throws ElementNotFoundException {
        return clickButtonInCard("Información Personal", "Guardar cambios");
    }

    /** Clicks "Cancelar" in the Información Personal card. */
    public ProfilePage cancelPersonalInfo() throws ElementNotFoundException {
        return clickButtonInCard("Información Personal", "Cancelar");
    }

    // ── Email change ──────────────────────────────────────────────────────────

    /** Clicks "Cambiar" in the Correo Electrónico card. */
    public ProfilePage openEmailChange() throws ElementNotFoundException {
        return clickButtonInCard("Correo Electrónico", "Cambiar");
    }

    /** Fills the new-email input in the email change form. */
    public ProfilePage fillNewEmail(String email) {
        WebElement el = driver.findElement(EMAIL_INPUT);
        el.clear(); el.sendKeys(email);
        return this;
    }

    /** Fills the password input in the email change form. */
    public ProfilePage fillEmailPassword(String password) {
        WebElement el = driver.findElement(EMAIL_PASS);
        el.clear(); el.sendKeys(password);
        return this;
    }

    /** Clicks "Cambiar correo" button. */
    public ProfilePage submitEmailChange() throws ElementNotFoundException {
        return clickButtonInCard("Correo Electrónico", "Cambiar correo");
    }

    // ── Password change ───────────────────────────────────────────────────────

    /** Clicks "Cambiar contraseña" in the Seguridad card. */
    public ProfilePage openPasswordChange() throws ElementNotFoundException {
        return clickButtonInCard("Seguridad", "Cambiar contraseña");
    }

    /** Fills all three password fields. */
    public ProfilePage fillPasswordChange(String current, String newPass, String confirm) {
        WebElement cp = driver.findElement(CURRENT_PASS);
        cp.clear(); cp.sendKeys(current);
        WebElement np = driver.findElement(NEW_PASS);
        np.clear(); np.sendKeys(newPass);
        WebElement cfp = driver.findElement(CONFIRM_PASS);
        cfp.clear(); cfp.sendKeys(confirm);
        return this;
    }

    /** Clicks "Actualizar contraseña" button. */
    public ProfilePage submitPasswordChange() throws ElementNotFoundException {
        return clickButtonInCard("Seguridad", "Actualizar contraseña");
    }

    // ── Delete account ────────────────────────────────────────────────────────

    /** Clicks "Eliminar cuenta permanentemente" in the Zona de Peligro card. */
    public ProfilePage openDeleteAccount() throws ElementNotFoundException {
        return clickButtonInCard("Zona de Peligro", "Eliminar cuenta permanentemente");
    }

    /** Types the confirmation text in the delete-account input. */
    public ProfilePage fillDeleteConfirm(String text) {
        WebElement el = driver.findElement(DELETE_INPUT);
        el.clear(); el.sendKeys(text);
        return this;
    }

    /** Clicks the final "Eliminar permanentemente" button. */
    public ProfilePage submitDeleteAccount() throws ElementNotFoundException {
        return clickButtonInCard("Zona de Peligro", "Eliminar permanentemente");
    }

    /** Returns true if the final delete button is enabled. */
    public boolean isDeleteButtonEnabled() throws ElementNotFoundException {
        WebElement card = cardWith("Zona de Peligro");
        WebElement btn = card.findElements(org.openqa.selenium.By.tagName("button")).stream()
                .filter(b -> b.getText().contains("Eliminar permanentemente"))
                .findFirst()
                .orElseThrow(() -> new ElementNotFoundException("Delete button not found"));
        return btn.isEnabled();
    }

    // ── Toast queries ─────────────────────────────────────────────────────────

    /** Returns {@code true} if a success toast is visible. */
    public boolean hasSuccessToast() { return isVisible(TOAST_SUCCESS); }

    /** Returns the text of the first success toast, or empty string. */
    public String getSuccessToastText() {
        List<WebElement> els = driver.findElements(TOAST_SUCCESS);
        return els.isEmpty() ? "" : els.get(els.size() - 1).getText();
    }

    /** Returns {@code true} if an error toast is visible. */
    public boolean hasErrorToast() { return isVisible(TOAST_ERROR); }

    /** Returns the text of the last error toast, or empty string. */
    public String getErrorToastText() {
        List<WebElement> els = driver.findElements(TOAST_ERROR);
        return els.isEmpty() ? "" : els.get(els.size() - 1).getText();
    }

    /** Clicks the last visible success toast to dismiss it. */
    public ProfilePage dismissSuccessToast() throws ElementNotFoundException {
        List<WebElement> els = driver.findElements(TOAST_SUCCESS);
        if (!els.isEmpty()) Click.element(driver, waiter, els.get(els.size() - 1));
        return this;
    }

    /** Clicks the last visible error toast to dismiss it. */
    public ProfilePage dismissErrorToast() throws ElementNotFoundException {
        List<WebElement> els = driver.findElements(TOAST_ERROR);
        if (!els.isEmpty()) Click.element(driver, waiter, els.get(els.size() - 1));
        return this;
    }
}
