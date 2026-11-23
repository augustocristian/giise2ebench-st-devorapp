"""Browser tests for the side menu drawer, opened from /home with the hamburger button.

Base-Choice coverage:
  * BASE / S2 - the light theme (BASE) sets data-theme='light'; the dark theme (S2) removes it.
    Font size M is active by default in both cases.
  * S3 / S4 - font sizes S and L are applied together with the light theme.
"""
import time

from src.common.base_logged_class import BaseLoggedClass
from src.pages.login_page import LoginPage
from src.pages.side_menu_page import SideMenuPage


class TestSideMenu(BaseLoggedClass):
    @classmethod
    def setup_class(cls) -> None:
        super().setup_class()
        ts = int(time.time() * 1000)
        cls.setup_test_user(f"menuui{ts % 100000}", f"menuui{ts}@devorapp.test", "Test1234!")

    @classmethod
    def teardown_class(cls) -> None:
        cls.teardown_test_user()
        super().teardown_class()

    async def _login_and_open_menu(self) -> SideMenuPage:
        """Logs in, lands on /home and opens the side menu."""
        await self.go_to_login()
        login = await LoginPage.create(self.page)
        await login.enter_identifier(self.test_email)
        await login.enter_password(self.test_password)
        await login.submit_login()
        menu = await SideMenuPage.create(self.page)
        return await menu.open()

    async def test_theme_selection(self):
        """BASE and S2 - light sets data-theme='light', dark removes it; font M is active by default."""
        menu = await self._login_and_open_menu()
        await menu.click_theme("light")

        assert await menu.is_theme_active("light"), "BASE: 'light' button must have the active class after clicking"
        assert not await menu.is_theme_active("dark"), "BASE: 'dark' button must not be active when 'light' is selected"
        assert await menu.html_data_theme() == "light", "BASE: <html> element must have data-theme='light'"
        assert await menu.is_font_size_active("M"), "BASE: M font size must be active by default"

        await menu.click_theme("dark")

        assert await menu.is_theme_active("dark"), "S2: 'dark' button must have the active class after clicking"
        assert not await menu.is_theme_active("light"), "S2: 'light' button must not be active"
        assert await menu.html_data_theme() == "", "S2: dark mode must have no data-theme attribute on <html>"

    async def test_font_size_selection(self):
        """S3 and S4 - font sizes S and L are applied with the light theme."""
        menu = await self._login_and_open_menu()
        await menu.click_theme("light")

        await menu.click_font_size("S")
        assert await menu.html_data_theme() == "light", "S3: data-theme must be 'light'"
        assert await menu.is_font_size_active("S"), "S3: 'S' font size button must be active"
        assert not await menu.is_font_size_active("M"), "S3: 'M' font size button must not be active"
        assert await menu.html_data_font_size() == "S", "S3: data-font-size must be 'S'"

        await menu.click_font_size("L")
        assert await menu.html_data_theme() == "light", "S4: data-theme must still be 'light'"
        assert await menu.is_font_size_active("L"), "S4: 'L' font size button must be active"
        assert not await menu.is_font_size_active("M"), "S4: 'M' font size button must not be active"
        assert await menu.html_data_font_size() == "L", "S4: data-font-size must be 'L'"
