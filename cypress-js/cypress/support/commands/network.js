// Keeps the browser from reaching Google. The backend already uses gplaces-mock;
// this covers the calls the frontend makes directly from the browser.
Cypress.Commands.add("stubGoogleNetwork", () => {
  // Geocoding: answered by gplaces-mock.
  cy.intercept({ hostname: "maps.googleapis.com", pathname: "/maps/api/geocode/json" }, (req) => {
    req.url = req.url.replace("https://maps.googleapis.com", Cypress.env("placesMockUrl"));
  });

  // Maps JS SDK: inert script that fires the loader callback (react-google-autocomplete
  // waits for it); window.google itself comes from the mocks in mocks.js.
  cy.intercept({ hostname: "maps.googleapis.com", pathname: "/maps/api/js" }, (req) => {
    const callback = new URL(req.url).searchParams.get("callback");
    req.reply({
      headers: { "content-type": "application/javascript" },
      body: callback ? `window["${callback}"] && window["${callback}"]();` : "",
    });
  });

  // Google Identity Services script.
  cy.intercept("https://accounts.google.com/gsi/client", {
    headers: { "content-type": "application/javascript" },
    body: "",
  });
});
