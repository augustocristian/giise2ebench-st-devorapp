"""Port of epigijon.devorapp.e2e.functional.tests.e2e.TestFavoritesView.

Browser tests for the DevorApp favorites page (``/favorites``).

Base-Choice coverage:
  * BASE — multiple lists, 0 restaurants, with search filter.
  * S2 — 0 lists created (empty state general).
  * S3 — 1 list, 0 restaurants, with search filter.
  * S4 — multiple lists, 1 restaurant, with search filter.
  * S5 — multiple lists, multiple restaurants, with search filter.
  * S6 — multiple lists, 0 restaurants, no search filter.
"""
import time

from src.common.base_logged_class import BaseLoggedClass, async_test
from src.common.by import By
from src.pages.favorites_page import FavoritesPage
from src.pages.login_page import LoginPage
from src.pages.side_menu_page import SideMenuPage
from src.utils.click import click_locator

PLACE_A = "ChIJN1t_tDeuEmsRUsoyG83frY4"
PLACE_B = "ChIJdd4hrwug2EcRmSrV3Vo6llI"

NAV_FAVORITOS = By.xpath("//button[contains(.,'Favoritos')]")


class TestFavoritesView(BaseLoggedClass):
    @classmethod
    def setUpClass(cls) -> None:
        super().setUpClass()
        ts = int(time.time() * 1000)
        cls.setup_test_user(f"favui{ts % 100000}", f"favui{ts}@devorapp.test", "Test1234!")

    @classmethod
    def tearDownClass(cls) -> None:
        cls.teardown_test_user()
        super().tearDownClass()

    # ── Fetch mocking helpers ────────────────────────────────────────────────

    async def _inject_favorites_mock(self, listas: list, detail: dict) -> None:
        await self.page.evaluate(
            """(listas, detail) => {
                window.mockFavoritesListas = listas;
                window.mockFavoritesDetail = detail;
                window.originalFetch = window.fetch;
                window.fetch = function(input, init) {
                    if (typeof input === 'string') {
                        if (input.includes('/api/favoritos/listas/')) {
                            return Promise.resolve(new Response(JSON.stringify(window.mockFavoritesDetail),
                                { status: 200, headers: { 'Content-Type': 'application/json' } }));
                        }
                        if (input.includes('/api/favoritos/listas')) {
                            return Promise.resolve(new Response(JSON.stringify(window.mockFavoritesListas),
                                { status: 200, headers: { 'Content-Type': 'application/json' } }));
                        }
                    }
                    return window.originalFetch(input, init);
                };
            }""",
            listas, detail,
        )

    async def _restore_fetch(self) -> None:
        await self.page.evaluate("() => { if (window.originalFetch) { window.fetch = window.originalFetch; } }")

    @staticmethod
    def _mock_listas(count: int) -> list:
        return [
            {"id": i, "user_id": "uid", "nombre": f"Lista {i}", "icono": "Heart"}
            for i in range(1, count + 1)
        ]

    @staticmethod
    def _mock_detail(list_id: int, list_name: str, restaurant_count: int) -> dict:
        place_ids = [PLACE_A, PLACE_B]
        names = ["Restaurante Uno", "Restaurante Dos"]
        restaurantes = []
        for i in range(restaurant_count):
            place_id = place_ids[i % len(place_ids)]
            name = names[i % len(names)]
            restaurantes.append({
                "id": i + 1,
                "lista_id": list_id,
                "place_id": place_id,
                "restaurant": {
                    "id": place_id,
                    "name": name,
                    "rating": 4.5,
                    "user_ratings_total": 100,
                    "address": f"Calle Falsa {i + 1}",
                    "main_photo": None,
                    "types": ["restaurant"],
                },
            })
        return {
            "lista": {"id": list_id, "user_id": "uid", "nombre": list_name, "icono": "Heart"},
            "restaurantes": restaurantes,
        }

    async def _login_go_home_and_inject_mock(self, listas: list, detail: dict) -> FavoritesPage:
        await self.go_to_login()
        login_page = await LoginPage.create(self.page, self.waiter)
        await login_page.enter_identifier(self.test_email)
        await login_page.enter_password(self.test_password)
        await login_page.submit_login()

        await self._inject_favorites_mock(listas, detail)

        menu = await SideMenuPage.create(self.page, self.waiter)
        await menu.open()
        await click_locator(self.page, self.waiter, NAV_FAVORITOS, "nav-favoritos")

        return await FavoritesPage.create(self.page, self.waiter)

    # ── 1. BASE: varias listas, 0 restaurantes, con búsqueda ────────────────

    @async_test
    async def test_base_busqueda_listas(self):
        """BASE — varias listas, 0 restaurantes, con búsqueda."""
        page = await self._login_go_home_and_inject_mock(self._mock_listas(2), self._mock_detail(1, "Lista 1", 0))
        try:
            self.assertEqual(2, await page.get_list_count(), "Debe haber 2 listas visibles")

            await page.open_list_by_name("Lista 1")
            self.assertEqual(0, await page.get_restaurant_count(), "La lista debe estar vacía")

            await page.search_within("pizza")
            self.assertEqual(0, await page.get_restaurant_count(), "La lista filtrada debe seguir vacía")
        finally:
            await self._restore_fetch()

    # ── 2. S2, S3 y S6: vacíos, listas unitarias/múltiples ───────────────────

    @async_test
    async def test_casos_vacio(self):
        """S2, S3, S6 — gestión de estados vacíos y búsqueda."""
        # S2: 0 listas -> empty state
        page_empty = await self._login_go_home_and_inject_mock([], {})
        try:
            self.assertEqual(0, await page_empty.get_list_count(), "S2: debe haber 0 listas")
            self.assertTrue(await page_empty.is_empty_state_visible(), "S2: el texto de estado vacío debe ser visible")
        finally:
            await self._restore_fetch()

        # S3: 1 lista, 0 restaurantes, con búsqueda
        page_s3 = await self._login_go_home_and_inject_mock(self._mock_listas(1), self._mock_detail(1, "Lista 1", 0))
        try:
            self.assertEqual(1, await page_s3.get_list_count(), "S3: debe haber 1 lista")
            await page_s3.open_list_by_name("Lista 1")
            await page_s3.search_within("pizza")
            self.assertEqual(0, await page_s3.get_restaurant_count(), "S3: la lista filtrada debe estar vacía")
        finally:
            await self._restore_fetch()

        # S6: varias listas, 0 restaurantes, sin búsqueda
        page_s6 = await self._login_go_home_and_inject_mock(self._mock_listas(2), self._mock_detail(1, "Lista 1", 0))
        try:
            self.assertEqual(2, await page_s6.get_list_count(), "S6: debe haber 2 listas")
            await page_s6.open_list_by_name("Lista 1")
            self.assertTrue(await page_s6.is_detail_empty_state_visible(), "S6: el texto de lista vacía debe ser visible")
            self.assertEqual(0, await page_s6.get_restaurant_count(), "S6: debe haber 0 restaurantes")
        finally:
            await self._restore_fetch()

    # ── 3. S4 y S5: listas con restaurantes y búsquedas ──────────────────────

    @async_test
    async def test_casos_con_restaurantes(self):
        """S4, S5 — listas con restaurantes y búsquedas."""
        # S4: varias listas, 1 restaurante, con búsqueda
        page_s4 = await self._login_go_home_and_inject_mock(self._mock_listas(2), self._mock_detail(1, "Lista 1", 1))
        try:
            await page_s4.open_list_by_name("Lista 1")
            self.assertEqual(1, await page_s4.get_restaurant_count(), "S4: debe haber 1 restaurante inicialmente")

            await page_s4.search_within("Uno")
            self.assertEqual(1, await page_s4.get_restaurant_count(), "S4: debe seguir habiendo 1 restaurante")

            await page_s4.search_within("zzz_no_match")
            self.assertEqual(0, await page_s4.get_restaurant_count(),
                              "S4: debe haber 0 restaurantes tras búsqueda fallida")
        finally:
            await self._restore_fetch()

        # S5: varias listas, varios restaurantes, con búsqueda
        page_s5 = await self._login_go_home_and_inject_mock(self._mock_listas(2), self._mock_detail(1, "Lista 1", 2))
        try:
            await page_s5.open_list_by_name("Lista 1")
            self.assertEqual(2, await page_s5.get_restaurant_count(), "S5: debe haber 2 restaurantes inicialmente")

            await page_s5.search_within("Dos")
            self.assertEqual(1, await page_s5.get_restaurant_count(),
                              "S5: debe haber 1 restaurante visible al filtrar por 'Dos'")

            await page_s5.search_within("zzz_no_match")
            self.assertEqual(0, await page_s5.get_restaurant_count(),
                              "S5: debe haber 0 restaurantes tras búsqueda fallida")
        finally:
            await self._restore_fetch()
