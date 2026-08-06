const waitOn = require("wait-on");

const apiUrl = process.env.CYPRESS_apiUrl || "http://localhost:8000";
const frontendUrl = process.env.CYPRESS_BASE_URL || "http://localhost";

waitOn({
  resources: [`${apiUrl}/health`, frontendUrl],
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
