// REST contract of the v1 API: Location headers, 409/422 status codes, upserts, pagination and likes.
import { api } from "../../support/commands/api";
import { PLACES } from "../../support/data/places";
import { newUser } from "../../support/data/users";
import { useTestUser } from "../../support/commands/users";

describe("API - REST contract - Base-Choice", () => {
  describe("registration status codes", () => {
    it("S3 - registering a duplicate username returns 409", () => {
      const user = newUser("regconf");
      cy.createUser(user);
      api.auth
        .register(newUser("regconf2", { username: user.username }))
        .its("status")
        .should("eq", 409);
      cy.deleteUser(user);
    });

    it("S4 - registering with an invalid email format returns 422", () => {
      api.auth
        .register(newUser("reginv", { email: "not-an-email" }))
        .its("status")
        .should("eq", 422);
    });

    it("S5 - registering with a weak password returns 422", () => {
      api.auth
        .register(newUser("regweak", { password: "abc" }))
        .its("status")
        .should("eq", 422);
    });
  });

  describe("favorites", () => {
    const user = useTestUser("favrest");

    beforeEach(() => cy.apiLoginAs(user));

    it("BASE - POST /favorites/lists returns 201 with a Location header of the new list", () => {
      api.favorites.createList(`Loc${Date.now()}`).then((res) => {
        expect(res.status, "Creating a list must return 201").to.eq(201);
        expect(res.headers.location, "Location must point to the new list").to.include(
          `/api/v1/favorites/lists/${res.body.id}`,
        );
      });
    });

    it("S2 - creating a list with a duplicate name returns 409", () => {
      const name = `Dup${Date.now()}`;
      api.favorites.createList(name);
      api.favorites.createList(name).its("status").should("eq", 409);
    });

    it("S3 - creating a list with an empty name returns 422", () => {
      api.favorites.createList("").its("status").should("eq", 422);
    });

    it("S4 - adding a restaurant returns 201 with a Location under its list, and the same place again returns 409", () => {
      api.favorites.createList(`Fav${Date.now()}`).then((list) => {
        api.favorites.addRestaurant(list.body.id, PLACES.A).then((res) => {
          expect(res.status, "Adding a restaurant must return 201").to.eq(201);
          expect(res.headers.location, "Location must point under the list").to.include(
            `/api/v1/favorites/lists/${list.body.id}/restaurants/${res.body.id}`,
          );
        });
        api.favorites.addRestaurant(list.body.id, PLACES.A).its("status").should("eq", 409);
      });
    });

    it("S5 - deleting a favorite under a different list returns 404", () => {
      api.favorites.createList(`FavA${Date.now()}`).then((listA) => {
        api.favorites.createList(`FavB${Date.now()}`).then((listB) => {
          api.favorites.addRestaurant(listA.body.id, PLACES.A).then((fav) => {
            api.favorites.removeRestaurant(listB.body.id, fav.body.id).its("status").should("eq", 404);
          });
        });
      });
    });
  });

  describe("history", () => {
    const user = useTestUser("histrest");

    beforeEach(() => cy.apiLoginAs(user));

    it("BASE - POST /history returns 201 with a Location header, and GET /history/{id} returns the entry", () => {
      api.history.add(PLACES.A).then((res) => {
        expect(res.status, "Adding a history entry must return 201").to.eq(201);
        expect(res.headers.location, "Location must point to the new entry").to.include(
          `/api/v1/history/${res.body.id}`,
        );
        api.history.get(res.body.id).then((got) => {
          expect(got.status, "GET by id must return 200").to.eq(200);
          expect(got.body.id, "GET by id must return the same entry").to.eq(res.body.id);
        });
      });
    });

    it("S2 - GET /history/{id} of an unknown id returns 404", () => {
      api.history.get(999999999).its("status").should("eq", 404);
    });

    it("S3 - GET /history returns the pagination envelope", () => {
      api.history.add(PLACES.A);
      api.history.list().then((res) => {
        expect(res.status).to.eq(200);
        expect(res.body.items, "items must be an array").to.be.an("array");
        expect(res.body.total, "total must count the entries").to.be.at.least(1);
        expect(res.body).to.include({ limit: 50, offset: 0 });
      });
    });

    it("S4 - limit and offset slice the history", () => {
      api.history.add(PLACES.A);
      api.history.add(PLACES.B);
      api.history.list({ limit: 1, offset: 1 }).then((res) => {
        expect(res.body.items.length, "limit=1 must return one item").to.eq(1);
        expect(res.body).to.include({ limit: 1, offset: 1 });
        expect(res.body.total, "total must not depend on the page").to.be.at.least(2);
      });
    });

    [
      ["limit=0", { limit: 0 }],
      ["limit=101", { limit: 101 }],
      ["offset=-1", { offset: -1 }],
    ].forEach(([title, qs]) => {
      it(`S5 - ${title} returns 422`, () => {
        api.history.list(qs).its("status").should("eq", 422);
      });
    });

    it("S6 - GET /history/popular returns a plain array", () => {
      api.history.popular({ limit: 5 }).then((res) => {
        expect(res.status, "Popular must return 200").to.eq(200);
        expect(res.body, "Popular must be a plain array").to.be.an("array");
      });
    });
  });

  describe("saved for later", () => {
    const user = useTestUser("savrest");

    beforeEach(() => cy.apiLoginAs(user));

    it("BASE - a new entry returns 201 with a Location header and can be fetched by id", () => {
      api.savedForLater.add(`sv_${Date.now()}`).then((res) => {
        expect(res.status).to.eq(201);
        expect(res.headers.location, "Location must point to the new entry").to.include(
          `/api/v1/saved-for-later/${res.body.id}`,
        );
        api.savedForLater.get(res.body.id).its("status").should("eq", 200);
      });
    });

    it("S2 - saving an already saved place returns 200 with already_saved and no Location", () => {
      const placeId = `sv_${Date.now()}`;
      api.savedForLater.add(placeId);
      api.savedForLater.add(placeId).then((res) => {
        expect(res.status, "Duplicate save must return 200").to.eq(200);
        expect(res.body.already_saved).to.eq(true);
        expect(res.headers, "No Location when nothing was created").to.not.have.property("location");
      });
    });
  });

  describe("ratings", () => {
    const owner = useTestUser("ratown");
    const liker = useTestUser("ratlike");
    const MAX = { quality: 5, price: 5, hygiene: 5, service: 5 };
    let placeId;

    beforeEach(() => {
      placeId = `rt_${Date.now()}`;
      cy.apiLoginAs(owner);
    });

    it("BASE - PUT returns 201 with Location when created and 200 when replaced", () => {
      api.ratings.create(placeId, MAX, "first").then((res) => {
        expect(res.status, "First PUT must create").to.eq(201);
        expect(res.headers.location, "Location must point to the rating").to.include(
          `/api/v1/restaurants/${placeId}/rating`,
        );
      });
      api.ratings.create(placeId, { ...MAX, quality: 2 }, "second").then((res) => {
        expect(res.status, "Second PUT must replace").to.eq(200);
        expect(res.body.quality).to.eq(2);
      });
      api.ratings.remove(placeId);
    });

    it("S2 - GET own rating returns the stored rating, and {} when there is none", () => {
      api.ratings.get(placeId).then((res) => {
        expect(res.status).to.eq(200);
        expect(res.body, "No rating yet").to.deep.eq({});
      });
      api.ratings.create(placeId, MAX, "mine");
      api.ratings.get(placeId).then((res) => {
        expect(res.body).to.include({ ...MAX, comment: "mine" });
      });
      api.ratings.remove(placeId);
    });

    it("S3 - deleting a missing rating returns 404", () => {
      api.ratings.remove(placeId).its("status").should("eq", 404);
    });

    it("S4 - GET /restaurants/{place_id}/ratings returns the pagination envelope", () => {
      api.ratings.create(placeId, MAX, "public");
      api.ratings.byRestaurant(placeId).then((res) => {
        expect(res.status).to.eq(200);
        expect(res.body.items.length, "One public rating").to.eq(1);
        expect(res.body).to.include({ total: 1, limit: 50, offset: 0 });
      });
      api.ratings.remove(placeId);
    });

    it("S5 - liking twice and unliking twice are idempotent", () => {
      api.ratings.create(placeId, MAX, "likeable").then((created) => {
        const ratingId = created.body.id;
        cy.apiLoginAs(liker);
        api.ratings.like(ratingId).then((res) => {
          expect(res.status, "First like").to.eq(200);
          expect(res.body.liked_by_me).to.eq(true);
        });
        api.ratings.like(ratingId).then((res) => {
          expect(res.status, "Second like is idempotent").to.eq(200);
          expect(res.body.likes, "Likes must not be counted twice").to.eq(1);
        });
        api.ratings.unlike(ratingId).its("status").should("eq", 204);
        api.ratings.unlike(ratingId).its("status").should("eq", 204);
        cy.apiLoginAs(owner);
        api.ratings.remove(placeId);
      });
    });
  });
});
