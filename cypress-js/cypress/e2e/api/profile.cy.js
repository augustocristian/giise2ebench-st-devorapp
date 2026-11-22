// Profile: read, update, email/password changes and account deletion.
import { api } from "../../support/commands/api";
import { newUser } from "../../support/data/users";
import { useTestUser } from "../../support/commands/users";

describe("API - Profile - Base-Choice", () => {
  const user = useTestUser("profapi");

  beforeEach(() => cy.apiLoginAs(user));

  it("BASE - GET /me returns the authenticated user's username and email", () => {
    api.auth.me().then((res) => {
      expect(res.body.username, "username must match the registered one").to.eq(user.username);
      expect(res.body.email, "email must match the registered one").to.eq(user.email);
    });
  });

  it("S2+S3 - PATCH /profile updates first_name and last_name, and GET /me reflects them", () => {
    const firstName = `NewName${Date.now()}`;
    const lastName = "NewSurname";

    api.profile
      .update({ first_name: firstName, last_name: lastName, location: "", password: user.password })
      .its("status")
      .should("eq", 200);

    api.auth.me().then((res) => {
      expect(res.body.first_name, "first_name must be updated").to.eq(firstName);
      expect(res.body.last_name, "last_name must be updated").to.eq(lastName);
    });
  });

  it("S8 - changing the email with a wrong password returns 401", () => {
    api.profile.changeEmail(`new${Date.now()}@devorapp.test`, "WrongPassword99!").its("status").should("eq", 401);
  });

  it("S10 - changing the password with a wrong current password is rejected (400/401)", () => {
    api.profile.changePassword("WrongCurrent99!", "NewPass123!").then((res) => {
      expect([400, 401], `Wrong current password must be rejected, got ${res.status}`).to.include(res.status);
    });
  });

  it("S13 - a new password shorter than 8 characters returns 422", () => {
    api.profile.changePassword(user.password, "Sh1!").its("status").should("eq", 422);
  });

  it("S14 - a valid password change returns 200", () => {
    const newPassword = "NewPassword1234!";

    api.profile.changePassword(user.password, newPassword).its("status").should("eq", 200);

    // Restore it so the other tests and the teardown can still log in.
    api.profile.changePassword(newPassword, user.password).its("status").should("eq", 200);
  });

  it("S17 - deleting the account returns 200 and GET /me then returns 401", () => {
    const doomed = newUser("delapi", { password: "Delete1234!" });
    cy.createUser(doomed);
    cy.apiLoginAs(doomed);

    api.profile.remove(doomed.password).its("status").should("eq", 200);
    api.auth.me().its("status").should("eq", 401);
  });
});
