// Mirrors selenium-java's pages/ProfilePage.java.
// The profile page renders several card sections identified by their heading:
// Información Personal, Ubicación Preferida, Correo Electrónico, Seguridad,
// and Zona de Peligro. Each card exposes its own edit/save/cancel actions.
class ProfilePage {
  static SELECTORS = {
    cards: ".location-info-card",
    toastSuccess: ".toast.success",
    toastError: ".toast.error",
    deleteInput: "#delete-confirm-input",
    currentPass: "#current-password-input",
    newPass: "#new-password-input",
    confirmPass: "#confirm-password-input",
    emailInput: "input[type='email']",
    emailPass: "#email-password-input",
  };

  waitForLoad() {
    cy.get(ProfilePage.SELECTORS.cards).should("be.visible");
    return this;
  }

  // ── Card helpers ──────────────────────────────────────────────────────────

  /** Yields the jQuery card element whose text contains `heading`. */
  cardWith(heading) {
    return cy.contains(ProfilePage.SELECTORS.cards, heading, { matchCase: false });
  }

  getCardText(heading) {
    return this.cardWith(heading).then(($card) => $card.text());
  }

  clickButtonInCard(heading, buttonText) {
    this.cardWith(heading).contains("button", buttonText).click();
    return this;
  }

  /** Fills the nth input (0-based) inside the card identified by `heading`. */
  fillInputInCard(heading, index, value) {
    this.cardWith(heading).find("input").eq(index).clear().type(value);
    return this;
  }

  // ── Personal info ─────────────────────────────────────────────────────────

  editPersonalInfo() {
    return this.clickButtonInCard("Información Personal", "Editar");
  }

  savePersonalInfo() {
    return this.clickButtonInCard("Información Personal", "Guardar cambios");
  }

  cancelPersonalInfo() {
    return this.clickButtonInCard("Información Personal", "Cancelar");
  }

  // ── Email change ──────────────────────────────────────────────────────────

  openEmailChange() {
    return this.clickButtonInCard("Correo Electrónico", "Cambiar");
  }

  fillNewEmail(email) {
    cy.get(ProfilePage.SELECTORS.emailInput).clear().type(email);
    return this;
  }

  fillEmailPassword(password) {
    cy.get(ProfilePage.SELECTORS.emailPass).clear().type(password);
    return this;
  }

  submitEmailChange() {
    return this.clickButtonInCard("Correo Electrónico", "Cambiar correo");
  }

  // ── Password change ───────────────────────────────────────────────────────

  openPasswordChange() {
    return this.clickButtonInCard("Seguridad", "Cambiar contraseña");
  }

  fillPasswordChange(current, newPass, confirm) {
    cy.get(ProfilePage.SELECTORS.currentPass).clear().type(current);
    cy.get(ProfilePage.SELECTORS.newPass).clear().type(newPass);
    cy.get(ProfilePage.SELECTORS.confirmPass).clear().type(confirm);
    return this;
  }

  submitPasswordChange() {
    return this.clickButtonInCard("Seguridad", "Actualizar contraseña");
  }

  // ── Delete account ────────────────────────────────────────────────────────

  openDeleteAccount() {
    return this.clickButtonInCard("Zona de Peligro", "Eliminar cuenta permanentemente");
  }

  fillDeleteConfirm(text) {
    cy.get(ProfilePage.SELECTORS.deleteInput).clear().type(text);
    return this;
  }

  submitDeleteAccount() {
    return this.clickButtonInCard("Zona de Peligro", "Eliminar permanentemente");
  }

  isDeleteButtonEnabled() {
    return this.cardWith("Zona de Peligro")
      .contains("button", "Eliminar permanentemente")
      .then(($btn) => !$btn.is(":disabled"));
  }

  // ── Toast queries ─────────────────────────────────────────────────────────

  hasSuccessToast() {
    return cy.get("body").then(($body) => $body.find(ProfilePage.SELECTORS.toastSuccess).length > 0);
  }

  getSuccessToastText() {
    return cy.get("body").then(($body) => {
      const els = $body.find(ProfilePage.SELECTORS.toastSuccess);
      return els.length ? els.last().text() : "";
    });
  }

  hasErrorToast() {
    return cy.get("body").then(($body) => $body.find(ProfilePage.SELECTORS.toastError).length > 0);
  }

  getErrorToastText() {
    return cy.get("body").then(($body) => {
      const els = $body.find(ProfilePage.SELECTORS.toastError);
      return els.length ? els.last().text() : "";
    });
  }

  dismissSuccessToast() {
    cy.get("body").then(($body) => {
      if ($body.find(ProfilePage.SELECTORS.toastSuccess).length) {
        cy.get(ProfilePage.SELECTORS.toastSuccess).last().click();
      }
    });
    return this;
  }

  dismissErrorToast() {
    cy.get("body").then(($body) => {
      if ($body.find(ProfilePage.SELECTORS.toastError).length) {
        cy.get(ProfilePage.SELECTORS.toastError).last().click();
      }
    });
    return this;
  }
}

export default ProfilePage;
