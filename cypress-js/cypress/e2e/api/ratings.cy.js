// Ratings: scores and comment are stored as sent; ratings can be deleted.
import { api } from "../../support/commands/api";
import { useTestUser } from "../../support/commands/users";

describe("API - Ratings - Base-Choice", () => {
  const user = useTestUser("valapi");
  let placeId;

  beforeEach(() => {
    cy.apiLoginAs(user);
    placeId = `bc_${Date.now()}`;
  });

  const MAX = { quality: 5, price: 5, hygiene: 5, service: 5 };

  const storedScores = [
    ["BASE - all aspects at max", MAX, "Excelente servicio y comida deliciosa"],
    ["S3 - quality=1, price=3", { ...MAX, quality: 1, price: 3 }, "OK"],
    ["S4 - quality=3, price=1", { ...MAX, quality: 3, price: 1 }, "OK"],
    ["S9 - hygiene=1, service=3", { ...MAX, hygiene: 1, service: 3 }, "Poor hygiene"],
    ["S10 - hygiene=3, service=1", { ...MAX, hygiene: 3, service: 1 }, "Service could improve"],
  ];

  storedScores.forEach(([title, scores, comment]) => {
    it(`${title} is stored exactly as sent`, () => {
      api.ratings.create(placeId, scores, comment).then((res) => {
        expect(res.body.id, "Rating id must be positive").to.be.above(0);
        expect(res.body, "Stored scores and comment").to.include({ ...scores, comment });
      });
    });
  });

  it("S14 - a rating with an empty comment is accepted (201)", () => {
    api.ratings.create(placeId, MAX, "").its("status").should("eq", 201);
  });

  it("Deleting a rating removes it from the ratings list", () => {
    api.ratings.create(placeId, { quality: 4, price: 3, hygiene: 5, service: 4 }, "A delete test");

    api.ratings.remove(placeId).its("status").should("eq", 204);

    api.ratings.list().then((res) => {
      expect(
        res.body.items.map((v) => v.place_id),
        "A deleted rating must not be listed",
      ).to.not.include(placeId);
    });
  });
});
