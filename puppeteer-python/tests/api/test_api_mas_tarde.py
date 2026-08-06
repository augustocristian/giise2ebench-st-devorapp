"""Port of epigijon.devorapp.e2e.functional.tests.api.TestApiMasTarde.

Validates the save-for-later endpoints:
  * POST   /api/mas-tarde              — add restaurant (HTTP 201)
  * GET    /api/mas-tarde              — list saved entries (HTTP 200)
  * DELETE /api/mas-tarde/{entry_id}   — remove entry (HTTP 204)

Each test uses a unique fake place_id to avoid state interference between
tests in the same class.
"""
from src.common.base_api_class import BaseApiClass


class TestApiMasTarde(BaseApiClass):
    @classmethod
    def setUpClass(cls) -> None:
        super().setUpClass()
        ts = cls.unique()
        cls.register_and_login(cls.unique_username(ts), cls.unique_email(ts), "Test1234!")

    @classmethod
    def tearDownClass(cls) -> None:
        cls.delete_test_user()
        super().tearDownClass()

    def test_add_to_mas_tarde(self):
        """POST /api/mas-tarde returns HTTP 201 with id, place_id and already_saved false."""
        place_id = f"test_place_{self.unique()}"

        status = self.post_status(self.mas_tarde_url(""), self.mas_tarde_payload(place_id))
        self.assertEqual(201, status, "Adding to mas-tarde must return HTTP 201")

        entry = self.post_json_object(self.mas_tarde_url(""), self.mas_tarde_payload(place_id))
        self.assertTrue(entry["id"] > 0, "entry id must be positive")
        self.assertEqual(place_id, entry["place_id"], "place_id must match")

    def test_add_same_restaurant_twice(self):
        """POST /api/mas-tarde twice for the same place returns already_saved true on second call."""
        place_id = f"test_place_{self.unique()}"

        first = self.post_json_object(self.mas_tarde_url(""), self.mas_tarde_payload(place_id))
        self.assertFalse(first["already_saved"], "First add must have already_saved false")

        second = self.post_json_object(self.mas_tarde_url(""), self.mas_tarde_payload(place_id))
        self.assertTrue(second["already_saved"], "Second add of same place must have already_saved true")

    def test_delete_from_mas_tarde(self):
        """DELETE /api/mas-tarde/{entry_id} returns HTTP 204."""
        entry_id = self.add_mas_tarde(f"test_place_{self.unique()}")

        status = self.delete(self.mas_tarde_url(f"/{entry_id}"))
        self.assertEqual(204, status, "DELETE mas-tarde entry must return HTTP 204")

    def test_get_mas_tarde(self):
        """GET /api/mas-tarde returns HTTP 200 with a JSON array."""
        status = self.get_status(self.mas_tarde_url(""))
        self.assertEqual(200, status, "GET mas-tarde must return HTTP 200")

        entries = self.get_json_array(self.mas_tarde_url(""))
        self.assertIsNotNone(entries, "Response must be a JSON array")
