"""Port of epigijon.devorapp.e2e.functional.tests.e2e.TestSideMenu.

Browser tests for the DevorApp side menu drawer.

Adapts ``sidemenu.spec.ts`` (Playwright) to Puppeteer + pytest. The side
menu is accessed from ``/home`` via the hamburger button.

Base-Choice coverage:
  * BASE / S2 — tema claro (BASE) activa data-theme='light'; tema oscuro (S2)
    elimina el atributo. La letra M está activa por defecto en ambos casos.
  * S3 / S4   — letra S y letra L se aplican correctamente junto con tema claro.
"""
import time

from src.common.base_logged_class import BaseLoggedClass, async_test
from src.pages.login_page import LoginPage
from src.pages.side_menu_page import SideMenuPage


class TestSideMenu(BaseLoggedClass):
    @classmethod
    def setUpClass(cls) -> None:
        super().setUpClass()
        ts = int(time.time() * 1000)
        cls.setup_test_user(f"menuui{ts % 100000}", f"menuui{ts}@devorapp.test", "Test1234!")

    @classmethod
    def tearDownClass(cls) -> None:
        cls.teardown_test_user()
        super().tearDownClass()

    async def _login_and_open_menu(self) -> SideMenuPage:
        """Logs in, navigates to /home, and opens the side menu."""
        await self.go_to_login()
        login_page = await LoginPage.create(self.page, self.waiter)
        await login_page.enter_identifier(self.test_email)
        await login_page.enter_password(self.test_password)
        await login_page.submit_login()
        menu = await SideMenuPage.create(self.page, self.waiter)
        return await menu.open()

    # ── 1. BASE + S2: selección de tema (Claro y Oscuro) ────────────────────

    @async_test
    async def test_seleccion_tema(self):
        """BASE y S2 — el tema Claro activa data-theme='light' y el Oscuro lo
        elimina; letra M activa por defecto."""
        # BASE: tema Claro, letra M por defecto
        menu = await self._login_and_open_menu()
        await menu.click_theme("Claro")

        self.assertTrue(await menu.is_theme_active("Claro"),
                         "BASE: 'Claro' button must have the active class after clicking")
        self.assertFalse(await menu.is_theme_active("Oscuro"),
                          "BASE: 'Oscuro' button must not be active when 'Claro' is selected")
        self.assertEqual("light", await menu.get_html_data_theme(),
                          "BASE: <html> element must have data-theme='light'")
        self.assertTrue(await menu.is_font_size_active("M"), "BASE: M font-size must be active by default")

        # S2: tema Oscuro
        await menu.click_theme("Oscuro")

        self.assertTrue(await menu.is_theme_active("Oscuro"),
                         "S2: 'Oscuro' button must have the active class after clicking")
        self.assertFalse(await menu.is_theme_active("Claro"), "S2: 'Claro' button must not be active")
        self.assertEqual("", await menu.get_html_data_theme(),
                          "S2: dark mode must have no data-theme attribute on <html>")

    # ── 2. S3 + S4: selección de tamaño de letra (S y L) ────────────────────

    @async_test
    async def test_seleccion_tamano_letra(self):
        """S3 y S4 — la letra S y la letra L se aplican correctamente con tema Claro."""
        menu = await self._login_and_open_menu()
        await menu.click_theme("Claro")

        # S3: letra S
        await menu.click_font_size("S")
        self.assertEqual("light", await menu.get_html_data_theme(), "S3: data-theme must be 'light'")
        self.assertTrue(await menu.is_font_size_active("S"), "S3: 'S' font-size button must be active")
        self.assertFalse(await menu.is_font_size_active("M"), "S3: 'M' font-size button must not be active")
        self.assertEqual("S", await menu.get_html_data_font_size(), "S3: data-font-size must be 'S'")

        # S4: letra L
        await menu.click_font_size("L")
        self.assertEqual("light", await menu.get_html_data_theme(), "S4: data-theme must still be 'light'")
        self.assertTrue(await menu.is_font_size_active("L"), "S4: 'L' font-size button must be active")
        self.assertFalse(await menu.is_font_size_active("M"), "S4: 'M' font-size button must not be active")
        self.assertEqual("L", await menu.get_html_data_font_size(), "S4: data-font-size must be 'L'")
