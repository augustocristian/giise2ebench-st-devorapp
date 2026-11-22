// Favorites page: list overview, empty states and in-list search, with stubbed API responses.
// Base-Choice scenarios: BASE, S2-S6.
import { useTestUser } from "../../support/commands/users";
import FavoritesPage from "../../support/pages/FavoritesPage";
import { favoritesDetailStub, favoritesListsStub } from "../../support/factories";

describe("Favorites", () => {
  const user = useTestUser("fav");
  const page = new FavoritesPage();

  /** Stubs the favorites API, logs in and opens the favorites page. */
  function openFavorites({ lists, restaurantCount }) {
    cy.intercept("GET", "**/api/v1/favorites/lists/*", favoritesDetailStub(restaurantCount)).as("getDetail");
    cy.intercept("GET", "**/api/v1/favorites/lists", lists).as("getLists");
    cy.loginAs(user);
    page.openFromMenu();
    cy.wait("@getLists");
  }

  it("BASE - several lists, 0 restaurants, with search", () => {
    openFavorites({ lists: favoritesListsStub(2), restaurantCount: 0 });
    page.expectListCount(2);
    page.openList("List 1").searchWithin("pizza");
    page.expectRestaurantCount(0);
  });

  it("S2 - no lists shows the empty state", () => {
    openFavorites({ lists: [], restaurantCount: 0 });
    page.expectListCount(0).expectEmptyState();
  });

  it("S3 - one list, 0 restaurants, with search", () => {
    openFavorites({ lists: favoritesListsStub(1), restaurantCount: 0 });
    page.expectListCount(1);
    page.openList("List 1").searchWithin("pizza");
    page.expectRestaurantCount(0);
  });

  it("S4 - one restaurant matches its search term", () => {
    openFavorites({ lists: favoritesListsStub(2), restaurantCount: 1 });
    page.openList("List 1").expectRestaurantCount(1);
    page.searchWithin("Uno").expectRestaurantCount(1);
  });

  it("S4 - one restaurant disappears on a non-matching search", () => {
    openFavorites({ lists: favoritesListsStub(2), restaurantCount: 1 });
    page.openList("List 1").searchWithin("zzz_no_match");
    page.expectRestaurantCount(0);
  });

  it("S5 - several restaurants are narrowed by search", () => {
    openFavorites({ lists: favoritesListsStub(2), restaurantCount: 2 });
    page.openList("List 1").expectRestaurantCount(2);
    page.searchWithin("Dos").expectRestaurantCount(1);
  });

  it("S5 - several restaurants disappear on a non-matching search", () => {
    openFavorites({ lists: favoritesListsStub(2), restaurantCount: 2 });
    page.openList("List 1").searchWithin("zzz_no_match");
    page.expectRestaurantCount(0);
  });

  it("S6 - several lists, 0 restaurants, no search shows the empty list state", () => {
    openFavorites({ lists: favoritesListsStub(2), restaurantCount: 0 });
    page.expectListCount(2);
    page.openList("List 1").expectDetailEmpty().expectRestaurantCount(0);
  });
});
