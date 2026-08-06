// API tests for user registration and login - Base-Choice coverage.
// Mirrors selenium-java's tests/api/TestApiRegister.java.
//
// Cases covered:
//   BASE   - valid registration returns HTTP 201 with user object.
//   S3     - already-used email -> HTTP 400/409.
//   S7     - login with correct credentials -> HTTP 200.
//   S8     - login with wrong password -> HTTP 401.
//   check  - GET /api/check-availability reflects email/username status.

import { authUrl, uniqueTs, uniqueEmail, uniqueUsername, registerPayload, loginPayload } from "../../support/commands/api";

describe("API - Register / Login - Base-Choice", () => {
  const PASSWORD = "Test1234!";

  it("BASE - valid registration returns HTTP 201 with user object", () => {
    const ts = uniqueTs();
    cy.apiPost(authUrl("/register"), registerPayload(uniqueUsername(ts), uniqueEmail(ts), PASSWORD, "Ana", "García", "")).then((res) => {
      expect(res.status, "Valid registration must return HTTP 201").to.eq(201);
    });
  });

  it("S3 - registering with a duplicate email returns HTTP 400 or 409", () => {
    const ts = uniqueTs();
    const email = uniqueEmail(ts);
    const username = uniqueUsername(ts);

    cy.apiPost(authUrl("/register"), registerPayload(username, email, PASSWORD, "Ana", "García", ""));
    cy.apiPost(authUrl("/register"), registerPayload(uniqueUsername(uniqueTs()), email, PASSWORD, "Ana", "García", "")).then((res) => {
      expect([400, 409], `Registering with a duplicate email must return HTTP 400 or 409, got: ${res.status}`).to.include(res.status);
    });
  });

  it("check-availability - email free returns email_taken=false; after registration email_taken=true", () => {
    const ts = uniqueTs();
    const email = uniqueEmail(ts);
    const username = uniqueUsername(ts);

    cy.apiGet(authUrl(`/check-availability?email=${email}`)).then((before) => {
      expect(before.body.email_taken, "email_taken must be false before registration").to.eq(false);
    });

    cy.apiPost(authUrl("/register"), registerPayload(username, email, PASSWORD, "Test", "User", ""));

    cy.apiGet(authUrl(`/check-availability?email=${email}`)).then((after) => {
      expect(after.body.email_taken, "email_taken must be true after registration").to.eq(true);
    });
  });

  it("check-availability - username free returns username_taken=false; after registration username_taken=true", () => {
    const ts = uniqueTs();
    const email = uniqueEmail(ts);
    const username = uniqueUsername(ts);

    cy.apiGet(authUrl(`/check-availability?username=${username}`)).then((before) => {
      expect(before.body.username_taken, "username_taken must be false before registration").to.eq(false);
    });

    cy.apiPost(authUrl("/register"), registerPayload(username, email, PASSWORD, "Test", "User", ""));

    cy.apiGet(authUrl(`/check-availability?username=${username}`)).then((after) => {
      expect(after.body.username_taken, "username_taken must be true after registration").to.eq(true);
    });
  });

  it("S7 - login with correct credentials returns HTTP 200", () => {
    const ts = uniqueTs();
    const email = uniqueEmail(ts);
    const username = uniqueUsername(ts);

    cy.apiPost(authUrl("/register"), registerPayload(username, email, PASSWORD, "Test", "User", ""));
    cy.apiPost(authUrl("/login"), loginPayload(email, PASSWORD)).then((res) => {
      expect(res.status, "Login with correct credentials must return HTTP 200").to.eq(200);
    });
  });

  it("S8 - login with wrong password returns HTTP 401", () => {
    const ts = uniqueTs();
    const email = uniqueEmail(ts);
    const username = uniqueUsername(ts);

    cy.apiPost(authUrl("/register"), registerPayload(username, email, PASSWORD, "Test", "User", ""));
    cy.apiPost(authUrl("/login"), loginPayload(email, "WrongPassword99!")).then((res) => {
      expect(res.status, "Login with wrong password must return HTTP 401").to.eq(401);
    });
  });
});
