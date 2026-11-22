// Rating modal (opened from the history page): which score combinations can be submitted.
// Base-Choice scenarios: BASE, S2-S14.
import { useTestUser } from "../../support/commands/users";
import { api } from "../../support/commands/api";
import { PLACES } from "../../support/data/places";
import HistoryPage from "../../support/pages/HistoryPage";
import { TID } from "../../support/testids";

describe("Rating", () => {
  const user = useTestUser("rate");
  const page = new HistoryPage();
  const MAX = { calidad: 5, precio: 5, higiene: 5, trato: 5 };

  beforeEach(() => {
    // Fresh state per test: no rating yet and a history entry to rate.
    cy.apiLoginAs(user);
    api.valoraciones.remove(PLACES.A);
    api.historial.add(PLACES.A);
    cy.loginAs(user);
    page.visit().openRatingModal();
  });

  function expectSubmitted() {
    page.submitRating();
    cy.tid(TID.shared.toastSuccess).should("be.visible");
  }

  it("BASE - all aspects at 5 with a comment are saved", () => {
    page.fillRating(MAX, "Excelente servicio y comida deliciosa").expectRatingSubmitEnabled();
    expectSubmitted();
  });

  [
    ["S2", "calidad"],
    ["S5", "precio"],
    ["S8", "higiene"],
    ["S11", "trato"],
  ].forEach(([id, aspect]) => {
    it(`${id} - ${aspect} at 0 stars disables submit`, () => {
      page.fillRating({ ...MAX, [aspect]: 0 }, "Comentario").expectRatingSubmitDisabled();
    });
  });

  it("S14 - an empty comment is accepted", () => {
    page.fillRating(MAX, "").expectRatingSubmitEnabled();
    expectSubmitted();
  });

  [
    ["S3, S7", { calidad: 1, precio: 3 }],
    ["S4, S6", { calidad: 3, precio: 1 }],
    ["S9, S13", { higiene: 1, trato: 3 }],
    ["S10, S12", { higiene: 3, trato: 1 }],
  ].forEach(([ids, scores]) => {
    it(`${ids} - variable scores ${JSON.stringify(scores)} are saved`, () => {
      page.fillRating({ ...MAX, ...scores }, "Comentario").expectRatingSubmitEnabled();
      expectSubmitted();
    });
  });
});
