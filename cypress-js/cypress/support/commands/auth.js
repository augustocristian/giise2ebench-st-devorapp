// Mirrors selenium-java's common/BaseLoggedClass.java (browser test-user
// lifecycle) and common/BaseApiClass.java (registerAndLogin/deleteTestUser).
//
// Unlike Java's JUnit5 static @BeforeAll/@AfterAll (which needed a
// ConcurrentHashMap<Class, ...> keyed by calling class to survive static
// context), each Cypress spec file is naturally isolated - a spec-local
// array/object for tracking users to clean up is enough. This is an
// intentional simplification, not a missing feature.

import { authUrl, registerPayload, loginPayload } from "./api";

// Registers a new user via POST /api/register only (UI tests then log in
// through the actual login form). Mirrors BaseLoggedClass#setupTestUser.
Cypress.Commands.add("registerTestUser", (username, email, password) => {
  return cy.apiPost(authUrl("/register"), registerPayload(username, email, password, "UITester", "Test", "Gijón"));
});

// Registers a user via the API without logging in - used for extra users
// created mid-test (e.g. duplicate-email scenarios) that must be cleaned up
// alongside the primary test user. Mirrors BaseLoggedClass#registerUserApi.
Cypress.Commands.add("registerUserApi", (username, email, password) => {
  return cy.apiPost(authUrl("/register"), registerPayload(username, email, password, "UITester", "Test", "Gijón"));
});

// Registers + logs in via the API (JWT cookie captured by Cypress's cookie
// jar automatically). Mirrors BaseApiClass#registerAndLogin.
Cypress.Commands.add("apiRegisterAndLogin", (username, email, password) => {
  cy.apiPost(authUrl("/register"), registerPayload(username, email, password, "Test", "User", ""));
  return cy.apiLogin(email, password);
});

// Logs in via the API so subsequent cy.apiPost/apiDelete calls carry the JWT
// session cookie. Mirrors BaseLoggedClass#apiLogin.
Cypress.Commands.add("apiLogin", (email, password) => {
  return cy.apiPost(authUrl("/login"), loginPayload(email, password));
});

// Logs in as (email, password) and deletes the account. Mirrors
// BaseLoggedClass#tearDownTestUser / BaseApiClass#deleteTestUser.
Cypress.Commands.add("deleteTestUser", (email, password) => {
  if (!email || !password) return;
  cy.apiLogin(email, password);
  return cy.apiDelete(authUrl("/profile"), { password });
});

// Clears cookies, localStorage, sessionStorage, and all IndexedDB databases
// (where Firebase stores JWT tokens). Mirrors BaseLoggedClass#clearSession.
Cypress.Commands.add("clearAppSession", () => {
  cy.clearCookies();
  cy.clearLocalStorage();
  cy.window({ log: false }).then((win) => {
    try {
      win.sessionStorage.clear();
    } catch (e) {
      // ignore, mirrors Java's try/catch-ignore pattern
    }
    try {
      if (win.indexedDB && win.indexedDB.databases) {
        win.indexedDB.databases().then((dbs) => {
          dbs.forEach((db) => {
            try {
              win.indexedDB.deleteDatabase(db.name);
            } catch (e) {
              // ignore
            }
          });
        });
      }
    } catch (e) {
      // ignore
    }
  });
});
