"""Page object for /home: ready once the URL contains /home and the top bar is visible."""
from src.browser import TestId
from src.pages.base_page import BasePage


class HomePage(BasePage):
    TOP_BAR = TestId.of("topbar")

    async def _wait_ready(self) -> None:
        async def on_home() -> bool:
            return "/home" in await self.page.url()

        await self.wait_until(on_home, "the URL to contain /home")
        await self.locator(self.TOP_BAR).wait_for("visible")

    async def is_top_bar_visible(self) -> bool:
        return await self.is_visible(self.TOP_BAR)

    async def current_url(self) -> str:
        return await self.page.url()
