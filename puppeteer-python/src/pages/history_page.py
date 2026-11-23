"""Page object for /history. Visited restaurants are grouped by month; each
group header expands or collapses its cards (only the most recent group starts
expanded)."""
from typing import Self

from src.browser import TestId
from src.common.exceptions import ElementNotFoundException
from src.pages.base_page import BasePage


class HistoryPage(BasePage):
    GROUP_TITLE = TestId.of("history-group-title")
    GROUP_HEADER = TestId.of("history-group-header")
    CARD = TestId.of("restaurant-card")
    CARD_NAME = TestId.of("restaurant-card-name")
    CARD_MENU = TestId.of("history-card-menu")
    SEARCH = TestId.of("history-search")
    LOADING = TestId.of("history-loading")

    async def _wait_ready(self) -> None:
        await self.locator(self.any_of(self.GROUP_TITLE, self.SEARCH)).first().wait_for("visible")
        await self.wait_hidden(self.locator(self.LOADING))

    async def group_count(self) -> int:
        return await self.locator(self.GROUP_TITLE).count()

    async def group_title_at(self, index: int) -> str:
        titles = self.locator(self.GROUP_TITLE)
        if index >= await titles.count():
            return ""
        return await titles.nth(index).text()

    async def is_group_visible(self, text: str) -> bool:
        titles = self.locator(self.GROUP_TITLE)
        return any(text in await titles.nth(i).text() for i in range(await titles.count()))

    async def toggle_group(self, month_text: str) -> Self:
        """Expands or collapses the group whose header contains ``month_text`` (e.g. "MAYO 2026")."""
        headers = self.locator(self.GROUP_HEADER)
        await headers.first().wait_for("visible")
        for index in range(await headers.count()):
            header = headers.nth(index)
            if month_text in await header.text():
                await header.click()
                return self
        raise ElementNotFoundException(f"History group header not found with text: {month_text}")

    async def card_count(self) -> int:
        return await self.locator(self.CARD).count()

    async def card_name_at(self, index: int) -> str:
        cards = self.locator(self.CARD)
        if index >= await cards.count():
            return ""
        return await self.text_or_empty(cards.nth(index).within(self.CARD_NAME))

    async def open_card_menu(self, index: int) -> Self:
        """Opens the three-dot menu of the card at ``index``."""
        cards = self.locator(self.CARD)
        if index >= await cards.count():
            raise ElementNotFoundException(f"Card at index {index} not found")
        await cards.nth(index).within(self.CARD_MENU).click()
        return self

    async def choose_menu_action(self, action: str) -> Self:
        """Clicks an entry of the open card menu: details, rechoose, favorite, rate or delete."""
        await self.click(TestId.history_menu(action))
        return self

    async def search(self, query: str) -> Self:
        await self.fill(self.SEARCH, query)
        return self
