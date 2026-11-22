import { TID } from "../testids";

const SEARCH_URL = "**/api/v1/recommendations/search";

class RecommendPage {
  visit(options) {
    cy.visit("/recommend-restaurants", options);
    cy.tid(TID.recommend.submit).scrollIntoView();
    cy.tid(TID.recommend.submit).should("be.visible");
    // The preferred-location label reads "Desconocida" until the profile has loaded.
    cy.tid(TID.recommend.preferredLocationName).should("not.contain.text", "Desconocida");
    return this;
  }

  /** Aliases search requests as @search. A spy: stubs registered earlier or later still apply. */
  watchSearch() {
    cy.intercept("POST", SEARCH_URL).as("search");
    return this;
  }

  /**
   * Picks a cuisine option. Choosing a tag submits the search, and a finished search collapses the
   * filter panel, so wait for it and reopen the filters with the "Editar" chip.
   */
  addCuisine(tagId, query) {
    this.watchSearch();
    cy.tid(TID.recommend.cuisineInput).scrollIntoView();
    cy.tid(TID.recommend.cuisineInput).click();
    cy.tid(TID.recommend.cuisineInput).fill(query);
    cy.tid(TID.recommend.cuisineOption(tagId)).click();
    cy.wait("@search");
    // Real results are expected here; the chip renders once the response is applied.
    cy.tid(TID.recommend.editFilters).click();
    cy.tid(TID.recommend.submit).scrollIntoView(); // below the fold in a scroll container
    cy.tid(TID.recommend.submit).should("be.visible");
    return this;
  }

  /** Toggles the price button for `level` (1..4). */
  selectPrice(level) {
    cy.tid(TID.recommend.price(level)).click();
    return this;
  }

  setIncludeNoPrice(checked) {
    return this.#setCheckbox(TID.recommend.includeNoPrice, checked);
  }

  setOpenNow(checked) {
    return this.#setCheckbox(TID.recommend.openNow, checked);
  }

  #setCheckbox(tid, checked) {
    // force: the native input is visually hidden behind a styled label.
    cy.tid(tid).then(($cb) => {
      if ($cb.is(":checked") !== checked) cy.wrap($cb).click({ force: true });
    });
    return this;
  }

  selectPreferredLocation() {
    cy.tid(TID.recommend.locationPreferred).click({ force: true }); // hidden native radio
    return this;
  }

  selectOtherLocation(location) {
    cy.tid(TID.recommend.locationCustom).click({ force: true }); // hidden native radio
    cy.tid(TID.recommend.locationInput).fill(location);
    return this;
  }

  /** Submits and waits for the search response. */
  search() {
    this.watchSearch();
    this.submitWithoutWaiting();
    cy.wait("@search");
    return this;
  }

  /** For client-side validation failures that never reach the backend. */
  submitWithoutWaiting() {
    cy.tid(TID.recommend.submit).scrollIntoView();
    cy.tid(TID.recommend.submit).click();
    return this;
  }

  expectNoError() {
    cy.tid(TID.recommend.error).should("not.exist");
    return this;
  }

  expectError(pattern) {
    cy.tid(TID.recommend.error).should("be.visible");
    cy.tid(TID.recommend.error).invoke("text").should("match", pattern);
    return this;
  }

  expectResultCount(count) {
    cy.tid(TID.recommend.resultCard).should(count === 0 ? "not.exist" : "have.length", count);
    return this;
  }
}

export default RecommendPage;
