import { TID } from "../testids";

const L = TID.login;

class LoginPage {
  visit() {
    cy.visit("/login");
    cy.tid(L.form).should("be.visible");
    return this;
  }

  enterIdentifier(identifier) {
    cy.tid(L.identifier).fill(identifier);
    return this;
  }

  enterPassword(password) {
    cy.tid(L.password).fill(password);
    return this;
  }

  /** Clicks submit without waiting for a particular outcome. */
  submit() {
    cy.tid(L.submit).click();
    return this;
  }

  /** Submits valid credentials and waits for /home. */
  submitLogin() {
    this.submit();
    cy.url().should("include", "/home");
    return this;
  }

  expectError() {
    cy.tid(L.messageError).should("be.visible");
    return this;
  }

  expectOnLogin() {
    cy.url().should("include", "/login");
    return this;
  }
}

export default LoginPage;
