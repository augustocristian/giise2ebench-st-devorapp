"""Browser tests for /history with a mocked history endpoint (BASE, S2, S3, S5, S6).

The entries are mocked by overriding window.fetch to check the month grouping,
card counts and search.

Base-Choice coverage:
  * BASE - multiple months, multiple restaurants, no search filter.
  * S2 - empty history shows 0 groups and 0 cards.
  * S3 - 1 month with multiple restaurants.
  * S5 - exactly 1 restaurant in history.
  * S6 - a search term filters cards and hides non-matching months.
"""
import time
from typing import Any

from src.common.base_logged_class import BaseLoggedClass
from src.pages.history_page import HistoryPage
from src.pages.login_page import LoginPage
from src.pages.side_menu_page import SideMenuPage

PLACE_A = "MOCK_PLACE_101"
PLACE_B = "MOCK_PLACE_102"

# The history endpoint answers with the pagination envelope; the frontend fetches every page.
HISTORY_MOCK_JS = """(entries) => {
    const original = window.fetch;
    window.fetch = function (input, init) {
        if (typeof input === 'string' && input.includes('/api/v1/history')) {
            const body = { items: entries, total: entries.length, limit: 100, offset: 0 };
            return Promise.resolve(new Response(JSON.stringify(body),
                { status: 200, headers: { 'Content-Type': 'application/json' } }));
        }
        return original(input, init);
    };
}"""


def entry(entry_id: int, place_id: str, accessed_at: str, name: str, rating: float, total: int,
          address: str, summary: str, open_now: bool) -> dict[str, Any]:
    return {
        "id": entry_id,
        "user_id": "uid",
        "place_id": place_id,
        "accessed_at": accessed_at,
        "restaurant": {
            "id": place_id,
            "name": name,
            "rating": rating,
            "user_ratings_total": total,
            "types": ["restaurant"],
            "address": address,
            "main_photo": None,
            "summary": summary,
            "open_now": open_now,
        },
    }


def mock_history(date1: str, date2: str) -> list[dict[str, Any]]:
    return [
        entry(1, PLACE_A, date1, "Restaurant One", 4.5, 100, "Fake Street 123", "Excellent", True),
        entry(2, PLACE_B, date2, "Restaurant Two", 4.0, 50, "Evergreen Terrace 742", "Pleasant", False),
    ]


def single_mock_entry(date: str) -> list[dict[str, Any]]:
    return [entry(1, PLACE_A, date, "Restaurant One", 4.5, 100, "Fake Street 123", "Excellent", True)]


class TestHistoryView(BaseLoggedClass):
    @classmethod
    def setup_class(cls) -> None:
        super().setup_class()
        ts = int(time.time() * 1000)
        cls.setup_test_user(f"histui{ts % 100000}", f"histui{ts}@devorapp.test", "Test1234!")

    @classmethod
    def teardown_class(cls) -> None:
        cls.teardown_test_user()
        super().teardown_class()

    async def _login_go_to_history_with_mock(self, entries: list) -> HistoryPage:
        # Every call starts with a fresh page load (go_to_login), which drops the previous mock.
        await self.go_to_login()
        login = await LoginPage.create(self.page)
        await login.enter_identifier(self.test_email)
        await login.enter_password(self.test_password)
        await login.submit_login()

        await self.page.evaluate(HISTORY_MOCK_JS, entries)

        menu = await SideMenuPage.create(self.page)
        await menu.open()
        await menu.go_to("history")
        return await HistoryPage.create(self.page)

    async def test_base_multiple_entries(self):
        """BASE - the history page shows several month groups and multiple restaurant cards."""
        history = await self._login_go_to_history_with_mock(
            mock_history("2026-05-15T12:00:00Z", "2026-06-15T12:00:00Z"))

        assert await history.group_count() == 2, "There must be 2 groups"

        # JUNIO 2026 starts collapsed; expand it to see both cards.
        await history.toggle_group("JUNIO 2026")

        assert await history.card_count() == 2, "2 restaurant cards must be visible"

    async def test_empty_and_single_cases(self):
        """S2 empty history, S5 one restaurant, S3 one month with several."""
        # S2: empty history
        history = await self._login_go_to_history_with_mock([])
        assert await history.group_count() == 0, "S2: there must be 0 groups"
        assert await history.card_count() == 0, "S2: there must be 0 cards"

        # S5: exactly 1 restaurant entry
        history = await self._login_go_to_history_with_mock(single_mock_entry("2026-05-15T12:00:00Z"))
        assert await history.group_count() == 1, "S5: there must be 1 group"
        assert await history.card_count() == 1, "S5: there must be 1 card"

        # S3: 1 month with multiple restaurants
        history = await self._login_go_to_history_with_mock(
            mock_history("2026-05-15T12:00:00Z", "2026-05-20T12:00:00Z"))
        assert await history.group_count() == 1, "S3: there must be 1 group"
        assert await history.card_count() == 2, "S3: there must be 2 cards"

    async def test_search_filters(self):
        """S6 - searching in the history filters cards; a non-matching term shows 0 cards."""
        history = await self._login_go_to_history_with_mock(
            mock_history("2026-05-15T12:00:00Z", "2026-06-15T12:00:00Z"))

        await history.toggle_group("JUNIO 2026")
        assert await history.card_count() == 2, "There must be 2 cards initially"

        await history.search("One")
        assert await history.group_count() == 1, "There must be 1 group after searching 'One'"
        assert await history.card_count() == 1, "There must be 1 card after searching 'One'"
        assert await history.card_name_at(0) == "Restaurant One", "The visible card must be 'Restaurant One'"

        await history.search("zzz_nothing_xyzzy_no_match")
        assert await history.group_count() == 0, "There must be 0 groups after a search with no matches"
        assert await history.card_count() == 0, "There must be 0 cards after a search with no matches"
