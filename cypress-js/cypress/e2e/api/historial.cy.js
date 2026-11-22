// History: entries recorded when a user opens a restaurant.
import { api } from "../../support/commands/api";
import { PLACES } from "../../support/data/places";
import { useTestUser } from "../../support/commands/users";

describe("API - Historial - Base-Choice", () => {
  describe("with an empty history", () => {
    const user = useTestUser("histempty");

    it("Case 2 - a fresh user gets an empty array", () => {
      cy.apiLoginAs(user);
      api.historial.list().then((res) => {
        expect(res.body, "A brand-new user must have an empty history").to.be.empty;
      });
    });
  });

  describe("with entries", () => {
    const user = useTestUser("histapi");

    beforeEach(() => cy.apiLoginAs(user));

    it("BASE - adding 3 entries returns them all in the history", () => {
      [PLACES.A, PLACES.B, PLACES.C].forEach((placeId) => api.historial.add(placeId));

      api.historial.list().then((res) => {
        expect(res.body.length, "History must contain the 3 added entries").to.be.at.least(3);
      });
    });

    it("Case 5 - a new entry is returned with id, place_id and fecha_acceso", () => {
      api.historial.add(PLACES.A).then((res) => {
        expect(res.body.id, "Entry id must be positive").to.be.above(0);
        expect(res.body.place_id, "place_id must echo the added place").to.eq(PLACES.A);
        expect(res.body, "Entry must have a fecha_acceso timestamp").to.have.property("fecha_acceso");
      });
    });

    it("Case 6 - deleting an entry removes it from the history", () => {
      api.historial.add(PLACES.A).then((added) => {
        const entryId = added.body.id;
        api.historial.remove(entryId).its("status").should("eq", 204);

        api.historial.list().then((res) => {
          expect(
            res.body.map((e) => e.id),
            "A deleted entry must not be listed",
          ).to.not.include(entryId);
        });
      });
    });

    it("Case 3 - the latest entry has a non-null fecha_acceso", () => {
      api.historial.add(PLACES.B);

      api.historial.list().then((res) => {
        const latest = res.body[res.body.length - 1];
        expect(latest.fecha_acceso, "fecha_acceso must be populated").to.not.be.null;
      });
    });
  });
});
