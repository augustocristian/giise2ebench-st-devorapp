// Mirrors selenium-java's BaseLoggedClass#injectAutocompleteMock /
// #triggerAutocompletePlaceChanged, and the Google Identity Services mock
// pattern already proven in sut/frontend/e2e/login.spec.ts (Playwright
// addInitScript), adapted to Cypress's cy.visit({ onBeforeLoad }) hook.

// Installs a mock window.google.maps.places.Autocomplete class. Must run via
// onBeforeLoad on the same cy.visit() that mounts the component needing it,
// so the app finds window.google immediately - mirrors the Java requirement
// to inject "before step 2 mounts".
export function installGoogleAutocompleteMock(win) {
  class MockAutocomplete {
    constructor(input) {
      win.mockAutocompleteInstance = this;
      this.input = input;
      this.listeners = {};
    }
    addListener(event, cb) {
      if (!this.listeners[event]) this.listeners[event] = [];
      this.listeners[event].push(cb);
      return { remove: () => {} };
    }
    getPlace() {
      return { formatted_address: this.input ? this.input.value : "Barcelona, España" };
    }
    setTypes() {}
    setBounds() {}
    setFields() {}
    setComponentRestrictions() {}
    getBounds() {
      return {};
    }
    getFields() {
      return [];
    }
    setOptions() {}
  }

  Object.defineProperty(win, "google", {
    value: { maps: { places: { Autocomplete: MockAutocomplete } } },
    writable: false,
    configurable: false,
  });
}

// Convenience wrapper: visit a URL with the Autocomplete mock pre-installed.
Cypress.Commands.add("visitWithAutocompleteMock", (url) => {
  return cy.visit(url, { onBeforeLoad: installGoogleAutocompleteMock });
});

// Waits for the mock instance to register a 'place_changed' listener, then
// fires it - mirrors Java's WebDriverWait polling loop via Cypress's
// built-in retry-until `.should()`.
Cypress.Commands.add("triggerAutocompletePlaceChanged", () => {
  cy.window({ log: false })
    .should((win) => {
      expect(win.mockAutocompleteInstance && win.mockAutocompleteInstance.listeners && win.mockAutocompleteInstance.listeners.place_changed).to.exist;
    })
    .then((win) => {
      win.mockAutocompleteInstance.listeners.place_changed.forEach((cb) => cb());
    });
});

// Installs a mock Google Identity Services SDK (window.google.accounts.oauth2)
// so the "Sign in with Google" button can be exercised without hitting the
// real Google popup flow. Direct port of login.spec.ts's addInitScript.
export function installGoogleIdentityMock(win) {
  win.google = {
    accounts: {
      oauth2: {
        initTokenClient: (config) => {
          win.mockGoogleTokenClient = config;
          return {
            requestAccessToken: () => {
              if (win.mockGoogleTokenClient && win.mockGoogleTokenClient.callback) {
                win.mockGoogleTokenClient.callback({ access_token: "fake_google_access_token" });
              }
            },
          };
        },
      },
    },
  };
}

Cypress.Commands.add("visitWithGoogleIdentityMock", (url) => {
  cy.intercept("**/gsi/client", {
    statusCode: 200,
    headers: { "content-type": "application/javascript" },
    body: 'console.log("Mock Google GSI client script loaded");',
  });
  return cy.visit(url, { onBeforeLoad: installGoogleIdentityMock });
});
