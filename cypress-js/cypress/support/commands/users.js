// Test-user lifecycle shared by every spec.
import { newUser } from "../data/users";
import { api } from "./api";
import LoginPage from "../pages/LoginPage";

/**
 * Declares a user for the enclosing describe(): registered (API) before the suite, deleted after.
 * Returns the user object right away, so specs can use it inside tests and hooks.
 */
export function useTestUser(prefix, overrides) {
  const user = newUser(prefix, overrides);
  before(() => cy.createUser(user));
  after(() => cy.deleteUser(user));
  return user;
}

/** Registers `user` through the API (no login). */
Cypress.Commands.add("createUser", (user) => api.auth.register(user));

/** Logs in through the login form and waits for /home. */
Cypress.Commands.add("loginAs", (user) => {
  new LoginPage().visit().enterIdentifier(user.email).enterPassword(user.password).submitLogin();
});

/** Logs in through the API: the session cookie lands in the browser's cookie jar. */
Cypress.Commands.add("apiLoginAs", (user) => api.auth.login(user.email, user.password));

/** Deletes the account through the API. */
Cypress.Commands.add("deleteUser", (user) => {
  cy.apiLoginAs(user);
  return api.profile.remove(user.password);
});
