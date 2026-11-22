import { TID } from "../testids";
import { installGoogleAutocompleteMock } from "../commands/mocks";

const P = TID.profile;

// Each profile section is a card with its own edit / submit / cancel buttons.
class ProfilePage {
  /** The autocomplete mock is only needed by the location card. */
  visit({ withAutocompleteMock = false } = {}) {
    cy.visit("/profile", withAutocompleteMock ? { onBeforeLoad: installGoogleAutocompleteMock } : {});
    cy.tid(P.cardPersonal).should("be.visible");
    cy.tid(P.headerEmail).should("not.be.empty");
    return this;
  }

  expectCardText(cardId, text) {
    cy.tid(cardId).should("contain.text", text);
    return this;
  }

  expectCardNotText(cardId, text) {
    cy.tid(cardId).should("not.contain.text", text);
    return this;
  }

  // Personal info
  editPersonalInfo() {
    cy.tid(P.personalEdit).click();
    return this;
  }

  fillPersonalInfo(firstName, lastName) {
    cy.tid(P.personalFirstName).fill(firstName);
    cy.tid(P.personalLastName).fill(lastName);
    return this;
  }

  savePersonalInfo() {
    cy.tid(P.personalSave).click();
    return this;
  }

  cancelPersonalInfo() {
    cy.tid(P.personalCancel).click();
    return this;
  }

  // Location
  editLocation() {
    cy.tid(P.locationEdit).click();
    return this;
  }

  typeLocation(text) {
    cy.tid(P.locationInput).fill(text);
    return this;
  }

  saveLocation() {
    cy.tid(P.locationSave).click();
    return this;
  }

  // Email
  openEmailChange() {
    cy.tid(P.emailEdit).click();
    return this;
  }

  /** Fills and submits the email form. */
  changeEmail(newEmail, password) {
    cy.tid(P.emailInput).fill(newEmail);
    cy.tid(P.emailPassword).fill(password);
    cy.tid(P.emailSubmit).click();
    return this;
  }

  // Password
  openPasswordChange() {
    cy.tid(P.securityEdit).click();
    return this;
  }

  /** Fills and submits the password form. */
  changePassword(current, next, confirm = next) {
    cy.tid(P.securityCurrent).fill(current);
    cy.tid(P.securityNew).fill(next);
    cy.tid(P.securityConfirm).fill(confirm);
    cy.tid(P.securitySubmit).click();
    return this;
  }

  // Account deletion
  openDeleteAccount() {
    cy.tid(P.dangerOpen).click();
    return this;
  }

  fillDeleteConfirm(text) {
    cy.tid(P.dangerConfirmInput).fill(text);
    return this;
  }

  submitDeleteAccount() {
    cy.tid(P.dangerSubmit).click();
    return this;
  }

  expectDeleteEnabled(enabled) {
    cy.tid(P.dangerSubmit).should(enabled ? "be.enabled" : "be.disabled");
    return this;
  }

  // Toasts
  expectToast(type, text) {
    cy.tid(TID.shared.toast(type)).should("be.visible");
    if (text) cy.tid(TID.shared.toast(type)).should("contain.text", text);
    return this;
  }
}

export default ProfilePage;
