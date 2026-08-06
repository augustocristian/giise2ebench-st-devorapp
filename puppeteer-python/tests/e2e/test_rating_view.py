"""Browser tests for the rating modal opened from the history page (BASE, S2-S14).

Base-Choice coverage:
  * BASE - all aspects at maximum with a comment: the submission succeeds.
  * S2, S5, S8, S11 - any single aspect at 0 stars disables the submit button.
  * S3, S4, S6, S7 - varying quality/price with the rest at maximum: succeeds.
  * S9, S10, S12, S13 - varying hygiene/service with the rest at maximum: succeeds.
  * S14 - an empty comment is accepted.
"""
import time

import pytest

from src.browser import TestId
from src.common.base_logged_class import BaseLoggedClass
from src.pages.history_page import HistoryPage
from src.pages.login_page import LoginPage

PLACE_ID = "MOCK_PLACE_101"

RATING_MODAL = TestId.of("rating-modal")
RATING_SUBMIT = TestId.of("rating-submit")
RATING_COMMENT = TestId.of("rating-comment")


class TestRatingView(BaseLoggedClass):
    @classmethod
    def setup_class(cls) -> None:
        super().setup_class()
        ts = int(time.time() * 1000)
        cls.setup_test_user(f"ratingui{ts % 100000}", f"ratingui{ts}@devorapp.test", "Test1234!")

    @classmethod
    def teardown_class(cls) -> None:
        cls.teardown_test_user()
        super().teardown_class()

    @pytest.fixture(autouse=True)
    def _history_entry(self) -> None:
        self.ensure_history_entry()

    def ensure_history_entry(self) -> None:
        """Leaves the place in the history with no rating, so the modal opens empty."""
        self.api_login()
        self.api_delete(f"{self.api_base}/api/v1/restaurants/{PLACE_ID}/rating")
        self.api_post(f"{self.api_base}/api/v1/history", {"place_id": PLACE_ID})

    async def _login_and_go_to_history(self) -> HistoryPage:
        await self.go_to_login()
        login = await LoginPage.create(self.page)
        await login.enter_identifier(self.test_email)
        await login.enter_password(self.test_password)
        await login.submit_login()
        return await self._reload_history()

    async def _reload_history(self) -> HistoryPage:
        await self.page.goto(f"{self.sut_url}/history")
        return await HistoryPage.create(self.page)

    async def _open_rating_modal(self, history: HistoryPage) -> None:
        await history.open_card_menu(0)
        await history.choose_menu_action("rate")
        await self.page.locator(RATING_MODAL).wait_for("visible")

    async def _select_stars(self, aspect: str, stars: int) -> None:
        if stars <= 0:
            return
        await self.page.locator(TestId.rating_star(aspect, stars)).click()

    async def _is_submit_enabled(self) -> bool:
        return await self.page.locator(RATING_SUBMIT).is_enabled()

    async def _fill_ratings(self, quality: int, price: int, hygiene: int, service: int, comment: str) -> None:
        await self._select_stars("quality", quality)
        await self._select_stars("price", price)
        await self._select_stars("hygiene", hygiene)
        await self._select_stars("service", service)
        await self.page.locator(RATING_COMMENT).fill(comment)

    async def _submit_rating_and_verify_success(self) -> None:
        await self.page.locator(RATING_SUBMIT).click()
        await self.page.locator(RATING_MODAL).wait_for("hidden")
        await self.page.locator(TestId.toast("success")).first().wait_for("visible")

    async def test_save_full_rating_base(self):
        """BASE - saves a rating with all aspects at maximum and a comment."""
        history = await self._login_and_go_to_history()
        await self._open_rating_modal(history)
        await self._fill_ratings(5, 5, 5, 5, "Excelente servicio y comida deliciosa")
        assert await self._is_submit_enabled(), "Submit button must be enabled when all aspects are rated"
        await self._submit_rating_and_verify_success()

    async def test_zero_stars_disable_submit_and_empty_comment_accepted(self):
        """S2, S5, S8, S11 zero stars disable submit; S14 an empty comment is accepted."""
        # S2: quality = 0
        history = await self._login_and_go_to_history()
        await self._open_rating_modal(history)
        await self._fill_ratings(0, 5, 5, 5, "Comment")
        assert not await self._is_submit_enabled(), "S2: submit must be disabled when quality has 0 stars"

        # S5: price = 0
        history = await self._reload_history()
        await self._open_rating_modal(history)
        await self._fill_ratings(5, 0, 5, 5, "Comment")
        assert not await self._is_submit_enabled(), "S5: submit must be disabled when price has 0 stars"

        # S8: hygiene = 0
        history = await self._reload_history()
        await self._open_rating_modal(history)
        await self._fill_ratings(5, 5, 0, 5, "Comment")
        assert not await self._is_submit_enabled(), "S8: submit must be disabled when hygiene has 0 stars"

        # S11: service = 0
        history = await self._reload_history()
        await self._open_rating_modal(history)
        await self._fill_ratings(5, 5, 5, 0, "Comment")
        assert not await self._is_submit_enabled(), "S11: submit must be disabled when service has 0 stars"

        # S14: empty comment is accepted
        history = await self._reload_history()
        await self._open_rating_modal(history)
        await self._fill_ratings(5, 5, 5, 5, "")
        assert await self._is_submit_enabled(), "S14: submit must be enabled even with an empty comment"
        await self._submit_rating_and_verify_success()

    async def test_variable_ratings(self):
        """S3, S4, S6, S7, S9, S10, S12, S13 - ratings with varying quality, price, hygiene and service."""
        # S3 & S7: quality = 1, price = 3 (rest at the base value 5)
        history = await self._login_and_go_to_history()
        await self._open_rating_modal(history)
        await self._fill_ratings(1, 3, 5, 5, "Comment")
        assert await self._is_submit_enabled(), "S3/S7: submit must be enabled"
        await self._submit_rating_and_verify_success()

        # S4 & S6: quality = 3, price = 1
        self.ensure_history_entry()
        history = await self._reload_history()
        await self._open_rating_modal(history)
        await self._fill_ratings(3, 1, 5, 5, "Comment")
        assert await self._is_submit_enabled(), "S4/S6: submit must be enabled"
        await self._submit_rating_and_verify_success()

        # S9 & S13: hygiene = 1, service = 3
        self.ensure_history_entry()
        history = await self._reload_history()
        await self._open_rating_modal(history)
        await self._fill_ratings(5, 5, 1, 3, "Comment")
        assert await self._is_submit_enabled(), "S9/S13: submit must be enabled"
        await self._submit_rating_and_verify_success()

        # S10 & S12: hygiene = 3, service = 1
        self.ensure_history_entry()
        history = await self._reload_history()
        await self._open_rating_modal(history)
        await self._fill_ratings(5, 5, 3, 1, "Comment")
        assert await self._is_submit_enabled(), "S10/S12: submit must be enabled"
        await self._submit_rating_and_verify_success()
