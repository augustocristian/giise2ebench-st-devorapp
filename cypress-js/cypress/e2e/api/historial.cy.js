// API Base-Choice tests for the history (historial) module.
// Mirrors selenium-java's tests/api/TestApiHistorialBC.java.
//
// Cases covered:
//   BASE   - multiple history entries are returned by GET /api/historial.
//   Caso 2 - a fresh user has an empty history (0 entries).
//   Caso 5 - exactly 1 history entry is returned with correct fields.
//   Caso 6 - deleting an entry removes it from the history list.
//   Caso 3 - entry has a fecha_acceso (timestamp) field populated.

import { authUrl, historialUrl, uniqueTs, uniqueEmail, uniqueUsername, registerPayload, loginPayload } from "../../support/commands/api";

describe("API - Historial - Base-Choice", () => {
  const PLACE_A = "ChIJN1t_tDeuEmsRUsoyG83frY4";
  const PLACE_B = "ChIJdd4hrwug2EcRmSrV3Vo6llI";
  const PLACE_C = "ChIJ2eUgeAK6j4ARbn5u_wAGqWA";

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

  it("BASE - adding 3 history entries returns all 3 via GET /api/historial", () => {
    cy.addHistorial(PLACE_A);
    cy.addHistorial(PLACE_B);
    cy.addHistorial(PLACE_C);

    cy.apiGet(historialUrl("")).then((res) => {
      expect(res.body.length, "After adding 3 entries historial must have at least 3 items (BASE)").to.be.at.least(3);
    });
  });

  it("Caso 2 - fresh user with no history gets an empty array", () => {
    // Uses a separate fresh user, isolated to this test via a dedicated cookie
    // jar - Cypress's cy.request within cy.session or a fresh browser context
    // isn't needed here since a distinct user's session naturally doesn't
    // carry the outer test's cookies once we log in as them below.
    const ts = uniqueTs();
    const freshEmail = uniqueEmail(ts);
    const freshUsername = uniqueUsername(ts);
    const freshPassword = "Test1234!";

    cy.apiPost(authUrl("/register"), registerPayload(freshUsername, freshEmail, freshPassword, "Test", "User", ""));
    cy.apiPost(authUrl("/login"), loginPayload(freshEmail, freshPassword));

    cy.apiGet(historialUrl("")).then((res) => {
      expect(res.body, "A brand-new user must have an empty history").to.be.empty;
    });

    cy.deleteTestUser(freshEmail, freshPassword);
    // Restore the outer suite's session for subsequent tests.
    cy.apiLogin(email, password);
  });

  it("Caso 5 - adding 1 history entry returns it with id, place_id and fecha_acceso", () => {
    cy.apiPost(historialUrl(""), { place_id: PLACE_A }).then((res) => {
      const entry = res.body;
      expect(entry.id, "Entry id must be positive").to.be.above(0);
      expect(entry.place_id, "place_id must match").to.eq(PLACE_A);
      expect(entry, "Entry must have a fecha_acceso timestamp field").to.have.property("fecha_acceso");
    });
  });

  it("Caso 6 - deleting a history entry removes it from GET /api/historial", () => {
    cy.addHistorial(PLACE_A).then((entryId) => {
      cy.apiDelete(historialUrl(`/${entryId}`)).then((res) => {
        expect(res.status, "DELETE historial entry must return HTTP 204").to.eq(204);
      });

      cy.apiGet(historialUrl("")).then((res) => {
        const stillPresent = res.body.some((e) => e.id === entryId);
        expect(stillPresent, "Deleted entry must not appear in GET /api/historial").to.be.false;
      });
    });
  });

  it("Caso 3 - each history entry has a non-null fecha_acceso field", () => {
    cy.addHistorial(PLACE_B);

    cy.apiGet(historialUrl("")).then((res) => {
      expect(res.body, "Historial must have at least 1 entry").to.not.be.empty;
      const latest = res.body[res.body.length - 1];
      expect(latest, "Entry must have fecha_acceso field").to.have.property("fecha_acceso");
      expect(latest.fecha_acceso, "fecha_acceso must not be null").to.not.be.null;
    });
  });
});
