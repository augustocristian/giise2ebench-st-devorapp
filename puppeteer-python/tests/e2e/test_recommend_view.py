"""Browser tests for /recommend-restaurants (BASE, S2-S11).

Most tests use the real backend, so result counts are only asserted where the
search endpoint is mocked (S10, S11).

Base-Choice coverage:
  * BASE - search with base filters (categories + prices + preferred location).
  * S2 / S4 - no categories / no price: the search still runs without an error.
  * S6 / S7 - "include places without price" / "open now" unchecked do not block the search.
  * S8 - another valid location completes without an error.
  * S9 - "other location" selected but left empty shows an error.
  * S10 - 0 results (mocked).
  * S11 - 1 result (mocked).
"""
import time
from typing import Any

from src.common.base_logged_class import BaseLoggedClass
from src.pages.login_page import LoginPage
from src.pages.recommend_page import RecommendPage

# Cuisine tag ids from the frontend tags.json
MEXICAN = "mexican_restaurant"
ITALIAN = "italian_restaurant"

SEARCH_MOCK_JS = """(results) => {
    const original = window.fetch;
    window.fetch = function (input, init) {
        if (typeof input === 'string' && input.includes('/api/v1/recommendations/search')) {
            return Promise.resolve(new Response(JSON.stringify({ results, next_page_token: null }),
                { status: 200, headers: { 'Content-Type': 'application/json' } }));
        }
        return original(input, init);
    };
}"""

RESULT_S11: dict[str, Any] = {
    "id": "test_place_11",
    "name": "Restaurant S11",
    "rating": 4.0,
    "user_ratings_total": 10,
    "types": ["restaurant"],
    "address": "Street 11",
    "main_photo": None,
    "summary": "S11",
    "open_now": True,
}


class TestRecommendView(BaseLoggedClass):
    @classmethod
    def setup_class(cls) -> None:
        super().setup_class()
        ts = int(time.time() * 1000)
        cls.setup_test_user(f"recui{ts % 100000}", f"recui{ts}@devorapp.test", "Test1234!")

    @classmethod
    def teardown_class(cls) -> None:
        cls.teardown_test_user()
        super().teardown_class()

    async def _login_and_go_to_recommend(self) -> RecommendPage:
        await self.go_to_login()
        login = await LoginPage.create(self.page)
        await login.enter_identifier(self.test_email)
        await login.enter_password(self.test_password)
        await login.submit_login()
        return await self._open_recommend()

    async def _open_recommend(self) -> RecommendPage:
        await self.page.goto(f"{self.sut_url}/recommend-restaurants")
        return await RecommendPage.create(self.page)

    async def test_base_search_with_base_filters_and_alternative_location(self):
        """BASE and S8 - search with base filters, preferred and alternative location."""
        # BASE: preferred location, several categories and prices
        recommend = await self._login_and_go_to_recommend()
        await recommend.add_category("Mexicano", MEXICAN)
        await recommend.add_category("Italiano", ITALIAN)
        await recommend.click_price(1)
        await recommend.click_price(2)
        await recommend.set_include_no_price(True)
        await recommend.set_open_now(True)
        await recommend.select_preferred_location()
        await recommend.search()
        assert not await recommend.has_error_message(), \
            "BASE: search with base filters must not produce a validation error"

        # S8: alternative location (needs the autocomplete mock)
        recommend = await self._login_and_go_to_recommend()
        await recommend.add_category("Mexicano", MEXICAN)
        await recommend.add_category("Italiano", ITALIAN)
        await recommend.click_price(1)
        await recommend.click_price(2)

        await self.inject_autocomplete_mock()
        await recommend.select_other_location("Barcelona, España")
        await self.trigger_autocomplete_place_changed()

        await recommend.search()
        assert not await recommend.has_error_message(), \
            "S8: search with a custom location and multiple filters must not produce an error"

    async def test_optional_filters(self):
        """S2-S7 - optional filters: no categories/prices, one category, one price, booleans off."""
        # S2 + S4: no categories, no prices -> no frontend error
        recommend = await self._login_and_go_to_recommend()
        await recommend.select_preferred_location()
        await recommend.search()
        assert not await recommend.has_error_message(), \
            "S2/S4: searching without categories or prices must not block with an error"

        # S6 + S7: uncheck "include no price" and "open now" (the user is still logged in)
        recommend = await self._open_recommend()
        await recommend.add_category("Italiano", ITALIAN)
        await recommend.set_include_no_price(False)
        await recommend.set_open_now(False)
        await recommend.select_preferred_location()
        await recommend.search()
        assert not await recommend.has_error_message(), \
            "S6/S7: unchecking boolean filters must not produce a validation error"

        # S3: 1 category, multiple prices
        recommend = await self._open_recommend()
        await recommend.add_category("Mexicano", MEXICAN)
        await recommend.click_price(1)
        await recommend.click_price(2)
        await recommend.select_preferred_location()
        await recommend.search()
        assert not await recommend.has_error_message(), \
            "S3: searching with 1 category and multiple prices must not produce an error"

        # S5: multiple categories, 1 price
        recommend = await self._open_recommend()
        await recommend.add_category("Mexicano", MEXICAN)
        await recommend.add_category("Italiano", ITALIAN)
        await recommend.click_price(1)
        await recommend.select_preferred_location()
        await recommend.search()
        assert not await recommend.has_error_message(), \
            "S5: searching with multiple categories and 1 price must not produce an error"

    async def test_empty_other_location_and_mocked_results(self):
        """S9 empty other location, S10 zero results, S11 one result."""
        # S9: empty alternative location
        recommend = await self._login_and_go_to_recommend()
        await recommend.add_category("Mexicano", MEXICAN)
        await recommend.select_other_location("")
        await recommend.search()

        assert await recommend.has_error_message(), \
            "Searching without a location when 'other location' is selected must show an error"
        message = (await recommend.error_message()).lower()
        assert "ubicación" in message or "localiz" in message, "Error message must mention the location"

        # S10: 0 results (fetch mock)
        recommend = await self._open_recommend()
        await recommend.add_category("Mexicano", MEXICAN)
        await recommend.select_preferred_location()
        await self.page.evaluate(SEARCH_MOCK_JS, [])
        await recommend.search()
        await recommend.wait_for_result_count(0)
        assert await recommend.result_count() == 0, "S10: result count must be 0"

        # S11: 1 result (fetch mock)
        recommend = await self._open_recommend()
        await recommend.add_category("Mexicano", MEXICAN)
        await recommend.select_preferred_location()
        await self.page.evaluate(SEARCH_MOCK_JS, [RESULT_S11])
        await recommend.search()
        await recommend.wait_for_result_count(1)
        assert await recommend.result_count() == 1, "S11: result count must be 1"
