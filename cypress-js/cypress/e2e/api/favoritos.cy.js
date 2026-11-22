// Favorites: lists and the restaurants inside them.
import { api } from "../../support/commands/api";
import { PLACES } from "../../support/data/places";
import { useTestUser } from "../../support/commands/users";

describe("API - Favoritos - Base-Choice", () => {
  const user = useTestUser("favapi");
  let listId;

  beforeEach(() => {
    cy.apiLoginAs(user);
    api.favoritos.createList(`BCTest${Date.now()}`).then((res) => {
      listId = res.body.id;
    });
  });

  const restaurantIds = () => api.favoritos.getList(listId).then((res) => res.body.restaurantes.map((r) => r.place_id));

  it("BASE - adding 3 restaurants to a list returns all 3 in the list detail", () => {
    api.favoritos.addRestaurant(listId, PLACES.A);
    api.favoritos.addRestaurant(listId, PLACES.B);
    api.favoritos.addRestaurant(listId, PLACES.C);

    restaurantIds().should("have.members", [PLACES.A, PLACES.B, PLACES.C]);
  });

  it("Case 2 - a new list has an empty restaurantes array", () => {
    api.favoritos.getList(listId).then((res) => {
      expect(res.body.restaurantes, "A brand-new list must have no restaurants").to.be.empty;
    });
  });

  it("Case 3 - adding 1 restaurant returns a restaurantes array of size 1", () => {
    api.favoritos.addRestaurant(listId, PLACES.A);

    restaurantIds().should("deep.equal", [PLACES.A]);
  });

  it("Case 4 - GET lists includes the created list", () => {
    api.favoritos.lists().then((res) => {
      expect(
        res.body.map((l) => l.id),
        "The created list must appear in the user's lists",
      ).to.include(listId);
    });
  });

  it("Case 5 - deleting a restaurant removes only it from the list detail", () => {
    api.favoritos.addRestaurant(listId, PLACES.A).then((res) => {
      api.favoritos.addRestaurant(listId, PLACES.B);
      api.favoritos.removeRestaurant(res.body.id).its("status").should("eq", 204);
    });

    restaurantIds().should("deep.equal", [PLACES.B]);
  });

  it("Case 6 - deleting a list removes it from the user's lists", () => {
    api.favoritos.deleteList(listId).its("status").should("eq", 204);

    api.favoritos.lists().then((res) => {
      expect(
        res.body.map((l) => l.id),
        "A deleted list must not be returned",
      ).to.not.include(listId);
    });
  });
});
