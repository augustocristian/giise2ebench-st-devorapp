// Browser tests for the DevorApp recommendation search page (/recommend-restaurants).
// Mirrors selenium-java's tests/e2e/TestRecommendView.java.
// Unlike the Playwright suite (which mocks the backend), these tests call the
// real backend API except for S10/S11, which use cy.intercept() to force
// deterministic 0-result and 1-result responses.
//
// Base-Choice coverage:
//   BASE - search with base filters (categories + prices + ubicación preferida) works.
//   S2 - no categories selected -> request is still sent without error.
//   S4 - no price selected -> request is still sent without error.
//   S6 - "Sin precio" unchecked -> does not block search.
//   S7 - "Abierto ahora" unchecked -> does not block search.
//   S8 - another valid location is chosen -> search completes without error.
//   S9 - other-location selected but left empty -> error message shown.
//   S10, S11 - intercepted 0-result and 1-result responses render correctly.

import LoginPage from "../support/pages/LoginPage";
import RecommendPage from "../support/pages/RecommendPage";
import { installGoogleAutocompleteMock } from "../support/commands/mocks";
import { uniqueTs, uniqueEmail, uniqueUsername } from "../support/commands/api";

describe("Recommend", () => {
  const PASSWORD = "Test1234!";
  let testEmail;

  before(() => {
    const ts = uniqueTs();
    testEmail = uniqueEmail(ts);
    cy.registerTestUser(uniqueUsername(ts), testEmail, PASSWORD);
  });

  after(() => {
    cy.deleteTestUser(testEmail, PASSWORD);
  });

  /** Logs in and navigates to /recommend-restaurants. */
  function loginAndGoToRecommend({ withAutocompleteMock = false } = {}) {
    new LoginPage().visit().enterIdentifier(testEmail).enterPassword(PASSWORD).submitLogin();
    if (withAutocompleteMock) {
      cy.visit("/recommend-restaurants", { onBeforeLoad: installGoogleAutocompleteMock });
    } else {
      cy.visit("/recommend-restaurants");
    }
    return new RecommendPage().waitForLoad();
  }

  it("BASE - búsqueda con filtros base y ubicación preferida/alternativa (BASE, S8)", () => {
    // BASE: preferred location + multiple categories + multiple prices
    let page = loginAndGoToRecommend();
    page.addCategory("Mexicano", "Mexicano");
    page.addCategory("Italiano", "Italiano");
    page.clickPrice("€");
    page.clickPrice("€€");
    page.setIncludeNoPrice(true);
    page.setOpenNow(true);
    page.selectPreferredLocation();
    page.search();
    page.hasErrorMessage().should("be.false");

    // S8: alternate location (autocomplete mock needed)
    page = loginAndGoToRecommend({ withAutocompleteMock: true });
    page.addCategory("Mexicano", "Mexicano");
    page.addCategory("Italiano", "Italiano");
    page.clickPrice("€");
    page.clickPrice("€€");

    page.selectOtherLocation("Barcelona, España");
    cy.triggerAutocompletePlaceChanged();

    page.search();
    page.hasErrorMessage().should("be.false");
  });

  it("S2, S4, S6, S7 - búsqueda sin categorías ni precio y con booleanos en false", () => {
    // S2 + S4: no categories, no prices -> search without frontend error
    let page = loginAndGoToRecommend();
    page.selectPreferredLocation();
    page.search();
    page.hasErrorMessage().should("be.false");

    // S6 + S7: uncheck "sin precio" and "abierto ahora"
    page = loginAndGoToRecommend();
    page.addCategory("Italiano", "Italiano");
    page.setIncludeNoPrice(false);
    page.setOpenNow(false);
    page.selectPreferredLocation();
    page.search();
    page.hasErrorMessage().should("be.false");

    // S3: 1 category, multiple prices
    page = loginAndGoToRecommend();
    page.addCategory("Mexicano", "Mexicano");
    page.clickPrice("€");
    page.clickPrice("€€");
    page.selectPreferredLocation();
    page.search();
    page.hasErrorMessage().should("be.false");

    // S5: multiple categories, 1 price
    page = loginAndGoToRecommend();
    page.addCategory("Mexicano", "Mexicano");
    page.addCategory("Italiano", "Italiano");
    page.clickPrice("€");
    page.selectPreferredLocation();
    page.search();
    page.hasErrorMessage().should("be.false");
  });

  it("S9, S10, S11 - validación de otra ubicación vacía (S9), y control de resultados 0 (S10) y 1 (S11)", () => {
    // 1. S9: empty alternate location
    let page = loginAndGoToRecommend();
    page.addCategory("Mexicano", "Mexicano");
    page.selectOtherLocation("");
    page.search();

    page.hasErrorMessage().should("be.true");
    page.getErrorMessage().should((msg) => {
      const lower = msg.toLowerCase();
      expect(lower.includes("ubicación") || lower.includes("localiz"), "Error message must mention location").to.be.true;
    });

    // 2. S10: 0 results (intercepted)
    cy.intercept("POST", "**/api/recommendations/search", { results: [], next_page_token: null }).as("search0");
    page = loginAndGoToRecommend();
    page.addCategory("Mexicano", "Mexicano");
    page.selectPreferredLocation();
    page.search();
    cy.wait("@search0");
    page.getResultCount().should("eq", 0);

    // 3. S11: 1 result (intercepted)
    cy.intercept("POST", "**/api/recommendations/search", {
      results: [
        {
          id: "test_place_11",
          name: "Restaurante S11",
          rating: 4.0,
          user_ratings_total: 10,
          types: ["restaurant"],
          address: "Calle 11",
          main_photo: null,
          summary: "S11",
          open_now: true,
        },
      ],
      next_page_token: null,
    }).as("search1");
    page = loginAndGoToRecommend();
    page.addCategory("Mexicano", "Mexicano");
    page.selectPreferredLocation();
    page.search();
    cy.wait("@search1");
    page.getResultCount().should("eq", 1);
  });
});
