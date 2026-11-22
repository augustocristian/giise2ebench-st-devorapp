const js = require("@eslint/js");
const globals = require("globals");
const cypress = require("eslint-plugin-cypress");
const prettier = require("eslint-config-prettier");

module.exports = [
  { ignores: ["node_modules/", "results/", "cypress/screenshots/", "cypress/videos/", "cypress/downloads/"] },
  js.configs.recommended,
  {
    files: ["**/*.js"],
    languageOptions: { ecmaVersion: "latest", sourceType: "commonjs", globals: { ...globals.node } },
  },
  {
    files: ["cypress/**/*.js"],
    languageOptions: { sourceType: "module", globals: { ...globals.browser, ...globals.mocha } },
  },
  cypress.configs.recommended,
  prettier,
];
