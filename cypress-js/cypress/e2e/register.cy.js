// Browser tests for the DevorApp registration flow.
// Mirrors selenium-java's tests/e2e/TestRegisterView.java.
//
// Base-Choice coverage:
//   BASE - successful registration with valid 9-char password (S7 happy path).
//   S2-S10 - step-1 field validations (email, username, nombre, apellidos, password).
//   S11-S16 - step-2 validations (location required, backend password policy:
//     no-letter, no-number) plus successful registration with a 16-char password.

import RegisterPage from "../support/pages/RegisterPage";
import { installGoogleAutocompleteMock } from "../support/commands/mocks";
import { uniqueTs, uniqueEmail, uniqueUsername } from "../support/commands/api";

describe("Register", () => {
  const BASE_PASSWORD = "Segura123";
  const BASE_NOMBRE = "Ana";
  const BASE_APELLIDOS = "García";

  let dupEmail;
  let dupUsername;

  before(() => {
    const ts = uniqueTs();
    dupUsername = `dupuser${ts % 100000}`;
    dupEmail = `dup.email.${ts}@devorapp.test`;
    cy.registerTestUser(dupUsername, dupEmail, BASE_PASSWORD);
  });

  after(() => {
    cy.deleteTestUser(dupEmail, BASE_PASSWORD);
  });

  function fillStep1(reg, email, username, password, nombre, apellidos) {
    reg.enterEmail(email).enterUsername(username).enterPassword(password).enterNombre(nombre).enterApellidos(apellidos);
  }

  /** Visits /register with the Google Autocomplete mock pre-installed, so it's ready before step 2 mounts. */
  function visitRegisterWithMock() {
    cy.visit("/register", { onBeforeLoad: installGoogleAutocompleteMock });
    cy.get(RegisterPage.SELECTORS.form).should("be.visible");
    return new RegisterPage();
  }

  it("debe registrarse correctamente con datos válidos y redirigir a verifica correo (BASE)", () => {
    const reg = visitRegisterWithMock();

    const ts = uniqueTs();
    const email = `regbase${ts}@devorapp.test`;
    const username = `regbase${ts % 100000}`;

    fillStep1(reg, email, username, BASE_PASSWORD, BASE_NOMBRE, BASE_APELLIDOS);
    reg.clickContinue().waitForStep2();
    reg.isOnStep2().should("be.true");

    reg.enterUbicacion("Madrid, España");
    cy.triggerAutocompletePlaceChanged();
    reg.clickSubmit();

    reg.isVerifyEmailVisible().should("be.true");
    cy.deleteTestUser(email, BASE_PASSWORD);
  });

  it("debe validar todos los campos obligatorios en el paso 1 (S2-S10)", () => {
    const ts = uniqueTs();
    const validEmail = `valid${ts}@devorapp.test`;
    const validUsername = `valid${ts % 100000}`;

    // S4: Correo vacío
    let reg = new RegisterPage().visit();
    fillStep1(reg, "", validUsername, BASE_PASSWORD, BASE_NOMBRE, BASE_APELLIDOS);
    reg.clickContinue();
    reg.isOnStep1().should("be.true");
    reg.getErrorMessage().should((msg) => {
      expect(msg.includes("email") || msg.includes("obligatorio"), "S4: email error").to.be.true;
    });

    // S2: Correo inválido
    reg = new RegisterPage().visit();
    fillStep1(reg, "correosinformato", validUsername, BASE_PASSWORD, BASE_NOMBRE, BASE_APELLIDOS);
    reg.clickContinue();
    reg.isOnStep1().should("be.true");
    reg.getErrorMessage().should((msg) => {
      expect(msg.includes("email") || msg.includes("válido"), "S2: invalid email error").to.be.true;
    });

    // S3: Correo en uso
    reg = new RegisterPage().visit();
    fillStep1(reg, dupEmail, validUsername, BASE_PASSWORD, BASE_NOMBRE, BASE_APELLIDOS);
    reg.clickContinue();
    reg.getEmailError().should("include", "registrado");

    // S5: Nombre de usuario vacío
    reg = new RegisterPage().visit();
    fillStep1(reg, validEmail, "", BASE_PASSWORD, BASE_NOMBRE, BASE_APELLIDOS);
    reg.clickContinue();
    reg.isOnStep1().should("be.true");
    reg.getErrorMessage().should((msg) => {
      expect(msg.includes("usuario") || msg.includes("obligatorio"), "S5: username error").to.be.true;
    });

    // S6: Nombre de usuario en uso
    reg = new RegisterPage().visit();
    fillStep1(reg, validEmail, dupUsername, BASE_PASSWORD, BASE_NOMBRE, BASE_APELLIDOS);
    reg.clickContinue();
    reg.getUsernameError().should("include", "uso");

    // S7: Nombre vacío
    reg = new RegisterPage().visit();
    fillStep1(reg, validEmail, validUsername, BASE_PASSWORD, "", BASE_APELLIDOS);
    reg.clickContinue();
    reg.isOnStep1().should("be.true");
    reg.getErrorMessage().should("include", "nombre");

    // S8: Apellidos vacíos
    reg = new RegisterPage().visit();
    fillStep1(reg, validEmail, validUsername, BASE_PASSWORD, BASE_NOMBRE, "");
    reg.clickContinue();
    reg.isOnStep1().should("be.true");
    reg.getErrorMessage().should((msg) => {
      expect(msg, "S8: apellidos error must be shown").to.not.be.empty;
    });

    // S9: Contraseña vacía
    reg = new RegisterPage().visit();
    fillStep1(reg, validEmail, validUsername, "", BASE_NOMBRE, BASE_APELLIDOS);
    reg.clickContinue();
    reg.isOnStep1().should("be.true");
    reg.getErrorMessage().should((msg) => {
      expect(msg.includes("contraseña") || msg.includes("obligatoria"), "S9: password empty error").to.be.true;
    });

    // S10: Contraseña corta (6 chars)
    reg = new RegisterPage().visit();
    fillStep1(reg, validEmail, validUsername, "Seg123", BASE_NOMBRE, BASE_APELLIDOS);
    reg.clickContinue();
    reg.isOnStep1().should("be.true");
    reg.getErrorMessage().should((msg) => {
      expect(msg.includes("8") || msg.includes("caracteres"), "S10: short password error").to.be.true;
    });
  });

  it("debe validar ubicación, política de contraseña backend (S12, S13, S15, S16) y registro exitoso con contraseña larga (S11)", () => {
    const ts = uniqueTs();

    // S16: Ubicación vacía
    let reg = new RegisterPage().visit();
    fillStep1(reg, `regloc1${ts}@devorapp.test`, `reglocone${ts % 10000}`, "12345678", BASE_NOMBRE, BASE_APELLIDOS);
    reg.clickContinue().waitForStep2();
    reg.clickSubmit();
    reg.isOnStep2().should("be.true");
    reg.getErrorMessage().should((msg) => {
      expect(msg.includes("ubicación") || msg.includes("lista"), "S16: location empty error").to.be.true;
    });

    // S15: Ubicación manual no seleccionada
    reg = new RegisterPage().visit();
    fillStep1(reg, `regloc2${ts}@devorapp.test`, `regloctwo${ts % 10000}`, "12345678", BASE_NOMBRE, BASE_APELLIDOS);
    reg.clickContinue().waitForStep2();
    reg.enterUbicacion("Ubicación No Válida");
    reg.clickSubmit();
    reg.isOnStep2().should("be.true");
    reg.getErrorMessage().should((msg) => {
      expect(msg.includes("ubicación") || msg.includes("lista"), "S15: manual location error").to.be.true;
    });

    // S13: Contraseña sin letras (error del backend)
    reg = visitRegisterWithMock();
    fillStep1(reg, `regloc3${ts}@devorapp.test`, `reglocthree${ts % 10000}`, "12345678", BASE_NOMBRE, BASE_APELLIDOS);
    reg.clickContinue().waitForStep2();
    reg.enterUbicacion("Gijón, España");
    cy.triggerAutocompletePlaceChanged();
    reg.clickSubmit();
    reg.getErrorMessage().should((msg) => {
      const lower = msg.toLowerCase();
      expect(lower.includes("letra") || lower.includes("contraseña") || lower.includes("password"), "S13: no-letter password backend error").to.be.true;
    });

    // S12: Contraseña sin números (error del backend)
    reg = visitRegisterWithMock();
    fillStep1(reg, `regloc4${ts}@devorapp.test`, `reglocfour${ts % 10000}`, "PasswordNoNum", BASE_NOMBRE, BASE_APELLIDOS);
    reg.clickContinue().waitForStep2();
    reg.enterUbicacion("Gijón, España");
    cy.triggerAutocompletePlaceChanged();
    reg.clickSubmit();
    reg.getErrorMessage().should((msg) => {
      const lower = msg.toLowerCase();
      expect(lower.includes("número") || lower.includes("number") || lower.includes("contraseña") || lower.includes("password"), "S12: no-number password backend error").to.be.true;
    });

    // S11: Registro exitoso con contraseña larga (16 chars)
    reg = visitRegisterWithMock();
    const ts2 = uniqueTs();
    const emailS11 = `reglong${ts2}@devorapp.test`;
    const passwordS11 = "Segura1234567890";

    fillStep1(reg, emailS11, `reglong${ts2 % 100000}`, passwordS11, BASE_NOMBRE, BASE_APELLIDOS);
    reg.clickContinue().waitForStep2();
    reg.isOnStep2().should("be.true");

    reg.enterUbicacion("Madrid, España");
    cy.triggerAutocompletePlaceChanged();
    reg.clickSubmit();

    reg.isVerifyEmailVisible().should("be.true");
    // Track for cleanup (mirrors Java's registerEmailForCleanup).
    cy.deleteTestUser(emailS11, passwordS11);
  });
});
