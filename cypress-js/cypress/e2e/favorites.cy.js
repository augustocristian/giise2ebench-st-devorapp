// Browser tests for the DevorApp favorites page (/favorites).
// Mirrors selenium-java's tests/e2e/TestFavoritesView.java.
// Network responses are mocked via cy.intercept() instead of Java's
// window.fetch monkey-patch - the idiomatic Cypress equivalent.
//
// Base-Choice coverage:
//   BASE - multiple lists, 0 restaurants, with search filter.
//   S2 - 0 lists created (empty state general).
//   S3 - 1 list, 0 restaurants, with search filter.
//   S4 - multiple lists, 1 restaurant, with search filter.
//   S5 - multiple lists, multiple restaurants, with search filter.
//   S6 - multiple lists, 0 restaurants, no search filter.

import LoginPage from "../support/pages/LoginPage";
import SideMenuPage from "../support/pages/SideMenuPage";
import FavoritesPage from "../support/pages/FavoritesPage";
import { uniqueTs, uniqueEmail, uniqueUsername } from "../support/commands/api";

describe("Favorites", () => {
  const PLACE_A = "ChIJN1t_tDeuEmsRUsoyG83frY4";
  const PLACE_B = "ChIJdd4hrwug2EcRmSrV3Vo6llI";
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

  function mockListasJson(count) {
    return Array.from({ length: count }, (_, i) => ({
      id: i + 1,
      user_id: "uid",
      nombre: `Lista ${i + 1}`,
      icono: "Heart",
    }));
  }

  function mockDetailJson(listId, listName, restaurantCount) {
    const placeIds = [PLACE_A, PLACE_B];
    const names = ["Restaurante Uno", "Restaurante Dos"];
    const restaurantes = Array.from({ length: restaurantCount }, (_, i) => ({
      id: i + 1,
      lista_id: listId,
      place_id: placeIds[i % placeIds.length],
      restaurant: {
        id: placeIds[i % placeIds.length],
        name: names[i % names.length],
        rating: 4.5,
        user_ratings_total: 100,
        address: `Calle Falsa ${i + 1}`,
        main_photo: null,
        types: ["restaurant"],
      },
    }));
    return { lista: { id: listId, user_id: "uid", nombre: listName, icono: "Heart" }, restaurantes };
  }

  function loginGoToFavoritesWithMock(listasJson, detailJson) {
    cy.intercept("GET", "**/api/favoritos/listas/*", detailJson).as("getDetail");
    cy.intercept("GET", "**/api/favoritos/listas", listasJson).as("getListas");

    new LoginPage().visit().enterIdentifier(testEmail).enterPassword(PASSWORD).submitLogin();
    new SideMenuPage().open();
    cy.contains("button", "Favoritos").click();
    cy.wait("@getListas");

    return new FavoritesPage().waitForLoad();
  }

  it("BASE - varias listas, 0 restaurantes, con búsqueda", () => {
    const page = loginGoToFavoritesWithMock(mockListasJson(2), mockDetailJson(1, "Lista 1", 0));

    page.getListCount().should("eq", 2);

    page.openListByName("Lista 1");
    page.getRestaurantCount().should("eq", 0);

    page.searchWithin("pizza");
    page.getRestaurantCount().should("eq", 0);
  });

  it("S2, S3, S6 - gestión de estados vacíos y búsqueda", () => {
    // S2: 0 listas -> empty state
    let page = loginGoToFavoritesWithMock([], {});
    page.getListCount().should("eq", 0);
    page.isEmptyStateVisible().should("be.true");

    // S3: 1 lista, 0 restaurantes, con búsqueda
    page = loginGoToFavoritesWithMock(mockListasJson(1), mockDetailJson(1, "Lista 1", 0));
    page.getListCount().should("eq", 1);
    page.openListByName("Lista 1");
    page.searchWithin("pizza");
    page.getRestaurantCount().should("eq", 0);

    // S6: varias listas, 0 restaurantes, sin búsqueda
    page = loginGoToFavoritesWithMock(mockListasJson(2), mockDetailJson(1, "Lista 1", 0));
    page.getListCount().should("eq", 2);
    page.openListByName("Lista 1");
    page.isDetailEmptyStateVisible().should("be.true");
    page.getRestaurantCount().should("eq", 0);
  });

  it("S4, S5 - listas con restaurantes y búsquedas", () => {
    // S4: varias listas, 1 restaurante, con búsqueda
    let page = loginGoToFavoritesWithMock(mockListasJson(2), mockDetailJson(1, "Lista 1", 1));
    page.openListByName("Lista 1");
    page.getRestaurantCount().should("eq", 1);

    page.searchWithin("Uno");
    page.getRestaurantCount().should("eq", 1);

    page.searchWithin("zzz_no_match");
    page.getRestaurantCount().should("eq", 0);

    // S5: varias listas, varios restaurantes, con búsqueda
    page = loginGoToFavoritesWithMock(mockListasJson(2), mockDetailJson(1, "Lista 1", 2));
    page.openListByName("Lista 1");
    page.getRestaurantCount().should("eq", 2);

    page.searchWithin("Dos");
    page.getRestaurantCount().should("eq", 1);

    page.searchWithin("zzz_no_match");
    page.getRestaurantCount().should("eq", 0);
  });
});
