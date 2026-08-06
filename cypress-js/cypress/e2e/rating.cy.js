// Browser tests for the DevorApp rating modal (accessed from the history page).
// Mirrors selenium-java's tests/e2e/TestRatingView.java.
//
// Base-Choice coverage:
//   BASE - all aspects rated at max with a comment -> submission succeeds.
//   S2, S5, S8, S11 - any single aspect at 0 stars disables the submit button.
//   S3, S4, S6, S7 - variable calidad/precio ratings with the rest at max -> succeeds.
//   S9, S10, S12, S13 - variable higiene/trato ratings with the rest at max -> succeeds.
//   S14 - empty comment is accepted.

import LoginPage from "../support/pages/LoginPage";
import { valoracionesUrl, historialUrl, uniqueTs, uniqueEmail, uniqueUsername } from "../support/commands/api";

describe("Rating", () => {
  const PLACE_ID = "ChIJN1t_tDeuEmsRUsoyG83frY4";
  const PASSWORD = "Test1234!";
  let testEmail;

  before(() => {
    const ts = uniqueTs();
    testEmail = uniqueEmail(ts);
    cy.registerTestUser(uniqueUsername(ts), testEmail, PASSWORD);
  });

  beforeEach(() => {
    // Mirrors Java's @BeforeEach ensureHistorialEntry: clear any existing
    // rating for PLACE_ID and re-seed a fresh historial entry via the API.
    cy.apiLogin(testEmail, PASSWORD);
    cy.apiDelete(valoracionesUrl(`/${PLACE_ID}`));
    cy.apiPost(historialUrl(""), { place_id: PLACE_ID });
  });

  after(() => {
    cy.deleteTestUser(testEmail, PASSWORD);
  });

  function loginAndGoToHistory() {
    new LoginPage().visit().enterIdentifier(testEmail).enterPassword(PASSWORD).submitLogin();
    cy.visit("/history");
  }

  function openRatingModal() {
    cy.get(".restaurant-compact-card").eq(0).find("button").first().click();
    cy.contains("button", "Valorar restaurante").click();
    cy.get(".valuation-content").should("be.visible");
  }

  function selectStars(aspect, stars) {
    if (stars <= 0) return;
    cy.contains(".aspect-row-premium", aspect, { matchCase: false })
      .find("svg")
      .eq(stars - 1)
      .click();
  }

  function isSubmitEnabled() {
    return cy.get("body").then(($body) => {
      const btn = $body.find("button.btn-submit-valuation");
      return btn.length > 0 && !btn.is(":disabled");
    });
  }

  function fillRatings(calidad, precio, higiene, trato, comentario) {
    selectStars("calidad", calidad);
    selectStars("precio", precio);
    selectStars("higiene", higiene);
    selectStars("trato", trato);
    cy.get("textarea.textarea-premium")
      .clear()
      .then(($ta) => {
        if (comentario) cy.wrap($ta).type(comentario);
      });
  }

  function submitValuationAndVerifySuccess() {
    cy.get("button.btn-submit-valuation").click();
    cy.get(".valuation-content").should("not.exist");
    cy.get(".toast.success").should("be.visible");
  }

  it("debe guardar la valoración con todos los aspectos al máximo y comentario (BASE)", () => {
    loginAndGoToHistory();
    openRatingModal();
    fillRatings(5, 5, 5, 5, "Excelente servicio y comida deliciosa");
    isSubmitEnabled().should("be.true");
    submitValuationAndVerifySuccess();
  });

  it("debe deshabilitar envío con 0 estrellas en cualquier aspecto (S2, S5, S8, S11) y aceptar comentario vacío (S14)", () => {
    // S2: Calidad = 0
    loginAndGoToHistory();
    openRatingModal();
    fillRatings(0, 5, 5, 5, "Comentario");
    isSubmitEnabled().should("be.false");

    // S5: Precio = 0
    cy.visit("/history");
    openRatingModal();
    fillRatings(5, 0, 5, 5, "Comentario");
    isSubmitEnabled().should("be.false");

    // S8: Higiene = 0
    cy.visit("/history");
    openRatingModal();
    fillRatings(5, 5, 0, 5, "Comentario");
    isSubmitEnabled().should("be.false");

    // S11: Trato = 0
    cy.visit("/history");
    openRatingModal();
    fillRatings(5, 5, 5, 0, "Comentario");
    isSubmitEnabled().should("be.false");

    // S14: empty comment is accepted
    cy.visit("/history");
    openRatingModal();
    fillRatings(5, 5, 5, 5, "");
    isSubmitEnabled().should("be.true");
    submitValuationAndVerifySuccess();
  });

  it("debe guardar valoraciones con puntuaciones variables de calidad, precio, higiene y trato (S3, S4, S6, S7, S9, S10, S12, S13)", () => {
    // S3 & S7: Calidad = 1, Precio = 3 (resto base = 5)
    loginAndGoToHistory();
    openRatingModal();
    fillRatings(1, 3, 5, 5, "Comentario");
    isSubmitEnabled().should("be.true");
    submitValuationAndVerifySuccess();

    // S4 & S6: Calidad = 3, Precio = 1
    cy.apiDelete(valoracionesUrl(`/${PLACE_ID}`));
    cy.apiPost(historialUrl(""), { place_id: PLACE_ID });
    cy.visit("/history");
    openRatingModal();
    fillRatings(3, 1, 5, 5, "Comentario");
    isSubmitEnabled().should("be.true");
    submitValuationAndVerifySuccess();

    // S9 & S13: Higiene = 1, Trato = 3
    cy.apiDelete(valoracionesUrl(`/${PLACE_ID}`));
    cy.apiPost(historialUrl(""), { place_id: PLACE_ID });
    cy.visit("/history");
    openRatingModal();
    fillRatings(5, 5, 1, 3, "Comentario");
    isSubmitEnabled().should("be.true");
    submitValuationAndVerifySuccess();

    // S10 & S12: Higiene = 3, Trato = 1
    cy.apiDelete(valoracionesUrl(`/${PLACE_ID}`));
    cy.apiPost(historialUrl(""), { place_id: PLACE_ID });
    cy.visit("/history");
    openRatingModal();
    fillRatings(5, 5, 3, 1, "Comentario");
    isSubmitEnabled().should("be.true");
    submitValuationAndVerifySuccess();
  });
});
