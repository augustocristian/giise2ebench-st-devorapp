"""Page object for /recommend-restaurants: the search form (cuisines, price
levels, toggles, location) and the results panel. Ready once the preferred
location name has loaded."""
from typing import Self

from src.browser import TestId
from src.pages.base_page import BasePage


class RecommendPage(BasePage):
    CATEGORY_INPUT = TestId.of("recommend-cuisine-input")
    SEARCH_BUTTON = TestId.of("recommend-submit")
    LOCATION_PREFERRED = TestId.of("recommend-location-preferred")
    LOCATION_OTHER = TestId.of("recommend-location-custom")
    LOCATION_INPUT = TestId.of("recommend-location-input")
    INCLUDE_NO_PRICE = TestId.of("recommend-include-no-price")
    OPEN_NOW = TestId.of("recommend-open-now")
    PREFERRED_NAME = TestId.of("recommend-preferred-location-name")

    RESULT_CARD = TestId.of("recommend-result-card")
    RESULTS_TITLE = TestId.of("recommend-results-title")
    ERROR = TestId.of("recommend-error")

    async def _wait_ready(self) -> None:
        await self.locator(self.SEARCH_BUTTON).wait_for("visible")
        await self.locator(self.PREFERRED_NAME).wait_for("visible")

        # The label shows "Desconocida" until the user's preferred location has loaded.
        async def location_loaded() -> bool:
            return "Desconocida" not in await self.locator(self.PREFERRED_NAME).text()

        await self.wait_until(location_loaded, "the preferred location to load")

    async def add_category(self, query: str, tag_id: str) -> Self:
        """Types ``query`` in the cuisine input and picks the dropdown option for
        ``tag_id`` (id from the frontend tags.json, e.g. mexican_restaurant)."""
        await self.click(self.CATEGORY_INPUT)
        await self.fill(self.CATEGORY_INPUT, query)
        await self.click(TestId.cuisine_option(tag_id))
        return self

    async def click_price(self, level: int) -> Self:
        """Clicks a price level, 1 (cheapest) to 4."""
        await self.click(TestId.price(level))
        return self

    async def set_include_no_price(self, checked: bool) -> Self:
        await self._set_checked(self.INCLUDE_NO_PRICE, checked)
        return self

    async def set_open_now(self, checked: bool) -> Self:
        await self._set_checked(self.OPEN_NOW, checked)
        return self

    async def _set_checked(self, selector: str, checked: bool) -> None:
        checkbox = self.locator(selector)
        if await checkbox.property("checked") != checked:
            await checkbox.click()

    async def select_preferred_location(self) -> Self:
        await self.click(self.LOCATION_PREFERRED)
        return self

    async def select_other_location(self, location: str) -> Self:
        """Selects the "other location" option and types a location."""
        await self.click(self.LOCATION_OTHER)
        await self.fill(self.LOCATION_INPUT, location)
        return self

    async def search(self) -> Self:
        await self.click(self.SEARCH_BUTTON)
        return self

    async def result_count(self) -> int:
        return await self.locator(self.RESULT_CARD).count()

    async def is_results_title_visible(self) -> bool:
        return await self.is_visible(self.RESULTS_TITLE)

    async def error_message(self) -> str:
        return await self.text_or_empty(self.locator(self.ERROR))

    async def has_error_message(self) -> bool:
        return await self.is_visible(self.ERROR)

    async def wait_for_result_count(self, count: int) -> None:
        """Waits until exactly ``count`` result cards are rendered."""
        await self.wait_for_count(self.locator(self.RESULT_CARD), count)
