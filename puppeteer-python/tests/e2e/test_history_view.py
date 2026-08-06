"""Port of epigijon.devorapp.e2e.functional.tests.e2e.TestHistoryView.

Browser tests for the DevorApp history page (``/history``).

Adapts ``history.spec.ts`` (Playwright) to Puppeteer + pytest. History
entries are mocked via a fetch override so the browser tests can verify
grouping by month, card counts, and the search/filter behaviour.

Base-Choice coverage:
  * BASE — multiple months, multiple restaurants, no search filter.
  * S2 — empty history shows 0 groups and 0 cards.
  * S3 — 1 month with multiple restaurants.
  * S5 — exactly 1 restaurant in history.
  * S6 — search term filters cards and hides non-matching months.
"""
import time

from src.common.base_logged_class import BaseLoggedClass, async_test
from src.common.by import By
from src.pages.history_page import HistoryPage
from src.pages.login_page import LoginPage
from src.pages.side_menu_page import SideMenuPage
from src.utils.click import click_locator

PLACE_A = "ChIJN1t_tDeuEmsRUsoyG83frY4"
PLACE_B = "ChIJdd4hrwug2EcRmSrV3Vo6llI"

NAV_HISTORIAL = By.xpath("//button[contains(.,'Historial')]")


class TestHistoryView(BaseLoggedClass):
    @classmethod
    def setUpClass(cls) -> None:
        super().setUpClass()
        ts = int(time.time() * 1000)
        cls.setup_test_user(f"histui{ts % 100000}", f"histui{ts}@devorapp.test", "Test1234!")

    @classmethod
    def tearDownClass(cls) -> None:
        cls.teardown_test_user()
        super().tearDownClass()

    # ── Fetch mocking helpers ────────────────────────────────────────────────

    async def _inject_historial_mock(self, entries: list) -> None:
        await self.page.evaluate(
            """(entries) => {
                window.originalFetch = window.fetch;
                window.fetch = function(input, init) {
                    if (typeof input === 'string' && input.includes('/api/historial')) {
                        return Promise.resolve(new Response(JSON.stringify(entries),
                            { status: 200, headers: { 'Content-Type': 'application/json' } }));
                    }
                    return window.originalFetch(input, init);
                };
            }""",
            entries,
        )

    async def _restore_fetch(self) -> None:
        await self.page.evaluate("() => { if (window.originalFetch) { window.fetch = window.originalFetch; } }")

    @staticmethod
    def _mock_historial(date1: str, date2: str) -> list:
        return [
            {
                "id": 1, "user_id": "uid", "place_id": PLACE_A, "fecha_acceso": date1,
                "restaurant": {
                    "id": PLACE_A, "name": "Restaurante Uno", "rating": 4.5, "user_ratings_total": 100,
                    "types": ["restaurant"], "address": "Calle Falsa 123", "main_photo": None,
                    "summary": "Excelente", "open_now": True,
                },
            },
            {
                "id": 2, "user_id": "uid", "place_id": PLACE_B, "fecha_acceso": date2,
                "restaurant": {
                    "id": PLACE_B, "name": "Restaurante Dos", "rating": 4.0, "user_ratings_total": 50,
                    "types": ["restaurant"], "address": "Avenida Siempreviva 742", "main_photo": None,
                    "summary": "Agradable", "open_now": False,
                },
            },
        ]

    @staticmethod
    def _mock_single_entry(date: str) -> list:
        return [
            {
                "id": 1, "user_id": "uid", "place_id": PLACE_A, "fecha_acceso": date,
                "restaurant": {
                    "id": PLACE_A, "name": "Restaurante Uno", "rating": 4.5, "user_ratings_total": 100,
                    "types": ["restaurant"], "address": "Calle Falsa 123", "main_photo": None,
                    "summary": "Excelente", "open_now": True,
                },
            },
        ]

    async def _login_go_home_and_inject_mock(self, entries: list) -> HistoryPage:
        await self.go_to_login()
        login_page = await LoginPage.create(self.page, self.waiter)
        await login_page.enter_identifier(self.test_email)
        await login_page.enter_password(self.test_password)
        await login_page.submit_login()

        await self._inject_historial_mock(entries)

        menu = await SideMenuPage.create(self.page, self.waiter)
        await menu.open()
        await click_locator(self.page, self.waiter, NAV_HISTORIAL, "nav-historial")

        return await HistoryPage.create(self.page, self.waiter)

    # ── BASE: múltiples entradas en historial ────────────────────────────────

    @async_test
    async def test_base_multiples_entradas(self):
        """BASE — history page shows at least 1 group and multiple restaurant cards."""
        page = await self._login_go_home_and_inject_mock(
            self._mock_historial("2026-05-15T12:00:00Z", "2026-06-15T12:00:00Z")
        )
        try:
            self.assertEqual(2, await page.get_group_count(), "Debe haber 2 grupos")

            # Expand the second group (JUNIO 2026 is collapsed by default since
            # MAYO 2026 is index 0 in mock)
            await page.toggle_group("JUNIO 2026")

            self.assertEqual(2, await page.get_card_count(), "Debe haber 2 tarjetas de restaurante visibles")
        finally:
            await self._restore_fetch()

    # ── S2, S3 y S5 condensados: vacío, 1 mes varios restaurantes, 1 restaurante ──

    @async_test
    async def test_casos_vacio_y_unitario(self):
        """debe gestionar historial vacío (S2), con 1 restaurante (S5) y 1 mes con varios (S3)."""
        # S2: empty history
        page_empty = await self._login_go_home_and_inject_mock([])
        try:
            self.assertEqual(0, await page_empty.get_group_count(), "S2: debe haber 0 grupos")
            self.assertEqual(0, await page_empty.get_card_count(), "S2: debe haber 0 tarjetas")
        finally:
            await self._restore_fetch()

        # S5: exactly 1 restaurant entry
        page_one = await self._login_go_home_and_inject_mock(self._mock_single_entry("2026-05-15T12:00:00Z"))
        try:
            self.assertEqual(1, await page_one.get_group_count(), "S5: debe haber 1 grupo")
            self.assertEqual(1, await page_one.get_card_count(), "S5: debe haber 1 tarjeta")
        finally:
            await self._restore_fetch()

        # S3: 1 month with multiple restaurants
        page_same_month = await self._login_go_home_and_inject_mock(
            self._mock_historial("2026-05-15T12:00:00Z", "2026-05-20T12:00:00Z")
        )
        try:
            self.assertEqual(1, await page_same_month.get_group_count(), "S3: debe haber 1 grupo")
            self.assertEqual(2, await page_same_month.get_card_count(), "S3: debe haber 2 tarjetas")
        finally:
            await self._restore_fetch()

    # ── S6: búsqueda filtra por nombre ────────────────────────────────────────

    @async_test
    async def test_busqueda_filtros(self):
        """S6 — searching in history filters cards; a non-matching term shows 0 cards."""
        page = await self._login_go_home_and_inject_mock(
            self._mock_historial("2026-05-15T12:00:00Z", "2026-06-15T12:00:00Z")
        )
        try:
            await page.toggle_group("JUNIO 2026")
            self.assertEqual(2, await page.get_card_count(), "Debe haber 2 tarjetas inicialmente")

            await page.search("Uno")
            self.assertEqual(1, await page.get_group_count(), "Debe haber 1 grupo después de buscar 'Uno'")
            self.assertEqual(1, await page.get_card_count(), "Debe haber 1 tarjeta después de buscar 'Uno'")
            self.assertEqual("Restaurante Uno", await page.get_card_name_at(0),
                              "La tarjeta visible debe ser 'Restaurante Uno'")

            await page.search("zzz_nada_xyzzy_no_match")
            self.assertEqual(0, await page.get_group_count(), "Debe haber 0 grupos tras una búsqueda sin coincidencias")
            self.assertEqual(0, await page.get_card_count(), "Debe haber 0 tarjetas tras una búsqueda sin coincidencias")
        finally:
            await self._restore_fetch()
