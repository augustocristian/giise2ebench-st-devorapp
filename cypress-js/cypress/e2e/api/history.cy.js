// History: entries recorded when a user opens a restaurant.
import { api } from "../../support/commands/api";
import { PLACES } from "../../support/data/places";
import { useTestUser } from "../../support/commands/users";

describe("API - History - Base-Choice", () => {
  describe("with an empty history", () => {
    const user = useTestUser("histempty");

    it("Case 2 - a fresh user gets an empty array", () => {
      cy.apiLoginAs(user);
      api.history.list().then((res) => {
        expect(res.body.items, "A brand-new user must have an empty history").to.be.empty;
      });
    });
  });

  describe("with entries", () => {
    const user = useTestUser("histapi");

    beforeEach(() => cy.apiLoginAs(user));

    it("BASE - adding 3 entries returns them all in the history", () => {
      [PLACES.A, PLACES.B, PLACES.C].forEach((placeId) => api.history.add(placeId));

      api.history.list().then((res) => {
        expect(res.body.items.length, "History must contain the 3 added entries").to.be.at.least(3);
      });
    });

    it("Case 5 - a new entry is returned with id, place_id and accessed_at", () => {
      api.history.add(PLACES.A).then((res) => {
        expect(res.body.id, "Entry id must be positive").to.be.above(0);
        expect(res.body.place_id, "place_id must echo the added place").to.eq(PLACES.A);
        expect(res.body, "Entry must have a accessed_at timestamp").to.have.property("accessed_at");
      });
    });

    it("Case 6 - deleting an entry removes it from the history", () => {
      api.history.add(PLACES.A).then((added) => {
        const entryId = added.body.id;
        api.history.remove(entryId).its("status").should("eq", 204);

        api.history.list().then((res) => {
          expect(
            res.body.items.map((e) => e.id),
            "A deleted entry must not be listed",
          ).to.not.include(entryId);
        });
      });
    });

    it("Case 3 - the latest entry has a non-null accessed_at", () => {
      api.history.add(PLACES.B);

      api.history.list().then((res) => {
        const latest = res.body.items[res.body.items.length - 1];
        expect(latest.accessed_at, "accessed_at must be populated").to.not.be.null;
      });
    });
  });
});
