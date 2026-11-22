const waitOn = require("wait-on");

const apiUrl = process.env.CYPRESS_apiUrl || "http://localhost:8000";
const frontendUrl = process.env.CYPRESS_BASE_URL || "http://localhost";

// wait-on probes with HEAD by default, but the backend's /health only answers
// GET (405 on HEAD), so force GET with the http-get:// scheme.
const asGet = (url) => url.replace(/^http/, "http-get");

waitOn({
  resources: [asGet(`${apiUrl}/health`), asGet(frontendUrl)],
  timeout: 120000,
  interval: 2000,
})
  .then(() => {
    console.log("[+] SUT is ready - backend /health and frontend both responding.");
  })
  .catch((err) => {
    console.error("[!] SUT did not become ready in time:", err.message);
    process.exit(1);
  });
