// Ratings: scores and comment are stored as sent; ratings can be deleted.
import { api } from "../../support/commands/api";
import { useTestUser } from "../../support/commands/users";

describe("API - Valoraciones - Base-Choice", () => {
  const user = useTestUser("valapi");
  let placeId;

  beforeEach(() => {
    cy.apiLoginAs(user);
    placeId = `bc_${Date.now()}`;
  });

  const MAX = { calidad: 5, precio: 5, higiene: 5, trato: 5 };

  const storedScores = [
    ["BASE - all aspects at max", MAX, "Excelente servicio y comida deliciosa"],
    ["S3 - calidad=1, precio=3", { ...MAX, calidad: 1, precio: 3 }, "OK"],
    ["S4 - calidad=3, precio=1", { ...MAX, calidad: 3, precio: 1 }, "OK"],
    ["S9 - higiene=1, trato=3", { ...MAX, higiene: 1, trato: 3 }, "Regular higiene"],
    ["S10 - higiene=3, trato=1", { ...MAX, higiene: 3, trato: 1 }, "Trato mejorable"],
  ];

  storedScores.forEach(([title, scores, comentario]) => {
    it(`${title} is stored exactly as sent`, () => {
      api.valoraciones.create(placeId, scores, comentario).then((res) => {
        expect(res.body.id, "Rating id must be positive").to.be.above(0);
        expect(res.body, "Stored scores and comment").to.include({ ...scores, comentario });
      });
    });
  });

  it("S14 - a rating with an empty comment is accepted (201)", () => {
    api.valoraciones.create(placeId, MAX, "").its("status").should("eq", 201);
  });

  it("Deleting a rating removes it from the ratings list", () => {
    api.valoraciones.create(placeId, { calidad: 4, precio: 3, higiene: 5, trato: 4 }, "A delete test");

    api.valoraciones.remove(placeId).its("status").should("eq", 204);

    api.valoraciones.list().then((res) => {
      expect(
        res.body.map((v) => v.place_id),
        "A deleted rating must not be listed",
      ).to.not.include(placeId);
    });
  });
});
