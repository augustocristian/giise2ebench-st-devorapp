const { defineConfig } = require("cypress");

module.exports = defineConfig({
  e2e: {
    baseUrl: "http://localhost",
    specPattern: "cypress/e2e/**/*.cy.js",
    supportFile: "cypress/support/e2e.js",
    retries: { runMode: 1, openMode: 0 },
    video: false,
    setupNodeEvents(on, config) {
      return config;
    },
  },
  env: {
    apiUrl: "http://localhost:8000",
    // gplaces-mock, which answers the browser-side geocoding calls (see support/commands/network.js)
    placesMockUrl: "http://localhost:8002",
  },
});
