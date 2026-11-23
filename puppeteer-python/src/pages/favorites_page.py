"""Page object for /favorites: the list overview and the detail view of one list.
Ready once the lists (or the empty state) are shown and the spinner is gone."""
from src.browser import Locator, TestId
from src.common.exceptions import ElementNotFoundException
from src.pages.base_page import BasePage


class FavoritesPage(BasePage):
    LIST_CARD = TestId.of("favorites-list-card")
    LIST_NAME = TestId.of("favorites-list-name")
    LIST_OPEN = TestId.of("favorites-list-open")
    RESTAURANT_CARD = TestId.of("restaurant-card")
    EMPTY_LISTS = TestId.of("favorites-empty")
    EMPTY_DETAIL = TestId.of("favorites-detail-empty")
    SEARCH = TestId.of("favorites-search")
    LOADING = TestId.of("favorites-loading")
    DETAIL_LOADING = TestId.of("favorites-detail-loading")

    async def _wait_ready(self) -> None:
        await self.locator(self.any_of(self.LIST_CARD, self.EMPTY_LISTS)).first().wait_for("visible")
        await self.wait_hidden(self.locator(self.LOADING))

    async def list_count(self) -> int:
        return await self.locator(self.LIST_CARD).count()

    async def open_list_at(self, index: int) -> None:
        count = await self.list_count()
        if not 0 <= index < count:
            raise ElementNotFoundException(f"Favorites list card not found at index: {index}")
        await self._open_list(self.locator(self.LIST_CARD).nth(index))

    async def open_list_by_name(self, name: str) -> None:
        """Opens the list whose name contains ``name`` (case-insensitive)."""
        cards = self.locator(self.LIST_CARD)
        for index in range(await cards.count()):
            card = cards.nth(index)
            if name.lower() in (await card.within(self.LIST_NAME).text()).lower():
                await self._open_list(card)
                return
        raise ElementNotFoundException(f"Favorites list card not found with name: {name}")

    async def _open_list(self, card: Locator) -> None:
        await card.within(self.LIST_OPEN).click()
        await self.locator(self.SEARCH).wait_for("visible")
        await self.wait_hidden(self.locator(self.DETAIL_LOADING))

    async def restaurant_count(self) -> int:
        return await self.locator(self.RESTAURANT_CARD).count()

    async def is_empty_state_visible(self) -> bool:
        return await self.is_visible(self.EMPTY_LISTS)

    async def is_detail_empty_state_visible(self) -> bool:
        return await self.is_visible(self.EMPTY_DETAIL)

    async def search_within(self, text: str) -> None:
        await self.fill(self.SEARCH, text)
