const fs = require("fs");
const path = require("path");
const { defineConfig } = require("cypress");

const XML_ESCAPES = { "<": "&lt;", ">": "&gt;", "&": "&amp;", "'": "&apos;", '"': "&quot;" };
const escapeXml = (value) => String(value ?? "").replace(/[<>&'"]/g, (char) => XML_ESCAPES[char]);

// On CI, write one JUnit file per spec for the job summary (Cypress' own console reporter stays on).
function writeJunit(spec, results) {
  if (!results?.tests) return;
  const cases = results.tests.map((test) => {
    const attempts = test.attempts ?? [];
    const last = attempts[attempts.length - 1];
    const seconds = (last?.duration ?? last?.wallClockDuration ?? 0) / 1000;
    const suite = test.title.slice(0, -1).join(" › ") || spec.name;
    const open = `<testcase classname="${escapeXml(suite)}" name="${escapeXml(test.title.at(-1))}" time="${seconds}">`;
    if (test.state === "failed") {
      return `${open}<failure message="${escapeXml(test.displayError?.split("\n")[0])}">${escapeXml(test.displayError)}</failure></testcase>`;
    }
    if (test.state === "pending" || test.state === "skipped") return `${open}<skipped/></testcase>`;
    return `${open}</testcase>`;
  });
  const dir = path.join(__dirname, "results");
  fs.mkdirSync(dir, { recursive: true });
  const file = `junit-${spec.relative.split(path.sep).join("_").split("/").join("_")}.xml`;
  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<testsuite name="${escapeXml(spec.relative)}" tests="${cases.length}" time="${(results.stats?.duration ?? 0) / 1000}">\n${cases.join("\n")}\n</testsuite>\n`;
  fs.writeFileSync(path.join(dir, file), xml);
}

module.exports = defineConfig({
  e2e: {
    baseUrl: "http://localhost",
    specPattern: "cypress/e2e/**/*.cy.js",
    supportFile: "cypress/support/e2e.js",
    retries: { runMode: 1, openMode: 0 },
    video: false,
    setupNodeEvents(on, config) {
      if (process.env.CI) on("after:spec", writeJunit);
      return config;
    },
  },
  // Public values, read with Cypress.expose(). Override with CYPRESS_apiUrl / CYPRESS_placesMockUrl.
  expose: {
    apiUrl: process.env.CYPRESS_apiUrl ?? "http://localhost:8000",
    // gplaces-mock, which answers the browser-side geocoding calls (see support/commands/network.js)
    placesMockUrl: process.env.CYPRESS_placesMockUrl ?? "http://localhost:8002",
  },
});
