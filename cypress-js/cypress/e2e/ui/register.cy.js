// Registration flow: step 1 validation, step 2 location and backend password policy.
import RegisterPage from "../../support/pages/RegisterPage";
import { newUser } from "../../support/data/users";
import { useTestUser } from "../../support/commands/users";

describe("Register", () => {
  const existing = useTestUser("regdup");

  // A valid candidate; each test overrides only the field under test.
  const fresh = (overrides) => newUser("reg", overrides);

  function goToStep2(user, options) {
    return new RegisterPage().visit(options).fillStep1(user).continueToStep2().expectOnStep(2);
  }

  describe("Successful registration", () => {
    [
      ["BASE", "valid data with a 9-character password", "Segura123"],
      ["S11", "a 16-character password", "Segura1234567890"],
    ].forEach(([id, title, password]) => {
      it(`${id} - ${title} leads to the verify-email screen`, () => {
        const user = fresh({ password });
        goToStep2(user, { withAutocompleteMock: true })
          .selectLocation("Madrid, España")
          .submit()
          .expectVerifyEmailShown();
        cy.deleteUser(user);
      });
    });
  });

  describe("Step 1 validation", () => {
    const cases = [
      ["S4", "empty email", { email: "" }, "El email es obligatorio"],
      ["S2", "malformed email", { email: "correosinformato" }, "email válido"],
      ["S5", "empty username", { username: "" }, "nombre de usuario es obligatorio"],
      ["S7", "empty first name", { first_name: "" }, "nombre es obligatorio"],
      ["S8", "empty last name", { last_name: "" }, "apellidos son obligatorios"],
      ["S9", "empty password", { password: "" }, "contraseña es obligatoria"],
      ["S10", "6-character password", { password: "Seg123" }, "al menos 8 caracteres"],
    ];

    cases.forEach(([id, title, overrides, message]) => {
      it(`${id} - ${title} keeps the user on step 1 with an error`, () => {
        new RegisterPage()
          .visit()
          .fillStep1(fresh(overrides))
          .continueToStep2()
          .expectOnStep(1)
          .expectStepError(message);
      });
    });

    it("S3 - an already registered email is rejected", () => {
      new RegisterPage()
        .visit()
        .fillStep1(fresh({ email: existing.email }))
        .continueToStep2()
        .expectEmailError("registrado");
    });

    it("S6 - an already used username is rejected", () => {
      new RegisterPage()
        .visit()
        .fillStep1(fresh({ username: existing.username }))
        .continueToStep2()
        .expectUsernameError("uso");
    });
  });

  describe("Step 2 validation", () => {
    it("S16 - an empty location is rejected", () => {
      goToStep2(fresh())
        .submit()
        .expectOnStep(2)
        .expectMessageError(/ubicación/i);
    });

    it("S15 - a location typed but not picked from the list is rejected", () => {
      goToStep2(fresh())
        .typeLocation("Ubicación No Válida")
        .submit()
        .expectOnStep(2)
        .expectMessageError(/ubicación/i);
    });

    [
      ["S13", "a password without letters", "12345678"],
      ["S12", "a password without numbers", "PasswordNoNum"],
    ].forEach(([id, title, password]) => {
      it(`${id} - ${title} is rejected by the backend`, () => {
        goToStep2(fresh({ password }), { withAutocompleteMock: true })
          .selectLocation("Gijón, España")
          .submit()
          .expectMessageError(/contraseña/i);
      });
    });
  });
});
