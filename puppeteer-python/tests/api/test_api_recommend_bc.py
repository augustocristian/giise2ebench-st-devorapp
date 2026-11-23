"""API Base-Choice tests for the recommendation search module.

Pure REST assertions against POST /recommendations/search.

Cases covered:
  * BASE  - search with categories + prices + location returns HTTP 200 with results array.
  * S2    - categories = [] (empty) -> HTTP 200 with results array.
  * S4    - prices = [] (empty) -> HTTP 200 with results array.
  * S6    - include_unconfirmed_price = false -> HTTP 200.
  * S7    - open_now = false -> HTTP 200.
  * S8    - using an alternative location -> HTTP 200.
  * S10   - results may be empty array (handled without error).
"""
from src.common.base_api_class import BaseApiClass

LOCATION_PREF = "Gijón, España"
LOCATION_ALT = "Barcelona, España"


class TestApiRecommendBC(BaseApiClass):
    @classmethod
    def setup_class(cls) -> None:
        super().setup_class()
        ts = cls.unique()
        cls.register_and_login(cls.unique_username(ts), cls.unique_email(ts), "Test1234!")

    @classmethod
    def teardown_class(cls) -> None:
        cls.delete_test_user()
        super().teardown_class()

    def test_base_search_base_filters(self):
        """BASE - search with categories, prices and location returns HTTP 200 with results array."""
        body = self.search_payload(
            ["mexican_restaurant", "italian_restaurant"],
            ["PRICE_LEVEL_MODERATE", "PRICE_LEVEL_EXPENSIVE"],
            True, LOCATION_PREF, 5,
        )

        result = self.post_json_object(self.recommendations_url("/search"), body)
        assert "results" in result, "Response must have a 'results' field"
        assert isinstance(result["results"], list), "'results' must be a JSON array"

    def test_s2_empty_categories(self):
        """S2 - empty categories list is accepted and returns HTTP 200."""
        body = self.search_payload([], ["PRICE_LEVEL_MODERATE"], True, LOCATION_PREF, 5)

        result = self.post_json_object(self.recommendations_url("/search"), body)
        assert "results" in result, "Empty categories must still return a 'results' array (S2)"

    def test_s4_empty_prices(self):
        """S4 - empty prices list is accepted and returns HTTP 200."""
        body = self.search_payload(["mexican_restaurant"], [], True, LOCATION_PREF, 5)

        result = self.post_json_object(self.recommendations_url("/search"), body)
        assert "results" in result, "Empty prices must still return a 'results' array (S4)"

    def test_s6_without_unconfirmed_price(self):
        """S6 - include_unconfirmed_price=false returns HTTP 200."""
        body = self.search_payload(
            ["mexican_restaurant", "italian_restaurant"],
            ["PRICE_LEVEL_MODERATE", "PRICE_LEVEL_EXPENSIVE"],
            False, LOCATION_PREF, 5,
        )

        result = self.post_json_object(self.recommendations_url("/search"), body)
        assert "results" in result, "include_unconfirmed_price=false must still return results array (S6)"

    def test_s7_not_open_now(self):
        """S7 - open_now=false is accepted and returns HTTP 200."""
        body = self.search_payload(
            ["mexican_restaurant"], ["PRICE_LEVEL_MODERATE"], True, LOCATION_PREF, 5, open_now=False,
        )

        result = self.post_json_object(self.recommendations_url("/search"), body)
        assert "results" in result, "open_now=false must return a 'results' array (S7)"

    def test_s8_alternative_location(self):
        """S8 - alternative location is accepted and returns HTTP 200."""
        body = self.search_payload(
            ["mexican_restaurant", "italian_restaurant"],
            ["PRICE_LEVEL_MODERATE", "PRICE_LEVEL_EXPENSIVE"],
            True, LOCATION_ALT, 5,
        )

        result = self.post_json_object(self.recommendations_url("/search"), body)
        assert "results" in result, "Alternative location must still return a 'results' array (S8)"

    def test_s10_empty_results(self):
        """S10 - search returning 0 results returns HTTP 200 with empty results array."""
        body = self.search_payload(
            ["some_very_obscure_cuisine_type_xyz"], [], False, "Lugar inexistente 99999", 1,
        )

        status = self.post_status(self.recommendations_url("/search"), body)
        assert status == 200, "Search with no matches must return HTTP 200"
