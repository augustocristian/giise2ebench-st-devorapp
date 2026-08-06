// API Base-Choice tests for the user profile module.
// Mirrors selenium-java's tests/api/TestApiProfileBC.java.
//
// Cases covered:
//   BASE   - GET /api/me returns the registered user's data.
//   S2+S3  - PATCH /api/profile updates nombre and apellidos.
//   S8     - PATCH /api/profile/email with wrong password -> HTTP 401.
//   S10    - PATCH /api/profile/password with wrong current password -> HTTP 400/401.
//   S13    - PATCH /api/profile/password with new password < 8 chars -> HTTP 400.
//   S14    - PATCH /api/profile/password with valid new password -> HTTP 200.
//   S17    - DELETE /api/profile removes the account -> subsequent GET /api/me -> 401.

import { authUrl, uniqueTs, uniqueEmail, uniqueUsername, registerPayload, loginPayload, profileUpdatePayload } from "../../support/commands/api";

describe("API - Profile - Base-Choice", () => {
  let username;
  let email;
  let password;

  before(() => {
    const ts = uniqueTs();
    username = uniqueUsername(ts);
    email = uniqueEmail(ts);
    password = "Test1234!";
    cy.apiRegisterAndLogin(username, email, password);
  });

  beforeEach(() => {
    cy.apiLogin(email, password);
  });

  after(() => {
    cy.deleteTestUser(email, password);
  });

  it("BASE - GET /api/me returns the authenticated user's username and email", () => {
    cy.apiGet(authUrl("/me")).then((res) => {
      expect(res.body.username, "username must match").to.eq(username);
      expect(res.body.email, "email must match").to.eq(email);
    });
  });

  it("S2+S3 - PATCH /api/profile updates nombre and apellidos; GET /api/me reflects them", () => {
    const newNombre = `NuevoNombre${uniqueTs()}`;
    const newApellidos = "NuevosApellidos";

    cy.apiPatch(authUrl("/profile"), profileUpdatePayload(newNombre, newApellidos, "", password)).then((res) => {
      expect(res.status, "PATCH /api/profile must return 200").to.eq(200);
    });

    cy.apiGet(authUrl("/me")).then((res) => {
      expect(res.body.nombre, "nombre must be updated").to.eq(newNombre);
      expect(res.body.apellidos, "apellidos must be updated").to.eq(newApellidos);
    });
  });

  it("S8 - PATCH /api/profile/email with wrong password returns HTTP 401", () => {
    cy.apiPatch(authUrl("/profile/email"), {
      new_email: `nuevo${uniqueTs()}@devorapp.test`,
      password: "WrongPassword99!",
    }).then((res) => {
      expect(res.status, "Wrong password for email change must return HTTP 401").to.eq(401);
    });
  });

  it("S10 - PATCH /api/profile/password with wrong current password is rejected with HTTP 400 or 401", () => {
    cy.apiPatch(authUrl("/profile/password"), {
      old_password: "WrongCurrent99!",
      new_password: "NuevaPass123!",
    }).then((res) => {
      expect([400, 401], `Wrong current password must be rejected (400/401), got: ${res.status}`).to.include(res.status);
    });
  });

  it("S13 - PATCH /api/profile/password with new password < 8 chars returns HTTP 400", () => {
    cy.apiPatch(authUrl("/profile/password"), {
      old_password: password,
      new_password: "Sh1!",
    }).then((res) => {
      expect(res.status, "New password shorter than 8 chars must return HTTP 400").to.eq(400);
    });
  });

  it("S14 - PATCH /api/profile/password with valid credentials returns HTTP 200", () => {
    const newPass = "NuevaPassword1234!";

    cy.apiPatch(authUrl("/profile/password"), { old_password: password, new_password: newPass }).then((res) => {
      expect(res.status, "Valid password change must return HTTP 200").to.eq(200);
    });

    // Restore original password so other tests and teardown are not affected.
    cy.apiPatch(authUrl("/profile/password"), { old_password: newPass, new_password: password });
  });

  it("S17 - DELETE /api/profile removes the account; subsequent GET /api/me returns 401", () => {
    // Create and login a separate user dedicated to deletion.
    const ts = uniqueTs();
    const delEmail = uniqueEmail(ts);
    const delUsername = uniqueUsername(ts);
    const delPassword = "Delete1234!";

    cy.apiPost(authUrl("/register"), registerPayload(delUsername, delEmail, delPassword, "Del", "User", ""));
    cy.apiPost(authUrl("/login"), loginPayload(delEmail, delPassword));

    cy.apiDelete(authUrl("/profile"), { password: delPassword }).then((res) => {
      expect(res.status, "DELETE /api/profile must return HTTP 200").to.eq(200);
    });

    cy.apiGet(authUrl("/me")).then((res) => {
      expect(res.status, "After account deletion GET /api/me must return 401").to.eq(401);
    });

    // Restore the outer suite's session for subsequent tests.
    cy.apiLogin(email, password);
  });
});
