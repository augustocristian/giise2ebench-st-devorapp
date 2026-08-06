// API Base-Choice tests for the ratings (valoraciones) module.
// Mirrors selenium-java's tests/api/TestApiValoracionesBC.java.
//
// Cases covered:
//   BASE  - full rating (all 4 aspects + comment) is stored and retrieved correctly.
//   S3    - calidad=1, precio=3 -> scores match exactly.
//   S4    - calidad=3, precio=1 -> scores match exactly.
//   S9    - higiene=1, trato=3 -> scores match exactly.
//   S10   - higiene=3, trato=1 -> scores match exactly.
//   S14   - empty comment is stored as empty string or null.
//   del   - deleting a rating removes it from GET /api/valoraciones.

import { valoracionesUrl, uniqueTs, uniqueEmail, uniqueUsername, valoracionPayload } from "../../support/commands/api";

describe("API - Valoraciones - Base-Choice", () => {
  let email;
  let password;

  before(() => {
    const ts = uniqueTs();
    email = uniqueEmail(ts);
    password = "Test1234!";
    cy.apiRegisterAndLogin(uniqueUsername(ts), email, password);
  });

  beforeEach(() => {
    cy.apiLogin(email, password);
  });

  after(() => {
    cy.deleteTestUser(email, password);
  });

  it("BASE - full rating with all aspects at max stored and retrieved correctly", () => {
    const placeId = `bc_base_${uniqueTs()}`;
    cy.createValoracion(placeId, 5, 5, 5, 5, "Excelente servicio y comida deliciosa").then((val) => {
      expect(val.id, "id must be positive").to.be.above(0);
      expect(val.calidad, "calidad=5").to.eq(5);
      expect(val.precio, "precio=5").to.eq(5);
      expect(val.higiene, "higiene=5").to.eq(5);
      expect(val.trato, "trato=5").to.eq(5);
      expect(val.comentario, "comentario matches").to.eq("Excelente servicio y comida deliciosa");
    });
  });

  it("S3 - calidad=1, precio=3, higiene=5, trato=5 stored correctly", () => {
    const placeId = `bc_s3_${uniqueTs()}`;
    cy.createValoracion(placeId, 1, 3, 5, 5, "OK").then((val) => {
      expect(val.calidad, "calidad=1").to.eq(1);
      expect(val.precio, "precio=3").to.eq(3);
      expect(val.higiene, "higiene=5").to.eq(5);
      expect(val.trato, "trato=5").to.eq(5);
    });
  });

  it("S4 - calidad=3, precio=1, higiene=5, trato=5 stored correctly", () => {
    const placeId = `bc_s4_${uniqueTs()}`;
    cy.createValoracion(placeId, 3, 1, 5, 5, "OK").then((val) => {
      expect(val.calidad, "calidad=3").to.eq(3);
      expect(val.precio, "precio=1").to.eq(1);
    });
  });

  it("S9 - calidad=5, precio=5, higiene=1, trato=3 stored correctly", () => {
    const placeId = `bc_s9_${uniqueTs()}`;
    cy.createValoracion(placeId, 5, 5, 1, 3, "Regular higiene").then((val) => {
      expect(val.higiene, "higiene=1").to.eq(1);
      expect(val.trato, "trato=3").to.eq(3);
    });
  });

  it("S10 - calidad=5, precio=5, higiene=3, trato=1 stored correctly", () => {
    const placeId = `bc_s10_${uniqueTs()}`;
    cy.createValoracion(placeId, 5, 5, 3, 1, "Trato mejorable").then((val) => {
      expect(val.higiene, "higiene=3").to.eq(3);
      expect(val.trato, "trato=1").to.eq(1);
    });
  });

  it("S14 - rating with empty comment is accepted (HTTP 201)", () => {
    const placeId = `bc_s14_${uniqueTs()}`;
    cy.apiPost(valoracionesUrl(""), valoracionPayload(placeId, 5, 5, 5, 5, "")).then((res) => {
      expect(res.status, "A rating with an empty comment must return HTTP 201").to.eq(201);
    });
  });

  it("Deleting a rating removes it from GET /api/valoraciones", () => {
    const placeId = `bc_del_${uniqueTs()}`;
    cy.createValoracion(placeId, 4, 3, 5, 4, "A delete test");

    cy.apiDelete(valoracionesUrl(`/${placeId}`)).then((res) => {
      expect(res.status, "DELETE must return HTTP 204").to.eq(204);
    });

    cy.apiGet(valoracionesUrl("")).then((res) => {
      const found = res.body.some((v) => v.place_id === placeId);
      expect(found, "Deleted valoracion must not appear in GET list").to.be.false;
    });
  });
});
