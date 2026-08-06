"""Port of epigijon.devorapp.e2e.functional.pages.FavoritesPage.

Page object for the Favorites page (``/favorites``).
"""
from src.common.by import By
from src.common.exceptions import ElementNotFoundException
from src.pages.base_page import BasePage
from src.utils import dom
from src.utils.click import click_element


class FavoritesPage(BasePage):
    LIST_CARDS = By.css(".fav-list-card")
    RESTAURANT_CARDS = By.css(".restaurant-compact-card")
    EMPTY_LISTS_TEXT = By.xpath("//*[contains(text(), 'Aún no tienes listas')]")
    EMPTY_DETAIL_TEXT = By.xpath("//*[contains(text(), 'Esta lista está vacía')]")
    SEARCH_INPUT = By.css("input[placeholder='Buscar en esta lista...']")

    async def _wait_ready(self) -> None:
        await self.waiter.wait_for_favorites_page()
        await self.waiter.wait_for_invisible(
            By.css(".loading-spinner"), "Favorites page loading spinner did not disappear"
        )

    async def get_list_count(self) -> int:
        return len(await dom.find_all(self.page, self.LIST_CARDS))

    async def open_list_at(self, index: int) -> None:
        lists = await dom.find_all(self.page, self.LIST_CARDS)
        if index < 0 or index >= len(lists):
            raise ElementNotFoundException(f"Favorites list card not found at index: {index}")
        await click_element(self.page, self.waiter, lists[index], f"list-card[{index}]")
        await self.waiter.wait_for_visible(self.SEARCH_INPUT, "Search input in list detail did not appear")
        await self.waiter.wait_for_invisible(
            By.css(".fav-detail-view .loading-spinner"), "Detail loading spinner did not disappear"
        )

    async def open_list_by_name(self, name: str) -> None:
        lists = await dom.find_all(self.page, self.LIST_CARDS)
        target = None
        for element in lists:
            text = (await dom.text_of(self.page, element)).lower()
            if name.lower() in text:
                target = element
                break
        if target is None:
            raise ElementNotFoundException(f"Favorites list card not found with name: {name}")
        await click_element(self.page, self.waiter, target, f"list-card[{name}]")
        await self.waiter.wait_for_visible(self.SEARCH_INPUT, "Search input in list detail did not appear")
        await self.waiter.wait_for_invisible(
            By.css(".fav-detail-view .loading-spinner"), "Detail loading spinner did not disappear"
        )

    async def get_restaurant_count(self) -> int:
        return len(await dom.find_all(self.page, self.RESTAURANT_CARDS))

    async def is_empty_state_visible(self) -> bool:
        return await self.is_visible(self.EMPTY_LISTS_TEXT)

    async def is_detail_empty_state_visible(self) -> bool:
        return await self.is_visible(self.EMPTY_DETAIL_TEXT)

    async def search_within(self, text: str) -> None:
        await self.fill(self.SEARCH_INPUT, text)
