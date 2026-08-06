// Mirrors selenium-java's pages/LoginPage.java.
class LoginPage {
  static SELECTORS = {
    form: "#login-form",
    identifier: "#identifier",
    password: "#password",
    submit: "#login-submit-btn",
    googleBtn: "#google-login-btn",
    registerLink: "#go-register-link",
    errorMsg: ".message.error",
  };

  visit() {
    cy.visit("/login");
    cy.get(LoginPage.SELECTORS.form).should("be.visible");
    return this;
  }

  enterIdentifier(identifier) {
    cy.get(LoginPage.SELECTORS.identifier).clear().type(identifier);
    return this;
  }

  enterPassword(password) {
    cy.get(LoginPage.SELECTORS.password).clear().type(password);
    return this;
  }

  /** Clicks submit and waits for the redirect to /home. */
  submitLogin() {
    cy.get(LoginPage.SELECTORS.submit).click();
    cy.url().should("include", "/home");
    return this;
  }

  /** Clicks submit expecting an error and waits for the error message. */
  submitLoginExpectingFailure() {
    cy.get(LoginPage.SELECTORS.submit).click();
    cy.get(LoginPage.SELECTORS.errorMsg).should("be.visible");
    return this;
  }

  goToRegister() {
    cy.get(LoginPage.SELECTORS.registerLink).click();
    return this;
  }

  clickGoogleLogin() {
    cy.get(LoginPage.SELECTORS.googleBtn).click();
    return this;
  }

  /**
   * Query methods that must yield a value (not just chain) end with
   * `.then(cb)` at the call site, e.g.:
   *   page.hasErrorMessage().then((has) => expect(has).to.be.true);
   * This convention is followed consistently across all page objects.
   */
  hasErrorMessage() {
    return cy.get("body").then(($body) => $body.find(LoginPage.SELECTORS.errorMsg).length > 0);
  }
}

export default LoginPage;
