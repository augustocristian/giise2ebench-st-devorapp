import { TID } from "../testids";
import SideMenuPage from "./SideMenuPage";

const RATING_ASPECTS = ["quality", "price", "hygiene", "service"];

// Entries are grouped by month; only the most recent group starts expanded.
class HistoryPage {
  openFromMenu() {
    new SideMenuPage().open();
    cy.tid(TID.sideMenu.history).click();
    return this.waitForLoad();
  }

  visit() {
    cy.visit("/history");
    return this.waitForLoad();
  }

  waitForLoad() {
    cy.tid(TID.history.loading).should("not.exist");
    return this;
  }

  expectGroupCount(count) {
    cy.tid(TID.history.groupTitle).should(count === 0 ? "not.exist" : "have.length", count);
    return this;
  }

  /** Expands/collapses the group whose title contains `title` (e.g. "JUNIO 2026"). */
  toggleGroup(title) {
    cy.contains(`[data-testid="${TID.history.groupHeader}"]`, title).click();
    return this;
  }

  expectCardCount(count) {
    cy.tid(TID.shared.restaurantCard).should(count === 0 ? "not.exist" : "have.length", count);
    return this;
  }

  expectCardName(index, name) {
    cy.tid(TID.shared.restaurantCard).eq(index).tid(TID.shared.restaurantCardName).should("have.text", name);
    return this;
  }

  search(query) {
    cy.tid(TID.history.search).fill(query);
    return this;
  }

  // ── Rating modal (opened from a card's ⋮ menu) ────────────────────────────

  openRatingModal(cardIndex = 0) {
    cy.tid(TID.shared.restaurantCard).eq(cardIndex).tid(TID.history.cardMenu).click();
    cy.tid(TID.history.menuRate).click();
    cy.tid(TID.rating.modal).should("be.visible");
    return this;
  }

  /** `scores`: { quality, price, hygiene, service }, each 0..5 (0 = leave unrated). */
  fillRating(scores, comment) {
    RATING_ASPECTS.forEach((aspect) => {
      if (scores[aspect] > 0) cy.tid(TID.rating.star(aspect, scores[aspect])).click();
    });
    if (comment) cy.tid(TID.rating.comment).fill(comment);
    return this;
  }

  expectRatingSubmitEnabled() {
    cy.tid(TID.rating.submit).should("be.enabled");
    return this;
  }

  expectRatingSubmitDisabled() {
    cy.tid(TID.rating.submit).should("be.disabled");
    return this;
  }

  submitRating() {
    cy.tid(TID.rating.submit).click();
    cy.tid(TID.rating.modal).should("not.exist");
    return this;
  }
}

export default HistoryPage;
