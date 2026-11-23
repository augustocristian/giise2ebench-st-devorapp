"""Page object for the side menu drawer, opened from the hamburger button on authenticated pages."""
from typing import Self

from src.browser import TestId
from src.pages.base_page import BasePage


class SideMenuPage(BasePage):
    HAMBURGER = TestId.of("side-menu-open")
    DRAWER = TestId.of("side-menu-drawer")

    async def open(self) -> Self:
        await self.click(self.HAMBURGER)
        await self.locator(self.DRAWER).wait_for("visible")
        return self

    async def is_open(self) -> bool:
        return await self.is_visible(self.DRAWER)

    async def go_to(self, entry: str) -> Self:
        """Clicks a menu entry: home, recommend, favorites, saved, history or ratings."""
        await self.click(TestId.side_menu(entry))
        return self

    async def click_theme(self, theme: str) -> Self:
        """Clicks the theme button: "light" or "dark"."""
        await self.click(TestId.of(f"theme-{theme}"))
        return self

    async def is_theme_active(self, theme: str) -> bool:
        return await self._is_active(TestId.of(f"theme-{theme}"))

    async def html_data_theme(self) -> str:
        return await self._html_attribute("data-theme")

    async def click_font_size(self, size: str) -> Self:
        """Clicks the font-size button: "S", "M" or "L"."""
        await self.click(TestId.of(f"font-size-{size.lower()}"))
        return self

    async def is_font_size_active(self, size: str) -> bool:
        return await self._is_active(TestId.of(f"font-size-{size.lower()}"))

    async def html_data_font_size(self) -> str:
        return await self._html_attribute("data-font-size")

    async def _html_attribute(self, name: str) -> str:
        # data-theme and data-font-size live on <html>, which has no test id.
        value = await self.page.evaluate("(name) => document.documentElement.getAttribute(name)", name)
        return value or ""

    async def _is_active(self, selector: str) -> bool:
        # The selected state is only exposed through the "active" class.
        classes = await self.locator(selector).attribute("class") or ""
        return "active" in classes.split()
