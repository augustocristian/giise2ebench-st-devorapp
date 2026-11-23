"""API Base-Choice tests for the favorites module.

Pure REST assertions using :class:`BaseApiClass`.

Cases covered:
  * BASE   - create list, add several restaurants, GET returns all.
  * Case 2 - GET empty list returns an empty restaurants array.
  * Case 3 - GET list with 1 restaurant returns an array of size 1.
  * Case 4 - GET all lists returns the created list.
  * Case 5 - DELETE restaurant removes it from the list detail.
  * Case 6 - DELETE list removes it from the user's collection.
"""
from src.common.base_api_class import BaseApiClass

PLACE_A = "MOCK_PLACE_101"
PLACE_B = "MOCK_PLACE_102"
PLACE_C = "MOCK_PLACE_103"


class TestApiFavoritesBC(BaseApiClass):
    @classmethod
    def setup_class(cls) -> None:
        super().setup_class()
        ts = cls.unique()
        cls.register_and_login(cls.unique_username(ts), cls.unique_email(ts), "Test1234!")

    @classmethod
    def teardown_class(cls) -> None:
        cls.delete_test_user()
        super().teardown_class()

    def setup_method(self) -> None:
        self.list_id = self.create_list(f"BCTest{self.unique()}")
        self.restaurants_path = f"/lists/{self.list_id}/restaurants"

    # BASE: several restaurants in one list

    def test_base_several_restaurants(self):
        """BASE - adding 3 restaurants to a list returns all 3 in the detail endpoint."""
        for place in (PLACE_A, PLACE_B, PLACE_C):
            self.post(self.favorites_url(self.restaurants_path), self.place_payload(place))

        detail = self.get_json_object(self.favorites_url(f"/lists/{self.list_id}"))

        assert len(detail["restaurants"]) == 3, "After adding 3 restaurants the detail must return exactly 3"

    # Case 2: empty list

    def test_case2_empty_list(self):
        """Case 2 - a new list has an empty restaurants array."""
        detail = self.get_json_object(self.favorites_url(f"/lists/{self.list_id}"))

        assert len(detail["restaurants"]) == 0, "A brand-new list must have 0 restaurants"

    # Case 3: one restaurant

    def test_case3_one_restaurant(self):
        """Case 3 - adding 1 restaurant returns a restaurants array of size 1."""
        self.post(self.favorites_url(self.restaurants_path), self.place_payload(PLACE_A))

        restaurants = self.get_json_object(self.favorites_url(f"/lists/{self.list_id}"))["restaurants"]

        assert len(restaurants) == 1, "After adding 1 restaurant the detail must return exactly 1"
        assert restaurants[0]["place_id"] == PLACE_A, "The place_id must match the added restaurant"

    # Case 4: GET /favorites/lists returns the user's lists

    def test_case4_get_lists(self):
        """Case 4 - GET /favorites/lists returns the created list."""
        lists = self.get_json_array(self.favorites_url("/lists"))

        assert len(lists) > 0, "The lists array must not be empty after creating a list"
        assert any(item["id"] == self.list_id for item in lists), (
            f"The created list id={self.list_id} must appear in GET /favorites/lists"
        )

    # Case 5: deleting a restaurant removes it from the detail

    def test_case5_delete_restaurant(self):
        """Case 5 - deleting a restaurant removes it from the list detail."""
        fav_id_a = self.add_favorite(self.list_id, PLACE_A)
        self.post(self.favorites_url(self.restaurants_path), self.place_payload(PLACE_B))

        delete_status = self.delete(self.favorites_url(f"{self.restaurants_path}/{fav_id_a}"))
        assert delete_status == 204, "DELETE favorite must return HTTP 204"

        restaurants = self.get_json_object(self.favorites_url(f"/lists/{self.list_id}"))["restaurants"]

        assert not self.contains_by_field(restaurants, "place_id", PLACE_A), (
            "Deleted restaurant (PLACE_A) must not appear in list detail"
        )
        assert self.contains_by_field(restaurants, "place_id", PLACE_B), (
            "Non-deleted restaurant (PLACE_B) must still appear"
        )

    # Case 6: deleting a list removes it from the collection

    def test_case6_delete_list(self):
        """Case 6 - deleting a list removes it from GET /favorites/lists."""
        status = self.delete(self.favorites_url(f"/lists/{self.list_id}"))
        assert status == 204, "DELETE list must return HTTP 204"

        lists = self.get_json_array(self.favorites_url("/lists"))
        assert not any(item["id"] == self.list_id for item in lists), (
            "Deleted list must not appear in GET /favorites/lists"
        )
