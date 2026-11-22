// Save-for-later: add, list and remove entries.
import { api } from "../../support/commands/api";
import { useTestUser } from "../../support/commands/users";

describe("API - Saved For Later", () => {
  const user = useTestUser("mtapi");
  // Unique per test so entries saved by other tests do not interfere.
  let placeId;

  beforeEach(() => {
    cy.apiLoginAs(user);
    placeId = `test_place_${Date.now()}`;
  });

  it("POST returns 201 with id, place_id and already_saved false", () => {
    api.savedForLater.add(placeId).then((res) => {
      expect(res.status, "Adding to saved-for-later must return HTTP 201").to.eq(201);
      expect(res.body.id, "Entry id must be positive").to.be.above(0);
      expect(res.body.place_id, "place_id must echo the added place").to.eq(placeId);
      expect(res.body.already_saved, "First save must not be flagged as already saved").to.eq(false);
    });
  });

  it("POST twice for the same place returns already_saved true on the second call", () => {
    api.savedForLater.add(placeId);
    api.savedForLater.add(placeId).then((res) => {
      expect(res.status, "Re-saving an existing entry must return 200").to.eq(200);
      expect(res.body.already_saved, "Second save of the same place must be flagged").to.eq(true);
    });
  });

  it("DELETE an entry returns 204", () => {
    api.savedForLater.add(placeId).then((added) => {
      api.savedForLater.remove(added.body.id).its("status").should("eq", 204);
    });
  });

  it("GET returns 200 with the pagination envelope", () => {
    api.savedForLater.list().then((res) => {
      expect(res.status, "Listing saved-for-later must return HTTP 200").to.eq(200);
      expect(res.body.items, "Response must carry an items array").to.be.an("array");
      expect(res.body, "Response must carry the envelope fields").to.include.keys("total", "limit", "offset");
    });
  });
});
