// Mirrors selenium-java's pages/RegisterPage.java.
// Covers both registration steps: step 1 (email, username, password, nombre,
// apellidos) and step 2 (location + final submit).
class RegisterPage {
  static SELECTORS = {
    form: "#register-form",
    // Step 1
    email: "#reg-email",
    username: "#reg-username",
    password: "#reg-password",
    nombre: "#reg-nombre",
    apellidos: "#reg-apellidos",
    continueBtn: "#register-continue-btn",
    // Step 2
    gpsBtn: "#use-gps-btn",
    ubicacion: "#reg-ubicacion",
    submitBtn: "#register-submit-btn",
    backBtn: "#register-back-btn",
    // Feedback
    errorMsg: ".message.error",
    emailError: "#email-error",
    usernameError: "#username-error",
    locName: ".location-detected-name",
  };

  visit() {
    cy.visit("/register");
    cy.get(RegisterPage.SELECTORS.form).should("be.visible");
    return this;
  }

  // ── Step 1 actions ──────────────────────────────────────────────────────

  enterEmail(email) {
    cy.get(RegisterPage.SELECTORS.email).clear().type(email);
    return this;
  }

  enterUsername(username) {
    cy.get(RegisterPage.SELECTORS.username).clear().type(username);
    return this;
  }

  enterPassword(password) {
    cy.get(RegisterPage.SELECTORS.password).clear().type(password);
    return this;
  }

  enterNombre(nombre) {
    cy.get(RegisterPage.SELECTORS.nombre).clear().type(nombre);
    return this;
  }

  enterApellidos(apellidos) {
    cy.get(RegisterPage.SELECTORS.apellidos).clear().type(apellidos);
    return this;
  }

  clickContinue() {
    cy.get(RegisterPage.SELECTORS.continueBtn).click();
    return this;
  }

  // ── Step 2 actions ──────────────────────────────────────────────────────

  clickUseGps() {
    cy.get(RegisterPage.SELECTORS.gpsBtn).click();
    return this;
  }

  /** Types a location manually into the text field (without selecting from autocomplete). */
  enterUbicacion(location) {
    cy.get(RegisterPage.SELECTORS.ubicacion).clear().type(location);
    return this;
  }

  clickSubmit() {
    cy.get(RegisterPage.SELECTORS.submitBtn).click();
    return this;
  }

  clickBack() {
    cy.get(RegisterPage.SELECTORS.backBtn).click();
    return this;
  }

  waitForStep2() {
    cy.contains("Paso 2 de 2").should("be.visible");
    return this;
  }

  // ── State queries ────────────────────────────────────────────────────────

  getErrorMessage() {
    return cy.get("body").then(($body) => {
      const el = $body.find(RegisterPage.SELECTORS.errorMsg);
      return el.length ? el.first().text() : "";
    });
  }

  getEmailError() {
    return cy.get("body").then(($body) => {
      const el = $body.find(RegisterPage.SELECTORS.emailError);
      return el.length ? el.first().text() : "";
    });
  }

  getUsernameError() {
    return cy.get("body").then(($body) => {
      const el = $body.find(RegisterPage.SELECTORS.usernameError);
      return el.length ? el.first().text() : "";
    });
  }

  isOnStep1() {
    return cy.get("body").then(($body) => $body.text().includes("Paso 1 de 2"));
  }

  isOnStep2() {
    return cy.get("body").then(($body) => $body.text().includes("Paso 2 de 2"));
  }

  isVerifyEmailVisible() {
    return cy.get("body").then(($body) => $body.text().includes("Verifica tu correo"));
  }

  getDetectedLocationText() {
    return cy.get("body").then(($body) => {
      const el = $body.find(RegisterPage.SELECTORS.locName);
      return el.length ? el.first().text() : "";
    });
  }

  isLoaded() {
    return cy.get("body").then(($body) => $body.find(RegisterPage.SELECTORS.form).length > 0);
  }
}

export default RegisterPage;
