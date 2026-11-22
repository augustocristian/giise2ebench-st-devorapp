import { TID } from "../testids";
import { installGoogleAutocompleteMock } from "../commands/mocks";

const R = TID.register;

// Both steps: 1 = credentials and name, 2 = preferred location + submit.
class RegisterPage {
  /** `withAutocompleteMock` must be set before step 2 mounts, so it is installed on page load. */
  visit({ withAutocompleteMock = false } = {}) {
    cy.visit("/register", withAutocompleteMock ? { onBeforeLoad: installGoogleAutocompleteMock } : {});
    cy.tid(R.step1).should("be.visible");
    return this;
  }

  /** Fills every step 1 field; an empty string leaves the field blank. */
  fillStep1({ email, username, password, first_name: firstName, last_name: lastName }) {
    cy.tid(R.email).fill(email);
    cy.tid(R.username).fill(username);
    cy.tid(R.password).fill(password);
    cy.tid(R.firstName).fill(firstName);
    cy.tid(R.lastName).fill(lastName);
    return this;
  }

  continueToStep2() {
    cy.tid(R.continue).click();
    return this;
  }

  /** Types a location as free text, without picking it from the autocomplete. */
  typeLocation(text) {
    cy.tid(R.location).fill(text);
    return this;
  }

  /** Types a location and picks it through the mocked Google autocomplete. */
  selectLocation(text) {
    this.typeLocation(text);
    cy.triggerAutocompletePlaceChanged();
    return this;
  }

  submit() {
    cy.tid(R.submit).click();
    return this;
  }

  expectOnStep(n) {
    cy.tid(R.stepLabel).should("contain.text", `Paso ${n} de 2`);
    return this;
  }

  /** Step 1 validation banner. */
  expectStepError(text) {
    cy.tid(R.stepError).should("be.visible").and("contain.text", text);
    return this;
  }

  /** Step 2 / backend feedback banner. */
  expectMessageError(pattern) {
    cy.tid(R.messageError).should("be.visible").invoke("text").should("match", pattern);
    return this;
  }

  expectEmailError(text) {
    cy.tid(R.emailError).should("contain.text", text);
    return this;
  }

  expectUsernameError(text) {
    cy.tid(R.usernameError).should("contain.text", text);
    return this;
  }

  expectVerifyEmailShown() {
    cy.tid(R.verifyTitle).should("be.visible");
    return this;
  }
}

export default RegisterPage;
