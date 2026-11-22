import "./commands";

beforeEach(() => {
  cy.clearAppSession();
  cy.stubGoogleNetwork();
});

// Third-party SDKs (Google Maps/Identity) can throw uncaught errors unrelated to the behaviour under test.
Cypress.on("uncaught:exception", () => false);
