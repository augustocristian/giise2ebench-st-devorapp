// Save-for-later: add, list and remove entries.
import { api } from "../../support/commands/api";
import { useTestUser } from "../../support/commands/users";

describe("API - Mas Tarde", () => {
  const user = useTestUser("mtapi");
  // Unique per test so entries saved by other tests do not interfere.
  let placeId;

  beforeEach(() => {
    cy.apiLoginAs(user);
    placeId = `test_place_${Date.now()}`;
  });

  it("POST returns 201 with id, place_id and already_saved false", () => {
    api.masTarde.add(placeId).then((res) => {
      expect(res.status, "Adding to mas-tarde must return HTTP 201").to.eq(201);
      expect(res.body.id, "Entry id must be positive").to.be.above(0);
      expect(res.body.place_id, "place_id must echo the added place").to.eq(placeId);
      expect(res.body.already_saved, "First save must not be flagged as already saved").to.eq(false);
    });
  });

  it("POST twice for the same place returns already_saved true on the second call", () => {
    api.masTarde.add(placeId);
    api.masTarde.add(placeId).then((res) => {
      expect(res.body.already_saved, "Second save of the same place must be flagged").to.eq(true);
    });
  });

  it("DELETE an entry returns 204", () => {
    api.masTarde.add(placeId).then((added) => {
      api.masTarde.remove(added.body.id).its("status").should("eq", 204);
    });
  });

  it("GET returns 200 with a JSON array", () => {
    api.masTarde.list().then((res) => {
      expect(res.status, "Listing mas-tarde must return HTTP 200").to.eq(200);
      expect(res.body, "Response must be a JSON array").to.be.an("array");
    });
  });
});
