// API Base-Choice tests for the favorites module.
// Mirrors selenium-java's tests/api/TestApiFavoritosBC.java.
//
// Cases covered:
//   BASE   - create list, add several restaurants, GET returns all.
//   Caso 2 - GET empty list returns empty restaurantes array.
//   Caso 3 - GET list with 1 restaurant returns array of size 1.
//   Caso 4 - GET all lists returns the expected count.
//   Caso 5 - DELETE restaurant removes it from the list detail.
//   Caso 6 - DELETE list removes it from the user's collection.

import { favoritosUrl, uniqueTs, uniqueEmail, uniqueUsername, favoritoPayload, listaPayload } from "../../support/commands/api";

describe("API - Favoritos - Base-Choice", () => {
  const PLACE_A = "ChIJN1t_tDeuEmsRUsoyG83frY4";
  const PLACE_B = "ChIJdd4hrwug2EcRmSrV3Vo6llI";
  const PLACE_C = "ChIJ2eUgeAK6j4ARbn5u_wAGqWA";

  let email;
  let password;
  let listaId;

  before(() => {
    const ts = uniqueTs();
    email = uniqueEmail(ts);
    password = "Test1234!";
    cy.apiRegisterAndLogin(uniqueUsername(ts), email, password);
  });

  beforeEach(() => {
    cy.apiLogin(email, password);
    cy.createLista(`BCTest${uniqueTs()}`).then((id) => {
      listaId = id;
    });
  });

  after(() => {
    cy.deleteTestUser(email, password);
  });

  it("BASE - adding 3 restaurants to a list returns all 3 in the detail endpoint", () => {
    cy.apiPost(favoritosUrl(`/listas/${listaId}`), favoritoPayload(PLACE_A));
    cy.apiPost(favoritosUrl(`/listas/${listaId}`), favoritoPayload(PLACE_B));
    cy.apiPost(favoritosUrl(`/listas/${listaId}`), favoritoPayload(PLACE_C));

    cy.apiGet(favoritosUrl(`/listas/${listaId}`)).then((res) => {
      expect(res.body.restaurantes.length, "After adding 3 restaurants the detail must return exactly 3").to.eq(3);
    });
  });

  it("Caso 2 - a new list has an empty restaurantes array", () => {
    cy.apiGet(favoritosUrl(`/listas/${listaId}`)).then((res) => {
      expect(res.body.restaurantes, "A brand-new list must have 0 restaurants").to.be.empty;
    });
  });

  it("Caso 3 - adding 1 restaurant returns a restaurantes array of size 1", () => {
    cy.apiPost(favoritosUrl(`/listas/${listaId}`), favoritoPayload(PLACE_A));

    cy.apiGet(favoritosUrl(`/listas/${listaId}`)).then((res) => {
      expect(res.body.restaurantes.length, "After adding 1 restaurant the detail must return exactly 1").to.eq(1);
      expect(res.body.restaurantes[0].place_id, "The place_id must match the added restaurant").to.eq(PLACE_A);
    });
  });

  it("Caso 4 - GET /api/favoritos/listas returns a non-empty array with the created list", () => {
    cy.apiGet(favoritosUrl("/listas")).then((res) => {
      expect(res.body, "The listas array must not be empty after creating a list").to.not.be.empty;
      const found = res.body.some((l) => l.id === listaId);
      expect(found, `The created list id=${listaId} must appear in GET /api/favoritos/listas`).to.be.true;
    });
  });

  it("Caso 5 - deleting a restaurant removes it from the list detail", () => {
    let favIdA;
    cy.addFavorito(listaId, PLACE_A).then((id) => {
      favIdA = id;
      cy.apiPost(favoritosUrl(`/listas/${listaId}`), favoritoPayload(PLACE_B));

      cy.apiDelete(favoritosUrl(`/${favIdA}`)).then((res) => {
        expect(res.status, "DELETE favorito must return HTTP 204").to.eq(204);
      });

      cy.apiGet(favoritosUrl(`/listas/${listaId}`)).then((res) => {
        const restaurantes = res.body.restaurantes;
        expect(restaurantes.some((r) => r.place_id === PLACE_A), "Deleted restaurant (PLACE_A) must not appear in list detail").to.be.false;
        expect(restaurantes.some((r) => r.place_id === PLACE_B), "Non-deleted restaurant (PLACE_B) must still appear").to.be.true;
      });
    });
  });

  it("Caso 6 - deleting a list removes it from GET /api/favoritos/listas", () => {
    cy.apiDelete(favoritosUrl(`/listas/${listaId}`)).then((res) => {
      expect(res.status, "DELETE lista must return HTTP 204").to.eq(204);
    });

    cy.apiGet(favoritosUrl("/listas")).then((res) => {
      const stillPresent = res.body.some((l) => l.id === listaId);
      expect(stillPresent, "Deleted list must not appear in GET /api/favoritos/listas").to.be.false;
    });

    // Prevent afterEach-style double-delete issues (mirrors Java's listaId = -1)
    listaId = -1;
  });
});
