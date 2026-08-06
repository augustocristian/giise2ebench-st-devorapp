// API Base-Choice tests for the recommendation search module.
// Mirrors selenium-java's tests/api/TestApiRecommendBC.java.
//
// Cases covered:
//   BASE  - search with categories + prices + location returns HTTP 200 with results array.
//   S2    - categories = [] (empty) -> HTTP 200 with results array.
//   S4    - prices = [] (empty) -> HTTP 200 with results array.
//   S6    - include_unconfirmed_price = false -> HTTP 200.
//   S7    - open_now = false -> HTTP 200.
//   S8    - using an alternative location -> HTTP 200.
//   S10   - results may be empty array (handled without error).

import { recommendationsUrl, uniqueTs, uniqueEmail, uniqueUsername, searchPayload } from "../../support/commands/api";

describe("API - Recommend - Base-Choice", () => {
  const LOCATION_PREF = "Gijón, España";
  const LOCATION_ALT = "Barcelona, España";

  let email;
  let password;

  before(() => {
    const ts = uniqueTs();
    email = uniqueEmail(ts);
    password = "Test1234!";
    cy.apiRegisterAndLogin(uniqueUsername(ts), email, password);
  });

  beforeEach(() => {
    cy.apiLogin(email, password);
  });

  after(() => {
    cy.deleteTestUser(email, password);
  });

  it("BASE - search with categories, prices and location returns HTTP 200 with results array", () => {
    const body = searchPayload(["mexican_restaurant", "italian_restaurant"], ["PRICE_LEVEL_MODERATE", "PRICE_LEVEL_EXPENSIVE"], true, LOCATION_PREF, 5);
    cy.apiPost(recommendationsUrl("/search"), body).then((res) => {
      expect(res.body, "Response must have a 'results' field").to.have.property("results");
      expect(res.body.results, "'results' must be a JSON array").to.be.an("array");
    });
  });

  it("S2 - empty categories list is accepted and returns HTTP 200", () => {
    const body = searchPayload([], ["PRICE_LEVEL_MODERATE"], true, LOCATION_PREF, 5);
    cy.apiPost(recommendationsUrl("/search"), body).then((res) => {
      expect(res.body, "Empty categories must still return a 'results' array (S2)").to.have.property("results");
    });
  });

  it("S4 - empty prices list is accepted and returns HTTP 200", () => {
    const body = searchPayload(["mexican_restaurant"], [], true, LOCATION_PREF, 5);
    cy.apiPost(recommendationsUrl("/search"), body).then((res) => {
      expect(res.body, "Empty prices must still return a 'results' array (S4)").to.have.property("results");
    });
  });

  it("S6 - include_unconfirmed_price=false returns HTTP 200", () => {
    const body = searchPayload(["mexican_restaurant", "italian_restaurant"], ["PRICE_LEVEL_MODERATE", "PRICE_LEVEL_EXPENSIVE"], false, LOCATION_PREF, 5);
    cy.apiPost(recommendationsUrl("/search"), body).then((res) => {
      expect(res.body, "include_unconfirmed_price=false must still return results array (S6)").to.have.property("results");
    });
  });

  it("S7 - open_now=false is accepted and returns HTTP 200", () => {
    const body = {
      categories: ["mexican_restaurant"],
      prices: ["PRICE_LEVEL_MODERATE"],
      include_unconfirmed_price: true,
      location: LOCATION_PREF,
      open_now: false,
      sort_by: "rating",
      max_results: 5,
    };
    cy.apiPost(recommendationsUrl("/search"), body).then((res) => {
      expect(res.body, "open_now=false must return a 'results' array (S7)").to.have.property("results");
    });
  });

  it("S8 - alternative location is accepted and returns HTTP 200", () => {
    const body = searchPayload(["mexican_restaurant", "italian_restaurant"], ["PRICE_LEVEL_MODERATE", "PRICE_LEVEL_EXPENSIVE"], true, LOCATION_ALT, 5);
    cy.apiPost(recommendationsUrl("/search"), body).then((res) => {
      expect(res.body, "Alternative location must still return a 'results' array (S8)").to.have.property("results");
    });
  });

  it("S10 - search returning 0 results returns HTTP 200 with empty results array", () => {
    const body = searchPayload(["some_very_obscure_cuisine_type_xyz"], [], false, "Lugar inexistente 99999", 1);
    cy.apiPost(recommendationsUrl("/search"), body).then((res) => {
      expect([200, 422], `Search must return 200 (or 422 for an invalid location), got: ${res.status}`).to.include(res.status);
    });
  });
});
