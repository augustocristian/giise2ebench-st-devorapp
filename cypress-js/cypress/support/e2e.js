import "./commands";

// Mirrors selenium-java's BaseLoggedClass#setup: every test starts with a
// clean cookie/localStorage/sessionStorage/IndexedDB slate.
beforeEach(() => {
  cy.clearAppSession();
});

// The app integrates with third-party SDKs (Google Maps, Google Identity)
// that can throw uncaught exceptions unrelated to the behavior under test.
// Mirrors the Java suite's tolerance for such noise (it never asserted on it).
Cypress.on("uncaught:exception", () => {
  return false;
});
