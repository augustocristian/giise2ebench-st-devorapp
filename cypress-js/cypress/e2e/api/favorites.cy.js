// Favorites: lists and the restaurants inside them.
import { api } from "../../support/commands/api";
import { PLACES } from "../../support/data/places";
import { useTestUser } from "../../support/commands/users";

describe("API - Favorites - Base-Choice", () => {
  const user = useTestUser("favapi");
  let listId;

  beforeEach(() => {
    cy.apiLoginAs(user);
    api.favorites.createList(`BCTest${Date.now()}`).then((res) => {
      listId = res.body.id;
    });
  });

  const restaurantIds = () => api.favorites.getList(listId).then((res) => res.body.restaurants.map((r) => r.place_id));

  it("BASE - adding 3 restaurants to a list returns all 3 in the list detail", () => {
    api.favorites.addRestaurant(listId, PLACES.A);
    api.favorites.addRestaurant(listId, PLACES.B);
    api.favorites.addRestaurant(listId, PLACES.C);

    restaurantIds().should("have.members", [PLACES.A, PLACES.B, PLACES.C]);
  });

  it("Case 2 - a new list has an empty restaurants array", () => {
    api.favorites.getList(listId).then((res) => {
      expect(res.body.restaurants, "A brand-new list must have no restaurants").to.be.empty;
    });
  });

  it("Case 3 - adding 1 restaurant returns a restaurants array of size 1", () => {
    api.favorites.addRestaurant(listId, PLACES.A);

    restaurantIds().should("deep.equal", [PLACES.A]);
  });

  it("Case 4 - GET lists includes the created list", () => {
    api.favorites.lists().then((res) => {
      expect(
        res.body.map((l) => l.id),
        "The created list must appear in the user's lists",
      ).to.include(listId);
    });
  });

  it("Case 5 - deleting a restaurant removes only it from the list detail", () => {
    api.favorites.addRestaurant(listId, PLACES.A).then((res) => {
      api.favorites.addRestaurant(listId, PLACES.B);
      api.favorites.removeRestaurant(listId, res.body.id).its("status").should("eq", 204);
    });

    restaurantIds().should("deep.equal", [PLACES.B]);
  });

  it("Case 6 - deleting a list removes it from the user's lists", () => {
    api.favorites.deleteList(listId).its("status").should("eq", 204);

    api.favorites.lists().then((res) => {
      expect(
        res.body.map((l) => l.id),
        "A deleted list must not be returned",
      ).to.not.include(listId);
    });
  });
});
