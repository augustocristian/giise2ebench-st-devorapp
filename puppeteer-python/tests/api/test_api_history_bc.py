"""API Base-Choice tests for the history module.

Cases covered:
  * BASE   - multiple history entries are returned by GET /history.
  * Case 2 - a fresh user has an empty history (0 entries).
  * Case 5 - exactly 1 history entry is returned with the correct fields.
  * Case 6 - deleting an entry removes it from the history list.
  * Case 3 - an entry has an accessed_at (timestamp) field populated.
"""
from src.common.base_api_class import BaseApiClass

PLACE_A = "MOCK_PLACE_101"
PLACE_B = "MOCK_PLACE_102"
PLACE_C = "MOCK_PLACE_103"


class TestApiHistoryBC(BaseApiClass):
    @classmethod
    def setup_class(cls) -> None:
        super().setup_class()
        ts = cls.unique()
        cls.register_and_login(cls.unique_username(ts), cls.unique_email(ts), "Test1234!")

    @classmethod
    def teardown_class(cls) -> None:
        cls.delete_test_user()
        super().teardown_class()

    # BASE: several entries returned

    def test_base_multiple_entries(self):
        """BASE - adding 3 history entries returns all 3 via GET /history."""
        for place in (PLACE_A, PLACE_B, PLACE_C):
            self.add_history(place)

        history = self.get_items(self.history_url(""))
        assert len(history) >= 3, "After adding 3 entries history must have at least 3 items (BASE)"

    # Case 2: empty history

    def test_case2_empty_history(self):
        """Case 2 - a fresh user with no history gets an empty items array."""
        ts = self.unique()
        password = "Test1234!"

        # Separate session so this user has no history at all
        with self.new_client(self.unique_username(ts), self.unique_email(ts), password) as client:
            response = client.get(self.history_url(""), headers={"Accept": "application/json"})
            assert len(response.json()["items"]) == 0, "A brand-new user must have an empty history"
            self.delete_client_user(client, password)

    # Case 5: exactly one entry

    def test_case5_single_entry(self):
        """Case 5 - adding 1 history entry returns it with id, place_id and accessed_at."""
        entry = self.post_json_object(self.history_url(""), self.place_payload(PLACE_A))

        assert entry["id"] > 0, "Entry id must be positive"
        assert entry["place_id"] == PLACE_A, "place_id must match"
        assert "accessed_at" in entry, "Entry must have an accessed_at timestamp field"

    # Case 6: deleting an entry removes it

    def test_case6_delete_entry(self):
        """Case 6 - deleting a history entry removes it from GET /history."""
        entry_id = self.add_history(PLACE_A)

        delete_status = self.delete(self.history_url(f"/{entry_id}"))
        assert delete_status == 204, "DELETE history entry must return HTTP 204"

        history = self.get_items(self.history_url(""))
        assert not any(entry["id"] == entry_id for entry in history), "Deleted entry must not appear in GET /history"

    # Case 3: accessed_at populated

    def test_case3_accessed_at(self):
        """Case 3 - each history entry has a non-null accessed_at field."""
        self.add_history(PLACE_B)

        history = self.get_items(self.history_url(""))
        assert len(history) > 0, "History must have at least 1 entry"

        entry = history[-1]
        assert "accessed_at" in entry, "Entry must have accessed_at field"
        assert entry["accessed_at"] is not None, "accessed_at must not be null"
