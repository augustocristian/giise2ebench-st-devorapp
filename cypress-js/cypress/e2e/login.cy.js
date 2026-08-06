// Browser tests for the DevorApp login page.
// Mirrors selenium-java's tests/e2e/TestLogin.java.
//
// Base-Choice coverage:
//   BASE - valid credentials redirect to /home (S7 - Happy Path).
//   S3-S6 - empty identifier and/or password trigger a validation error (BASE, S3, S4, S5, S6).
//   S8 - wrong password shows an error and stays on /login.

import LoginPage from "../support/pages/LoginPage";
import { authUrl, uniqueTs, uniqueEmail, uniqueUsername } from "../support/commands/api";

describe("Login", () => {
  const PASSWORD = "Test1234!";
  let testEmail;
  let testUsername;

  before(() => {
    const ts = uniqueTs();
    testUsername = uniqueUsername(ts);
    testEmail = uniqueEmail(ts);
    cy.registerTestUser(testUsername, testEmail, PASSWORD);
  });

  after(() => {
    cy.deleteTestUser(testEmail, PASSWORD);
  });

  it("Valid credentials redirect the user to the home page (S7)", () => {
    // S7 - Happy path (email/password)
    new LoginPage().visit().enterIdentifier(testEmail).enterPassword(PASSWORD).submitLogin();
    cy.url().should("include", "/home");
  });

  it("Empty fields (BASE, S3-S6) and wrong password (S8) trigger validation errors", () => {
    // 1. BASE: existing email, empty password
    let page = new LoginPage().visit().enterIdentifier(testEmail).enterPassword("");
    page.submitLoginExpectingFailure();
    page.hasErrorMessage().should("be.true");

    // 2. S3: non-existing email, empty password
    page = new LoginPage().visit().enterIdentifier("nonexistent@devorapp.test").enterPassword("");
    page.submitLoginExpectingFailure();
    page.hasErrorMessage().should("be.true");

    // 3. S4: existing username, empty password
    page = new LoginPage().visit().enterIdentifier(testUsername).enterPassword("");
    page.submitLoginExpectingFailure();
    page.hasErrorMessage().should("be.true");

    // 4. S5: non-existing username, empty password
    page = new LoginPage().visit().enterIdentifier("nonexistentuser").enterPassword("");
    page.submitLoginExpectingFailure();
    page.hasErrorMessage().should("be.true");

    // 5. S6: both fields empty
    page = new LoginPage().visit().enterIdentifier("").enterPassword("");
    page.submitLoginExpectingFailure();
    page.hasErrorMessage().should("be.true");

    // 6. S8: correct identifier, wrong password
    page = new LoginPage().visit().enterIdentifier(testEmail).enterPassword("WrongPassword99!");
    page.submitLoginExpectingFailure();
    page.hasErrorMessage().should("be.true");
    cy.url().should("include", "/login");
  });
});
