// Login page: happy path and validation of empty or wrong credentials.
import LoginPage from "../../support/pages/LoginPage";
import HomePage from "../../support/pages/HomePage";
import { useTestUser } from "../../support/commands/users";

describe("Login", () => {
  const user = useTestUser("login");

  it("S7 - valid credentials redirect to the home page", () => {
    cy.loginAs(user);
    new HomePage().expectLoaded();
  });

  const failures = [
    ["BASE", "existing email, empty password", () => user.email, ""],
    ["S3", "unknown email, empty password", () => "nonexistent@devorapp.test", ""],
    ["S4", "existing username, empty password", () => user.username, ""],
    ["S5", "unknown username, empty password", () => "nonexistentuser", ""],
    ["S6", "both fields empty", () => "", ""],
    ["S8", "existing email, wrong password", () => user.email, "WrongPassword99!"],
  ];

  failures.forEach(([id, title, identifier, password]) => {
    it(`${id} - ${title} shows an error and stays on /login`, () => {
      new LoginPage()
        .visit()
        .enterIdentifier(identifier())
        .enterPassword(password)
        .submit()
        .expectError()
        .expectOnLogin();
    });
  });
});
