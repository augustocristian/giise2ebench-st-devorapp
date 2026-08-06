"""API tests for the saved-for-later endpoints.

  * POST   /saved-for-later              - save a restaurant (HTTP 201)
  * GET    /saved-for-later              - paginated list (HTTP 200)
  * DELETE /saved-for-later/{entry_id}   - remove an entry (HTTP 204)

Each test uses a unique fake place_id so tests do not interfere.
"""
from src.common.base_api_class import BaseApiClass


class TestApiSavedForLater(BaseApiClass):
    @classmethod
    def setup_class(cls) -> None:
        super().setup_class()
        ts = cls.unique()
        cls.register_and_login(cls.unique_username(ts), cls.unique_email(ts), "Test1234!")

    @classmethod
    def teardown_class(cls) -> None:
        cls.delete_test_user()
        super().teardown_class()

    def test_add_to_saved(self):
        """POST /saved-for-later returns HTTP 201 with id and place_id."""
        place_id = f"test_place_{self.unique()}"

        result = self.post(self.saved_for_later_url(""), self.place_payload(place_id))
        assert result.status == 201, "Adding to saved-for-later must return HTTP 201"

        entry = result.json()
        assert entry["id"] > 0, "entry id must be positive"
        assert entry["place_id"] == place_id, "place_id must match"

    def test_add_same_restaurant_twice(self):
        """POST /saved-for-later twice for the same place returns already_saved true on the second call."""
        place_id = f"test_place_{self.unique()}"

        first = self.post_json_object(self.saved_for_later_url(""), self.place_payload(place_id))
        assert not first["already_saved"], "First add must have already_saved false"

        second = self.post_json_object(self.saved_for_later_url(""), self.place_payload(place_id))
        assert second["already_saved"], "Second add of the same place must have already_saved true"

    def test_delete_from_saved(self):
        """DELETE /saved-for-later/{entry_id} returns HTTP 204."""
        entry_id = self.add_saved_for_later(f"test_place_{self.unique()}")

        status = self.delete(self.saved_for_later_url(f"/{entry_id}"))
        assert status == 204, "DELETE saved-for-later entry must return HTTP 204"

    def test_get_saved(self):
        """GET /saved-for-later returns HTTP 200 with a paginated envelope."""
        result = self.send("GET", self.saved_for_later_url(""))
        assert result.status == 200, "GET saved-for-later must return HTTP 200"
        assert isinstance(result.json()["items"], list), "Response must be an envelope with an items array"
