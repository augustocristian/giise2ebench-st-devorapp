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

// Waits until the component registered its 'place_changed' listener, then fires it.
Cypress.Commands.add("triggerAutocompletePlaceChanged", () => {
  cy.window({ log: false })
    .should((win) => {
      expect(
        win.mockAutocompleteInstance &&
          win.mockAutocompleteInstance.listeners &&
          win.mockAutocompleteInstance.listeners.place_changed,
      ).to.exist;
    })
    .then((win) => {
      win.mockAutocompleteInstance.listeners.place_changed.forEach((cb) => cb());
    });
});
