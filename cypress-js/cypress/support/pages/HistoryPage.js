// Mirrors selenium-java's pages/HistoryPage.java.
// The history page groups visited restaurants by month; each group header
// can be expanded/collapsed, only the most-recent group expanded by default.
class HistoryPage {
  static SELECTORS = {
    groupTitles: ".history-group-title",
    groupHeaders: ".history-group-header",
    cards: ".restaurant-compact-card",
    searchInput: "input[placeholder='Buscar en historial...']",
    loadingSpinner: ".loading-spinner",
  };

  waitForLoad() {
    cy.get(HistoryPage.SELECTORS.loadingSpinner).should("not.exist");
    return this;
  }

  // ── Month groups ──────────────────────────────────────────────────────────

  getGroupCount() {
    return cy.get("body").then(($body) => $body.find(HistoryPage.SELECTORS.groupTitles).length);
  }

  getGroupTitleAt(index) {
    return cy.get("body").then(($body) => {
      const titles = $body.find(HistoryPage.SELECTORS.groupTitles);
      return index < titles.length ? titles.eq(index).text() : "";
    });
  }

  isGroupVisible(text) {
    return cy.get("body").then(($body) => {
      const titles = $body.find(HistoryPage.SELECTORS.groupTitles);
      return titles.toArray().some((el) => el.textContent.includes(text));
    });
  }

  /** Clicks the group header whose title contains monthText to expand/collapse it. */
  toggleGroup(monthText) {
    cy.contains(HistoryPage.SELECTORS.groupHeaders, monthText).click();
    return this;
  }

  // ── Restaurant cards ──────────────────────────────────────────────────────

  getCardCount() {
    return cy.get("body").then(($body) => $body.find(HistoryPage.SELECTORS.cards).length);
  }

  getCardNameAt(index) {
    return cy.get("body").then(($body) => {
      const cards = $body.find(HistoryPage.SELECTORS.cards);
      if (index >= cards.length) return "";
      const name = cards.eq(index).find(".compact-name");
      return name.length ? name.first().text() : "";
    });
  }

  /** Opens the three-dot menu of the card at the given index (first button inside it). */
  openCardMenu(index) {
    cy.get(HistoryPage.SELECTORS.cards).eq(index).find("button").first().click();
    return this;
  }

  // ── Search ────────────────────────────────────────────────────────────────

  search(query) {
    cy.get(HistoryPage.SELECTORS.searchInput).clear().type(query);
    return this;
  }
}

export default HistoryPage;
