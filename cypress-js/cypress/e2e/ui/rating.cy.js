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
  const MAX = { quality: 5, price: 5, hygiene: 5, service: 5 };

  beforeEach(() => {
    // Fresh state per test: no rating yet and a history entry to rate.
    cy.apiLoginAs(user);
    api.ratings.remove(PLACES.A);
    api.history.add(PLACES.A);
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
    ["S2", "quality"],
    ["S5", "price"],
    ["S8", "hygiene"],
    ["S11", "service"],
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
    ["S3, S7", { quality: 1, price: 3 }],
    ["S4, S6", { quality: 3, price: 1 }],
    ["S9, S13", { hygiene: 1, service: 3 }],
    ["S10, S12", { hygiene: 3, service: 1 }],
  ].forEach(([ids, scores]) => {
    it(`${ids} - variable scores ${JSON.stringify(scores)} are saved`, () => {
      page.fillRating({ ...MAX, ...scores }, "Comentario").expectRatingSubmitEnabled();
      expectSubmitted();
    });
  });
});
