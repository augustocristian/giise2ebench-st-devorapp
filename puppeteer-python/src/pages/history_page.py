"""Port of epigijon.devorapp.e2e.functional.pages.HistoryPage.

Page object for ``/history``.

The history page groups visited restaurants by month. Each group
(``.history-group-header``) can be expanded or collapsed; only the
most-recent group is expanded by default.
"""
from src.common.by import By
from src.common.exceptions import ElementNotFoundException
from src.pages.base_page import BasePage
from src.utils import dom
from src.utils.click import click_element


class HistoryPage(BasePage):
    GROUP_TITLES = By.css(".history-group-title")
    GROUP_HEADERS = By.css(".history-group-header")
    CARDS = By.css(".restaurant-compact-card")
    SEARCH_INPUT = By.css("input[placeholder='Buscar en historial...']")

    async def _wait_ready(self) -> None:
        await self.waiter.wait_for_history_page()
        await self.waiter.wait_for_invisible(
            By.css(".loading-spinner"), "History loading spinner did not disappear"
        )

    # ── Month groups ─────────────────────────────────────────────────────────

    async def get_group_count(self) -> int:
        return len(await dom.find_all(self.page, self.GROUP_TITLES))

    async def get_group_title_at(self, index: int) -> str:
        titles = await dom.find_all(self.page, self.GROUP_TITLES)
        if index >= len(titles):
            return ""
        return await dom.text_of(self.page, titles[index])

    async def is_group_visible(self, text: str) -> bool:
        titles = await dom.find_all(self.page, self.GROUP_TITLES)
        for title in titles:
            if text in (await dom.text_of(self.page, title)):
                return True
        return False

    async def toggle_group(self, month_text: str) -> "HistoryPage":
        """Clicks the group header whose title contains ``month_text`` to
        expand/collapse it (e.g. "MAYO 2026")."""
        headers = await dom.find_all(self.page, self.GROUP_HEADERS)
        target = None
        for header in headers:
            if month_text in (await dom.text_of(self.page, header)):
                target = header
                break
        if target is None:
            raise ElementNotFoundException(f"Group header not found: {month_text}")
        await click_element(self.page, self.waiter, target, f"group-header[{month_text}]")
        return self

    # ── Restaurant cards ─────────────────────────────────────────────────────

    async def get_card_count(self) -> int:
        return len(await dom.find_all(self.page, self.CARDS))

    async def get_card_name_at(self, index: int) -> str:
        cards = await dom.find_all(self.page, self.CARDS)
        if index >= len(cards):
            return ""
        names = await dom.find_all(cards[index], By.css(".compact-name"))
        if not names:
            return ""
        return await dom.text_of(self.page, names[0])

    async def open_card_menu(self, index: int) -> "HistoryPage":
        """Opens the three-dot menu of the card at ``index``. The first
        button inside the card is assumed to be the menu trigger."""
        cards = await dom.find_all(self.page, self.CARDS)
        if index >= len(cards):
            raise ElementNotFoundException(f"Card at index {index} not found")
        buttons = await dom.find_all(cards[index], By.tag("button"))
        if not buttons:
            raise ElementNotFoundException(f"No menu button found in card {index}")
        await click_element(self.page, self.waiter, buttons[0], f"card-menu[{index}]")
        return self

    # ── Search ───────────────────────────────────────────────────────────────

    async def search(self, query: str) -> "HistoryPage":
        await self.fill(self.SEARCH_INPUT, query)
        return self
