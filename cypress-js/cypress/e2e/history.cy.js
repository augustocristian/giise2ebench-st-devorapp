// Browser tests for the DevorApp history page (/history).
// Mirrors selenium-java's tests/e2e/TestHistoryView.java.
// History entries are mocked via cy.intercept() so the browser tests can
// verify grouping by month, card counts, and the search/filter behaviour.
//
// Base-Choice coverage:
//   BASE - multiple months, multiple restaurants, no search filter.
//   S2 - empty history shows 0 groups and 0 cards.
//   S3 - 1 month with multiple restaurants.
//   S5 - exactly 1 restaurant in history.
//   S6 - search term filters cards and hides non-matching months.

import LoginPage from "../support/pages/LoginPage";
import SideMenuPage from "../support/pages/SideMenuPage";
import HistoryPage from "../support/pages/HistoryPage";
import { uniqueTs, uniqueEmail, uniqueUsername } from "../support/commands/api";

describe("History", () => {
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

  function mockHistorialJson(date1, date2) {
    return [
      {
        id: 1,
        user_id: "uid",
        place_id: "ChIJN1t_tDeuEmsRUsoyG83frY4",
        fecha_acceso: date1,
        restaurant: {
          id: "ChIJN1t_tDeuEmsRUsoyG83frY4",
          name: "Restaurante Uno",
          rating: 4.5,
          user_ratings_total: 100,
          types: ["restaurant"],
          address: "Calle Falsa 123",
          main_photo: null,
          summary: "Excelente",
          open_now: true,
        },
      },
      {
        id: 2,
        user_id: "uid",
        place_id: "ChIJdd4hrwug2EcRmSrV3Vo6llI",
        fecha_acceso: date2,
        restaurant: {
          id: "ChIJdd4hrwug2EcRmSrV3Vo6llI",
          name: "Restaurante Dos",
          rating: 4.0,
          user_ratings_total: 50,
          types: ["restaurant"],
          address: "Avenida Siempreviva 742",
          main_photo: null,
          summary: "Agradable",
          open_now: false,
        },
      },
    ];
  }

  function singleMockEntryJson(date) {
    return [mockHistorialJson(date, date)[0]];
  }

  function loginGoToHistoryWithMock(jsonResponse) {
    cy.intercept("GET", "**/api/historial*", jsonResponse).as("getHistorial");

    new LoginPage().visit().enterIdentifier(testEmail).enterPassword(PASSWORD).submitLogin();
    new SideMenuPage().open();
    cy.contains("button", "Historial").click();
    cy.wait("@getHistorial");

    return new HistoryPage().waitForLoad();
  }

  it("BASE - history page shows at least 1 group and multiple restaurant cards", () => {
    const page = loginGoToHistoryWithMock(mockHistorialJson("2026-05-15T12:00:00Z", "2026-06-15T12:00:00Z"));

    page.getGroupCount().should("eq", 2);

    // Expand the second group (JUNIO 2026 is collapsed by default since MAYO 2026 is index 0).
    page.toggleGroup("JUNIO 2026");

    page.getCardCount().should("eq", 2);
  });

  it("debe gestionar historial vacío (S2), con 1 restaurante (S5) y 1 mes con varios (S3)", () => {
    // S2: empty history
    let page = loginGoToHistoryWithMock([]);
    page.getGroupCount().should("eq", 0);
    page.getCardCount().should("eq", 0);

    // S5: exactly 1 restaurant entry
    page = loginGoToHistoryWithMock(singleMockEntryJson("2026-05-15T12:00:00Z"));
    page.getGroupCount().should("eq", 1);
    page.getCardCount().should("eq", 1);

    // S3: 1 month with multiple restaurants
    page = loginGoToHistoryWithMock(mockHistorialJson("2026-05-15T12:00:00Z", "2026-05-20T12:00:00Z"));
    page.getGroupCount().should("eq", 1);
    page.getCardCount().should("eq", 2);
  });

  it("S6 - searching in history filters cards; a non-matching term shows 0 cards", () => {
    const page = loginGoToHistoryWithMock(mockHistorialJson("2026-05-15T12:00:00Z", "2026-06-15T12:00:00Z"));

    page.toggleGroup("JUNIO 2026");
    page.getCardCount().should("eq", 2);

    page.search("Uno");
    page.getGroupCount().should("eq", 1);
    page.getCardCount().should("eq", 1);
    page.getCardNameAt(0).should("eq", "Restaurante Uno");

    page.search("zzz_nada_xyzzy_no_match");
    page.getGroupCount().should("eq", 0);
    page.getCardCount().should("eq", 0);
  });
});
