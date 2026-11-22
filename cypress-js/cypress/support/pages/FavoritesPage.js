import { TID } from "../testids";
import SideMenuPage from "./SideMenuPage";

class FavoritesPage {
  openFromMenu() {
    new SideMenuPage().open();
    cy.tid(TID.sideMenu.favorites).click();
    cy.tid(TID.favorites.loading).should("not.exist");
    return this;
  }

  expectListCount(count) {
    cy.tid(TID.favorites.listCard).should(count === 0 ? "not.exist" : "have.length", count);
    return this;
  }

  expectEmptyState() {
    cy.tid(TID.favorites.empty).should("be.visible");
    return this;
  }

  openList(name) {
    cy.contains(`[data-testid="${TID.favorites.listCard}"]`, name).click();
    cy.tid(TID.favorites.search).should("be.visible");
    cy.tid(TID.favorites.detailLoading).should("not.exist");
    return this;
  }

  expectRestaurantCount(count) {
    cy.tid(TID.shared.restaurantCard).should(count === 0 ? "not.exist" : "have.length", count);
    return this;
  }

  expectDetailEmpty() {
    cy.tid(TID.favorites.detailEmpty).should("be.visible");
    return this;
  }

  searchWithin(text) {
    cy.tid(TID.favorites.search).fill(text);
    return this;
  }
}

export default FavoritesPage;
