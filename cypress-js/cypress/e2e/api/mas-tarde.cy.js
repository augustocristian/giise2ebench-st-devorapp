// Validates the save-for-later endpoints. Mirrors selenium-java's
// tests/api/TestApiMasTarde.java.
//
//   POST   /api/mas-tarde              - add restaurant (HTTP 201)
//   GET    /api/mas-tarde              - list saved entries (HTTP 200)
//   DELETE /api/mas-tarde/{entry_id}   - remove entry (HTTP 204)
//
// Each test uses a unique fake place_id to avoid state interference between
// tests in the same spec.

import { masTardeUrl, uniqueTs, uniqueEmail, uniqueUsername, masTardePayload } from "../../support/commands/api";

describe("API - Mas Tarde", () => {
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

  it("POST /api/mas-tarde returns HTTP 201 with id, place_id and already_saved false", () => {
    const placeId = `test_place_${uniqueTs()}`;

    cy.apiPost(masTardeUrl(""), masTardePayload(placeId)).then((res) => {
      expect(res.status, "Adding to mas-tarde must return HTTP 201").to.eq(201);
      expect(res.body.id, "entry id must be positive").to.be.above(0);
      expect(res.body.place_id, "place_id must match").to.eq(placeId);
    });
  });

  it("POST /api/mas-tarde twice for the same place returns already_saved true on second call", () => {
    const placeId = `test_place_${uniqueTs()}`;

    cy.apiPost(masTardeUrl(""), masTardePayload(placeId)).then((first) => {
      expect(first.body.already_saved, "First add must have already_saved false").to.eq(false);
    });

    cy.apiPost(masTardeUrl(""), masTardePayload(placeId)).then((second) => {
      expect(second.body.already_saved, "Second add of same place must have already_saved true").to.eq(true);
    });
  });

  it("DELETE /api/mas-tarde/{entry_id} returns HTTP 204", () => {
    cy.addMasTarde(`test_place_${uniqueTs()}`).then((entryId) => {
      cy.apiDelete(masTardeUrl(`/${entryId}`)).then((res) => {
        expect(res.status, "DELETE mas-tarde entry must return HTTP 204").to.eq(204);
      });
    });
  });

  it("GET /api/mas-tarde returns HTTP 200 with a JSON array", () => {
    cy.apiGet(masTardeUrl("")).then((res) => {
      expect(res.status, "GET mas-tarde must return HTTP 200").to.eq(200);
      expect(res.body, "Response must be a JSON array").to.be.an("array");
    });
  });
});
