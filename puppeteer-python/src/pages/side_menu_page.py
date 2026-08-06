"""Port of epigijon.devorapp.e2e.functional.pages.SideMenuPage.

Page object for the side menu drawer (accessible from ``/home`` and other
authenticated pages via the hamburger button).

The drawer contains:
  * Theme toggle group (Claro / Oscuro)
  * Font-size toggle group (S / M / L)
"""
from src.common.by import By
from src.common.exceptions import ElementNotFoundException
from src.pages.base_page import BasePage
from src.utils import dom
from src.utils.click import click_element

HAMBURGER = By.css("button[aria-label='Abrir menú']")
DRAWER = By.css(".sidemenu-drawer")
TOGGLE_GROUPS = By.css(".sidemenu-toggle-group")


class SideMenuPage(BasePage):
    async def _wait_ready(self) -> None:
        return None

    async def open(self) -> "SideMenuPage":
        """Clicks the hamburger button to open the side menu."""
        await self.click(HAMBURGER)
        await self.waiter.wait_for_side_menu_drawer()
        return self

    async def is_open(self) -> bool:
        return await self.is_visible(DRAWER)

    # ── Theme toggle ─────────────────────────────────────────────────────────

    async def _get_toggle_group(self, index: int):
        groups = await dom.find_all(self.page, TOGGLE_GROUPS)
        if index >= len(groups):
            raise ElementNotFoundException(f"Toggle group #{index} not found in side menu")
        return groups[index]

    async def click_theme(self, label: str) -> "SideMenuPage":
        """Clicks the theme button with the given label inside the first
        toggle group. ``label``: "Claro" or "Oscuro"."""
        group = await self._get_toggle_group(0)
        buttons = await dom.find_all(group, By.tag("button"))
        target = None
        for button in buttons:
            text = await dom.attr_of(self.page, button, "textContent")
            if label in text:
                target = button
                break
        if target is None:
            raise ElementNotFoundException(f"Theme button not found: {label}")
        await click_element(self.page, self.waiter, target, f"theme[{label}]")
        return self

    async def is_theme_active(self, label: str) -> bool:
        group = await self._get_toggle_group(0)
        buttons = await dom.find_all(group, By.tag("button"))
        for button in buttons:
            text = await dom.attr_of(self.page, button, "textContent")
            class_attr = await dom.attr_of(self.page, button, "class")
            if label in text and "active" in class_attr:
                return True
        return False

    async def get_html_data_theme(self) -> str:
        """Returns the ``data-theme`` attribute of the <html> element, or
        empty string if the attribute is absent."""
        value = await self.page.evaluate("() => document.documentElement.getAttribute('data-theme')")
        return value or ""

    # ── Font-size toggle ─────────────────────────────────────────────────────

    async def click_font_size(self, label: str) -> "SideMenuPage":
        """Clicks the font-size button with the given label inside the
        second toggle group. ``label``: "S", "M", or "L"."""
        group = await self._get_toggle_group(1)
        buttons = await dom.find_all(group, By.tag("button"))
        target = None
        for button in buttons:
            text = (await dom.attr_of(self.page, button, "textContent")).strip()
            if text == label:
                target = button
                break
        if target is None:
            raise ElementNotFoundException(f"Font-size button not found: {label}")
        await click_element(self.page, self.waiter, target, f"font-size[{label}]")
        return self

    async def is_font_size_active(self, label: str) -> bool:
        group = await self._get_toggle_group(1)
        buttons = await dom.find_all(group, By.tag("button"))
        for button in buttons:
            text = (await dom.attr_of(self.page, button, "textContent")).strip()
            class_attr = await dom.attr_of(self.page, button, "class")
            if text == label and "active" in class_attr:
                return True
        return False

    async def get_html_data_font_size(self) -> str:
        """Returns the ``data-font-size`` attribute of the <html> element,
        or empty string if absent."""
        value = await self.page.evaluate("() => document.documentElement.getAttribute('data-font-size')")
        return value or ""
