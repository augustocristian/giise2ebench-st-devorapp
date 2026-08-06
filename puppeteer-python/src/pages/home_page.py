"""Port of epigijon.devorapp.e2e.functional.pages.HomePage.

Page object for ``/home``. ``create()`` waits until the URL contains
``/home`` and the top navigation bar is visible before returning.
"""
from src.common.by import By
from src.pages.base_page import BasePage


class HomePage(BasePage):
    TOP_BAR = By.css(".topbar, header, nav")

    async def _wait_ready(self) -> None:
        await self.waiter.wait_for_home_page()
        await self.waiter.wait_for_top_bar()

    async def is_top_bar_visible(self) -> bool:
        return await self.is_visible(self.TOP_BAR)

    async def get_current_url(self) -> str:
        return self.page.url
