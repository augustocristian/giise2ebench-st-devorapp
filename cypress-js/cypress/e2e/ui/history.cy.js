// History page: month grouping, card counts and search, with a stubbed history response.
// Base-Choice scenarios: BASE, S2, S3, S5, S6.
import { useTestUser } from "../../support/commands/users";
import HistoryPage from "../../support/pages/HistoryPage";
import { historyStub, pageStub } from "../../support/factories";

describe("History", () => {
  const user = useTestUser("hist");
  const page = new HistoryPage();
  const MAY = "2026-05-15T12:00:00Z";
  const JUNE = "2026-06-15T12:00:00Z";

  function openHistory(history) {
    cy.intercept("GET", "**/api/v1/history?*", pageStub(history)).as("getHistory");
    cy.loginAs(user);
    page.openFromMenu();
    cy.wait("@getHistory");
  }

  it("BASE - two months, multiple restaurants, no search", () => {
    openHistory(historyStub(MAY, JUNE));
    page.expectGroupCount(2);
    page.toggleGroup("JUNIO 2026").expectCardCount(2); // only the first group starts expanded
  });

  it("S2 - empty history shows no groups or cards", () => {
    openHistory([]);
    page.expectGroupCount(0).expectCardCount(0);
  });

  it("S5 - exactly one restaurant", () => {
    openHistory(historyStub(MAY, MAY).slice(0, 1));
    page.expectGroupCount(1).expectCardCount(1);
  });

  it("S3 - one month with several restaurants", () => {
    openHistory(historyStub(MAY, "2026-05-20T12:00:00Z"));
    page.expectGroupCount(1).expectCardCount(2);
  });

  it("S6 - search keeps only matching cards and months", () => {
    openHistory(historyStub(MAY, JUNE));
    page.toggleGroup("JUNIO 2026").expectCardCount(2);
    page.search("Uno");
    page.expectGroupCount(1).expectCardCount(1).expectCardName(0, "Restaurante Uno");
  });

  it("S6 - search without matches shows no cards", () => {
    openHistory(historyStub(MAY, JUNE));
    page.search("zzz_no_match");
    page.expectGroupCount(0).expectCardCount(0);
  });
});
