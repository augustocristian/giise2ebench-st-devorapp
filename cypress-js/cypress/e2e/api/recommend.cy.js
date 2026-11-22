// Recommendation search: each criterion variation must be accepted and return a results array.
import { api } from "../../support/commands/api";
import { useTestUser } from "../../support/commands/users";

describe("API - Recommend - Base-Choice", () => {
  const user = useTestUser("recapi");
  const BOTH_CATEGORIES = ["mexican_restaurant", "italian_restaurant"];
  const BOTH_PRICES = ["PRICE_LEVEL_MODERATE", "PRICE_LEVEL_EXPENSIVE"];

  beforeEach(() => cy.apiLoginAs(user));

  const accepted = [
    ["BASE - categories, prices and location", { categories: BOTH_CATEGORIES, prices: BOTH_PRICES }],
    ["S2 - empty categories", { categories: [] }],
    ["S4 - empty prices", { prices: [] }],
    [
      "S6 - include_unconfirmed_price=false",
      { categories: BOTH_CATEGORIES, prices: BOTH_PRICES, include_unconfirmed_price: false },
    ],
    ["S7 - open_now=false", { open_now: false }],
    ["S8 - alternative location", { categories: BOTH_CATEGORIES, prices: BOTH_PRICES, location: "Barcelona, España" }],
  ];

  accepted.forEach(([title, criteria]) => {
    it(`${title} returns 200 with a results array`, () => {
      api.recommendations.search(criteria).then((res) => {
        expect(res.status, "Search must be accepted").to.eq(200);
        expect(res.body.results, "Response must contain a 'results' array").to.be.an("array");
      });
    });
  });

  it("S10 - a search matching nothing is not a server error (200, or 422 for an unknown location)", () => {
    api.recommendations
      .search({
        categories: ["some_very_obscure_cuisine_type_xyz"],
        prices: [],
        include_unconfirmed_price: false,
        location: "Lugar inexistente 99999",
        max_results: 1,
      })
      .then((res) => {
        expect([200, 422], `Unexpected status ${res.status}`).to.include(res.status);
      });
  });
});
