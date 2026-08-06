// Browser tests for the DevorApp profile page (/profile).
// Mirrors selenium-java's tests/e2e/TestProfileView.java.
//
// Base-Choice coverage:
//   BASE - profile data loads correctly and invalid location update is validated (Ubicación = Mal).
//   S2-S4 - save personal info (Nombre = Si, Apellidos = Si) and valid location update (Ubicación = Bien).
//   S5-S9 - email change validations and happy path.
//   S10-S16 - password change validations and happy path.
//   S17 - account deletion.

import LoginPage from "../support/pages/LoginPage";
import ProfilePage from "../support/pages/ProfilePage";
import { installGoogleAutocompleteMock } from "../support/commands/mocks";
import { uniqueTs, uniqueEmail, uniqueUsername } from "../support/commands/api";

describe("Profile", () => {
  let outerEmail;
  const OUTER_PASSWORD = "Test1234!";

  before(() => {
    const ts = uniqueTs();
    outerEmail = uniqueEmail(ts);
    cy.registerTestUser(uniqueUsername(ts), outerEmail, OUTER_PASSWORD);
  });

  after(() => {
    cy.deleteTestUser(outerEmail, OUTER_PASSWORD);
  });

  /** Logs in and navigates to /profile, waiting for the personal-info card to load. */
  function loginAndGoToProfile(email, password, { withAutocompleteMock = false } = {}) {
    new LoginPage().visit().enterIdentifier(email).enterPassword(password).submitLogin();
    if (withAutocompleteMock) {
      cy.visit("/profile", { onBeforeLoad: installGoogleAutocompleteMock });
    } else {
      cy.visit("/profile");
    }
    cy.contains(".location-info-card", "UITester").should("exist");
    return new ProfilePage().waitForLoad();
  }

  it("BASE, S2, S3, S4 - el perfil permite cargar y gestionar la información personal y la ubicación", () => {
    const ts = uniqueTs();
    const localEmail = `personalui${ts}@devorapp.test`;
    const localUsername = `personalui${ts % 100000}`;
    const localPassword = "Test1234!";
    cy.registerUserApi(localUsername, localEmail, localPassword);

    const page = loginAndGoToProfile(localEmail, localPassword, { withAutocompleteMock: true });

    // BASE: data is present
    page.getCardText("Información Personal").should("include", "UITester").and("include", "Test");
    page.getCardText("Ubicación Preferida").should("include", "Gijón");

    // Cancel personal edit restores original values
    page.editPersonalInfo().fillInputInCard("Información Personal", 0, "JuanModificado").fillInputInCard("Información Personal", 1, "PérezModificado").cancelPersonalInfo();
    page.getCardText("Información Personal").should("include", "UITester");

    // S2 & S3: Save updated nombre/apellidos
    page.editPersonalInfo().fillInputInCard("Información Personal", 0, "Juan").fillInputInCard("Información Personal", 1, "Pérez").savePersonalInfo();
    page.hasSuccessToast().should("be.true");
    page.dismissSuccessToast();
    page.getCardText("Información Personal").should("include", "Juan").and("include", "Pérez");

    // BASE: Type location manually without selecting -> error (Ubicación = Mal)
    page.clickButtonInCard("Ubicación Preferida", "Cambiar").fillInputInCard("Ubicación Preferida", 0, "aifgauif").clickButtonInCard("Ubicación Preferida", "Guardar cambios");
    page.getCardText("Ubicación Preferida").should("include", "Debes seleccionar una ubicación válida");

    // S4: Select location from autocomplete list (Ubicación = Bien)
    page.fillInputInCard("Ubicación Preferida", 0, "Barcelona, España");
    cy.triggerAutocompletePlaceChanged();
    page.clickButtonInCard("Ubicación Preferida", "Guardar cambios");
    page.hasSuccessToast().should("be.true");
    cy.contains(".location-info-card", "Ubicación Preferida").should("contain.text", "Barcelona, España");

    cy.deleteTestUser(localEmail, localPassword);
  });

  it("S5 a S16 - validación y cambio de correo electrónico y contraseña", () => {
    const ts = uniqueTs();

    // ── Email section ──────────────────────────────────────────────────────
    const emailUserEmail = `tempemail${ts}@devorapp.test`;
    const emailUserUsername = `tempemail${ts % 100000}`;
    const emailUserPassword = "Password123!";
    cy.registerUserApi(emailUserUsername, emailUserEmail, emailUserPassword);

    let page = loginAndGoToProfile(emailUserEmail, emailUserPassword);
    page.openEmailChange();

    // S7 & S9: required attributes
    cy.get("input[type='email']").should("have.attr", "required");
    cy.get("#email-password-input").should("have.attr", "required");

    // S5: invalid email format (HTML5 validation)
    page.fillNewEmail("invalidemail").fillEmailPassword(emailUserPassword).submitEmailChange();
    cy.get("input[type='email']").then(($el) => {
      expect($el[0].checkValidity(), "S5: HTML5 validity must fail for invalid email format").to.be.false;
    });

    // S8: wrong password
    page.fillNewEmail(`nuevo${ts}@correo.com`).fillEmailPassword("WrongPassword!").submitEmailChange();
    page.hasErrorToast().should("be.true");
    page.dismissErrorToast();

    // S6: email already in use
    page.fillNewEmail(outerEmail).fillEmailPassword(emailUserPassword).submitEmailChange();
    page.hasErrorToast().should("be.true");
    page.dismissErrorToast();

    // Happy path: successful email change
    const newEmail = `newtempemail${ts}@devorapp.test`;
    page.fillNewEmail(newEmail).fillEmailPassword(emailUserPassword).submitEmailChange();
    page.hasSuccessToast().should("be.true");
    page.getSuccessToastText().should("include", "confirmación");
    page.getCardText("Correo Electrónico").should("include", emailUserEmail);

    // ── Password section ──────────────────────────────────────────────────
    const ts2 = uniqueTs();
    const passUserEmail = `temppass${ts2}@devorapp.test`;
    const passUserUsername = `temppass${ts2 % 100000}`;
    const passUserPassword = "Password123!";
    cy.registerUserApi(passUserUsername, passUserEmail, passUserPassword);

    page = loginAndGoToProfile(passUserEmail, passUserPassword);
    page.openPasswordChange();

    // S11 & S12: required attributes
    cy.get("#current-password-input").should("have.attr", "required");
    cy.get("#new-password-input").should("have.attr", "required");

    // S13: password too short (7 chars)
    page.fillPasswordChange(passUserPassword, "Short1!", "Short1!").submitPasswordChange();
    page.hasErrorToast().should("be.true");
    page.getErrorToastText().should((msg) => {
      expect(msg.includes("8") || msg.toLowerCase().includes("caracteres"), "S13: message content").to.be.true;
    });
    page.dismissErrorToast();

    // S15: no numbers in new password
    page.fillPasswordChange(passUserPassword, "OnlyLettersPassword", "OnlyLettersPassword").submitPasswordChange();
    page.hasErrorToast().should("be.true");
    page.dismissErrorToast();

    // S16: no letters in new password
    page.fillPasswordChange(passUserPassword, "1234567890", "1234567890").submitPasswordChange();
    page.hasErrorToast().should("be.true");
    page.dismissErrorToast();

    // S10: wrong old password
    page.fillPasswordChange("WrongPassword!", "NewPassword123!", "NewPassword123!").submitPasswordChange();
    page.hasErrorToast().should("be.true");
    page.dismissErrorToast();

    // S14: successful password change (16-char new password)
    page.fillPasswordChange(passUserPassword, "NewPassword12345!", "NewPassword12345!").submitPasswordChange();
    page.hasSuccessToast().should("be.true");

    cy.deleteTestUser(emailUserEmail, emailUserPassword);
    cy.deleteTestUser(passUserEmail, "NewPassword12345!");
  });

  it("S17 - eliminación de cuenta tras validación de confirmación", () => {
    const ts = uniqueTs();
    const delEmail = `delui${ts}@devorapp.test`;
    const delUsername = `delui${ts % 100000}`;
    const delPassword = "Delete1234!";
    cy.registerUserApi(delUsername, delEmail, delPassword);

    const page = loginAndGoToProfile(delEmail, delPassword);
    page.openDeleteAccount();

    page.isDeleteButtonEnabled().should("be.false");

    page.fillDeleteConfirm("NO_CONFIRMAR");
    page.isDeleteButtonEnabled().should("be.false");

    page.fillDeleteConfirm("CONFIRMAR");
    page.isDeleteButtonEnabled().should("be.true");

    page.submitDeleteAccount();
    page.hasSuccessToast().should("be.true");
    cy.url().should("include", "/login");
  });
});
