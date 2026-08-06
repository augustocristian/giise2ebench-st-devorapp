// Mirrors selenium-java's pages/RecommendPage.java.
// Covers the search form (categories, price levels, boolean toggles,
// location selector) and the results panel (suggestion cards).
class RecommendPage {
  static SELECTORS = {
    categoryInput: "input[placeholder='+ Añadir tipo de cocina...']",
    searchBtn: "button",
    noPriceCheck: "label",
    openNowCheck: "label",
    locOtherInput: "input[placeholder='Ej. Madrid, Barcelona...']",
    resultCards: ".suggestion-card",
    errorMsg: ".message.error",
  };

  waitForLoad() {
    cy.contains("button", "Buscar recomendaciones").should("be.visible");
    cy.contains("label", "Usar ubicación preferida").should("be.visible");
    cy.contains("label", "Usar ubicación preferida").should("not.contain.text", "Desconocida");
    return this;
  }

  // ── Category tags ─────────────────────────────────────────────────────────

  /** Adds a cuisine category by typing `query` and clicking the option containing `optionLabel`. */
  addCategory(query, optionLabel) {
    cy.get(RecommendPage.SELECTORS.categoryInput).click().clear().type(query);
    cy.contains("div", optionLabel).should("be.visible").click();
    return this;
  }

  // ── Price levels ──────────────────────────────────────────────────────────

  /** Clicks the price button with the given label (e.g. "€", "€€", "€€€"). */
  clickPrice(label) {
    cy.contains("button", new RegExp(`^${label}$`)).click();
    return this;
  }

  // ── Boolean toggles ───────────────────────────────────────────────────────

  /** Sets the "Incluir sitios sin precio confirmado" checkbox to `checked`. */
  setIncludeNoPrice(checked) {
    cy.contains("label", "Incluir sitios sin precio confirmado")
      .find("input")
      .then(($cb) => {
        if ($cb.is(":checked") !== checked) cy.wrap($cb).click({ force: true });
      });
    return this;
  }

  /** Sets the "Solo lugares abiertos ahora" checkbox to `checked`. */
  setOpenNow(checked) {
    cy.contains("label", "Solo lugares abiertos ahora")
      .find("input")
      .then(($cb) => {
        if ($cb.is(":checked") !== checked) cy.wrap($cb).click({ force: true });
      });
    return this;
  }

  // ── Location ──────────────────────────────────────────────────────────────

  selectPreferredLocation() {
    cy.contains("label", "Usar ubicación preferida").find("input").click({ force: true });
    return this;
  }

  /** Selects "Escoger otra ubicación" and types a location string. */
  selectOtherLocation(location) {
    cy.contains("label", "Escoger otra ubicación").find("input").click({ force: true });
    cy.get(RecommendPage.SELECTORS.locOtherInput).clear().type(location);
    return this;
  }

  // ── Search ────────────────────────────────────────────────────────────────

  search() {
    cy.contains("button", "Buscar recomendaciones").click();
    return this;
  }

  // ── Results ───────────────────────────────────────────────────────────────

  getResultCount() {
    return cy.get("body").then(($body) => $body.find(RecommendPage.SELECTORS.resultCards).length);
  }

  isResultsTitleVisible() {
    return cy.get("body").then(($body) => $body.text().includes("Sugerencias para ti"));
  }

  getErrorMessage() {
    return cy.get("body").then(($body) => {
      const el = $body.find(RecommendPage.SELECTORS.errorMsg);
      return el.length ? el.first().text() : "";
    });
  }

  hasErrorMessage() {
    return cy.get("body").then(($body) => $body.find(RecommendPage.SELECTORS.errorMsg).length > 0);
  }
}

export default RecommendPage;
