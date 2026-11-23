"""Browser tests for /favorites with mocked list endpoints (BASE, S2-S6).

Base-Choice coverage:
  * BASE - multiple lists, 0 restaurants, with search filter.
  * S2 - 0 lists created (empty state).
  * S3 - 1 list, 0 restaurants, with search filter.
  * S4 - multiple lists, 1 restaurant, with search filter.
  * S5 - multiple lists, multiple restaurants, with search filter.
  * S6 - multiple lists, 0 restaurants, no search filter.
"""
import time
from typing import Any

from src.common.base_logged_class import BaseLoggedClass
from src.pages.favorites_page import FavoritesPage
from src.pages.login_page import LoginPage
from src.pages.side_menu_page import SideMenuPage

PLACE_A = "MOCK_PLACE_101"
PLACE_B = "MOCK_PLACE_102"

# The frontend uses fetch, so the list endpoints are mocked by overriding window.fetch.
FAVORITES_MOCK_JS = """(lists, detail) => {
    const original = window.fetch;
    const json = (body) => Promise.resolve(new Response(JSON.stringify(body),
        { status: 200, headers: { 'Content-Type': 'application/json' } }));
    window.fetch = function (input, init) {
        if (typeof input === 'string') {
            if (input.includes('/api/v1/favorites/lists/')) return json(detail);
            if (input.includes('/api/v1/favorites/lists')) return json(lists);
        }
        return original(input, init);
    };
}"""


def mock_lists(count: int) -> list[dict[str, Any]]:
    return [{"id": i, "user_id": "uid", "name": f"List {i}", "icon": "Heart"} for i in range(1, count + 1)]


def mock_detail(list_id: int, list_name: str, restaurant_count: int) -> dict[str, Any]:
    place_ids = [PLACE_A, PLACE_B]
    names = ["Restaurant One", "Restaurant Two"]
    restaurants = [
        {
            "id": i + 1,
            "list_id": list_id,
            "place_id": place_ids[i % 2],
            "restaurant": {
                "id": place_ids[i % 2],
                "name": names[i % 2],
                "rating": 4.5,
                "user_ratings_total": 100,
                "address": f"Fake Street {i + 1}",
                "main_photo": None,
                "types": ["restaurant"],
            },
        }
        for i in range(restaurant_count)
    ]
    return {"list": {"id": list_id, "user_id": "uid", "name": list_name, "icon": "Heart"}, "restaurants": restaurants}


class TestFavoritesView(BaseLoggedClass):
    @classmethod
    def setup_class(cls) -> None:
        super().setup_class()
        ts = int(time.time() * 1000)
        cls.setup_test_user(f"favui{ts % 100000}", f"favui{ts}@devorapp.test", "Test1234!")

    @classmethod
    def teardown_class(cls) -> None:
        cls.teardown_test_user()
        super().teardown_class()

    async def _login_go_to_favorites_with_mock(self, lists: list, detail: dict) -> FavoritesPage:
        # Every call starts with a fresh page load (go_to_login), which drops the previous mock.
        await self.go_to_login()
        login = await LoginPage.create(self.page)
        await login.enter_identifier(self.test_email)
        await login.enter_password(self.test_password)
        await login.submit_login()

        await self.page.evaluate(FAVORITES_MOCK_JS, lists, detail)

        menu = await SideMenuPage.create(self.page)
        await menu.open()
        await menu.go_to("favorites")
        return await FavoritesPage.create(self.page)

    async def test_base_list_search(self):
        """BASE - several lists, 0 restaurants, with search."""
        favorites = await self._login_go_to_favorites_with_mock(mock_lists(2), mock_detail(1, "List 1", 0))

        assert await favorites.list_count() == 2, "2 lists must be visible"

        await favorites.open_list_by_name("List 1")
        assert await favorites.restaurant_count() == 0, "The list must be empty"

        await favorites.search_within("pizza")
        assert await favorites.restaurant_count() == 0, "The filtered list must stay empty"

    async def test_empty_cases(self):
        """S2, S3, S6 - empty states and search."""
        # S2: 0 lists -> empty state
        favorites = await self._login_go_to_favorites_with_mock([], {})
        assert await favorites.list_count() == 0, "S2: there must be 0 lists"
        assert await favorites.is_empty_state_visible(), "S2: the empty-state text must be visible"

        # S3: 1 list, 0 restaurants, with search
        favorites = await self._login_go_to_favorites_with_mock(mock_lists(1), mock_detail(1, "List 1", 0))
        assert await favorites.list_count() == 1, "S3: there must be 1 list"
        await favorites.open_list_by_name("List 1")
        await favorites.search_within("pizza")
        assert await favorites.restaurant_count() == 0, "S3: the filtered list must be empty"

        # S6: several lists, 0 restaurants, no search
        favorites = await self._login_go_to_favorites_with_mock(mock_lists(2), mock_detail(1, "List 1", 0))
        assert await favorites.list_count() == 2, "S6: there must be 2 lists"
        await favorites.open_list_by_name("List 1")
        assert await favorites.is_detail_empty_state_visible(), "S6: the empty-list text must be visible"
        assert await favorites.restaurant_count() == 0, "S6: there must be 0 restaurants"

    async def test_cases_with_restaurants(self):
        """S4, S5 - lists with restaurants and searches."""
        # S4: several lists, 1 restaurant, with search
        favorites = await self._login_go_to_favorites_with_mock(mock_lists(2), mock_detail(1, "List 1", 1))
        await favorites.open_list_by_name("List 1")
        assert await favorites.restaurant_count() == 1, "S4: there must be 1 restaurant initially"

        await favorites.search_within("One")
        assert await favorites.restaurant_count() == 1, "S4: there must still be 1 restaurant"

        await favorites.search_within("zzz_no_match")
        assert await favorites.restaurant_count() == 0, "S4: there must be 0 restaurants after a failed search"

        # S5: several lists, several restaurants, with search
        favorites = await self._login_go_to_favorites_with_mock(mock_lists(2), mock_detail(1, "List 1", 2))
        await favorites.open_list_by_name("List 1")
        assert await favorites.restaurant_count() == 2, "S5: there must be 2 restaurants initially"

        await favorites.search_within("Two")
        assert await favorites.restaurant_count() == 1, "S5: filtering by 'Two' must leave 1 restaurant"

        await favorites.search_within("zzz_no_match")
        assert await favorites.restaurant_count() == 0, "S5: there must be 0 restaurants after a failed search"
