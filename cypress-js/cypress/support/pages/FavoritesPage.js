// Mirrors selenium-java's pages/FavoritesPage.java.
class FavoritesPage {
  static SELECTORS = {
    listCards: ".fav-list-card",
    restaurantCards: ".restaurant-compact-card",
    emptyListsText: "Aún no tienes listas",
    emptyDetailText: "Esta lista está vacía",
    searchInput: "input[placeholder='Buscar en esta lista...']",
    loadingSpinner: ".loading-spinner",
    detailSpinner: ".fav-detail-view .loading-spinner",
  };

  waitForLoad() {
    cy.get(FavoritesPage.SELECTORS.loadingSpinner).should("not.exist");
    return this;
  }

  getListCount() {
    return cy.get("body").then(($body) => $body.find(FavoritesPage.SELECTORS.listCards).length);
  }

  openListAt(index) {
    cy.get(FavoritesPage.SELECTORS.listCards).eq(index).click();
    cy.get(FavoritesPage.SELECTORS.searchInput).should("be.visible");
    cy.get(FavoritesPage.SELECTORS.detailSpinner).should("not.exist");
    return this;
  }

  openListByName(name) {
    cy.contains(FavoritesPage.SELECTORS.listCards, name, { matchCase: false }).click();
    cy.get(FavoritesPage.SELECTORS.searchInput).should("be.visible");
    cy.get(FavoritesPage.SELECTORS.detailSpinner).should("not.exist");
    return this;
  }

  getRestaurantCount() {
    return cy.get("body").then(($body) => $body.find(FavoritesPage.SELECTORS.restaurantCards).length);
  }

  isEmptyStateVisible() {
    return cy.get("body").then(($body) => $body.text().includes(FavoritesPage.SELECTORS.emptyListsText));
  }

  isDetailEmptyStateVisible() {
    return cy.get("body").then(($body) => $body.text().includes(FavoritesPage.SELECTORS.emptyDetailText));
  }

  searchWithin(text) {
    cy.get(FavoritesPage.SELECTORS.searchInput).clear().type(text);
    return this;
  }
}

export default FavoritesPage;
