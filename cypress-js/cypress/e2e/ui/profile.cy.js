// Profile page: personal info, location, email change, password change and account deletion.
import ProfilePage from "../../support/pages/ProfilePage";
import LoginPage from "../../support/pages/LoginPage";
import { TID } from "../../support/testids";
import { newUser } from "../../support/data/users";
import { useTestUser } from "../../support/commands/users";

const P = TID.profile;

/** A user created before and deleted after every test, for scenarios that change the account. */
function useUserPerTest(prefix) {
  const user = {};
  beforeEach(() => {
    Object.assign(user, newUser(prefix));
    cy.createUser(user);
  });
  afterEach(() => cy.deleteUser(user));
  return user;
}

describe("Profile", () => {
  let profile;

  describe("Personal info and location", () => {
    const user = useUserPerTest("profinfo");

    beforeEach(() => {
      cy.loginAs(user);
      profile = new ProfilePage().visit({ withAutocompleteMock: true });
    });

    it("BASE - the registered data is displayed", () => {
      profile
        .expectCardText(P.cardPersonal, user.first_name)
        .expectCardText(P.cardPersonal, user.last_name)
        .expectCardText(P.cardLocation, user.location);
    });

    it("BASE - cancelling the personal info edit keeps the original values", () => {
      profile.editPersonalInfo().fillPersonalInfo("JuanModificado", "PérezModificado").cancelPersonalInfo();
      profile.expectCardText(P.cardPersonal, user.first_name).expectCardNotText(P.cardPersonal, "JuanModificado");
    });

    it("S2, S3 - saving a new first and last name updates the card", () => {
      profile.editPersonalInfo().fillPersonalInfo("Juan", "Pérez").savePersonalInfo();
      profile.expectToast("success").expectCardText(P.cardPersonal, "Juan").expectCardText(P.cardPersonal, "Pérez");
    });

    it("BASE - a location typed but not picked from the list is rejected", () => {
      profile.editLocation().typeLocation("aifgauif").saveLocation();
      profile.expectCardText(P.cardLocation, "Debes seleccionar una ubicación válida");
    });

    it("S4 - a location picked from the autocomplete is saved", () => {
      profile.editLocation().typeLocation("Barcelona, España");
      cy.triggerAutocompletePlaceChanged();
      profile.saveLocation();
      profile.expectToast("success").expectCardText(P.cardLocation, "Barcelona, España");
    });
  });

  describe("Email change", () => {
    const user = useTestUser("profemail");
    const other = useTestUser("profother");

    beforeEach(() => {
      cy.loginAs(user);
      profile = new ProfilePage().visit().openEmailChange();
    });

    it("S7, S9 - the new email and the password are required", () => {
      cy.tid(P.emailInput).should("have.attr", "required");
      cy.tid(P.emailPassword).should("have.attr", "required");
    });

    it("S5 - a malformed email fails HTML5 validation", () => {
      profile.changeEmail("invalidemail", user.password);
      cy.tid(P.emailInput).then(($input) => expect($input[0].checkValidity()).to.be.false);
    });

    it("S8 - a wrong password is rejected", () => {
      profile.changeEmail(newUser("newmail").email, "WrongPassword!").expectToast("error");
    });

    it("S6 - an email already in use is rejected", () => {
      profile.changeEmail(other.email, user.password).expectToast("error");
    });

    it("BASE - a valid change asks for confirmation and keeps the current email", () => {
      profile.changeEmail(newUser("newmail").email, user.password).expectToast("success", "confirmación");
      profile.expectCardText(P.cardEmail, user.email);
    });
  });

  describe("Password change", () => {
    const user = useTestUser("profpass");

    beforeEach(() => {
      cy.loginAs(user);
      profile = new ProfilePage().visit().openPasswordChange();
    });

    it("S11, S12 - the current and the new password are required", () => {
      cy.tid(P.securityCurrent).should("have.attr", "required");
      cy.tid(P.securityNew).should("have.attr", "required");
    });

    it("S13 - a 7-character password is rejected", () => {
      profile.changePassword(user.password, "Short1!").expectToast("error", "8 caracteres");
    });

    it("S15 - a password without numbers is rejected", () => {
      profile.changePassword(user.password, "OnlyLettersPassword").expectToast("error");
    });

    it("S16 - a password without letters is rejected", () => {
      profile.changePassword(user.password, "1234567890").expectToast("error");
    });

    it("S10 - a wrong current password is rejected", () => {
      profile.changePassword("WrongPassword!", "NewPassword123!").expectToast("error");
    });
  });

  describe("Password change success", () => {
    const user = useUserPerTest("profnewpass");

    it("S14 - a valid 17-character password is accepted and works for the next login", () => {
      const newPassword = "NewPassword12345!";
      cy.loginAs(user);
      new ProfilePage().visit().openPasswordChange().changePassword(user.password, newPassword).expectToast("success");
      // Deferred: commands read the user lazily, so cleanup needs the new password only after the change.
      cy.then(() => {
        user.password = newPassword;
      });
      cy.clearCookies();
      new LoginPage().visit().enterIdentifier(user.email).enterPassword(newPassword).submitLogin();
    });
  });

  describe("Account deletion", () => {
    const user = useUserPerTest("profdel");

    beforeEach(() => {
      cy.loginAs(user);
      profile = new ProfilePage().visit().openDeleteAccount();
    });

    it("S17 - the delete button stays disabled until CONFIRMAR is typed", () => {
      profile.expectDeleteEnabled(false).fillDeleteConfirm("NO_CONFIRMAR").expectDeleteEnabled(false);
      profile.fillDeleteConfirm("CONFIRMAR").expectDeleteEnabled(true);
    });

    it("S17 - confirming deletes the account and returns to /login", () => {
      profile.fillDeleteConfirm("CONFIRMAR").submitDeleteAccount().expectToast("success");
      cy.url().should("include", "/login");
    });
  });
});
