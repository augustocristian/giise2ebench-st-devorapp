"""Port of epigijon.devorapp.e2e.functional.tests.e2e.TestRecommendView.

Browser tests for the DevorApp recommendation search page
(``/recommend-restaurants``).

Adapts ``recommendation.spec.ts`` (Playwright) to Puppeteer + pytest. Unlike
the Playwright version (which mocks the backend), most of these tests call
the *real* backend API. Result counts are therefore not asserted to exact
numbers; instead we assert structural/functional behaviour. S10/S11 mock the
fetch response directly to pin down exact result counts.

Base-Choice coverage:
  * BASE — search with base filters (categories + prices + ubicación preferida) works.
  * S2 — no categories selected → request is still sent without error.
  * S4 — no price selected → request is still sent without error.
  * S6 — "Sin precio" unchecked → does not block search.
  * S7 — "Abierto ahora" unchecked → does not block search.
  * S8 — another valid location is chosen → search completes without error.
  * S9 — other-location selected but left empty → error message shown.
  * S10 — 0 results (mocked) → result count is 0.
  * S11 — 1 result (mocked) → result count is 1.
"""
import time

from src.common.base_logged_class import BaseLoggedClass, async_test
from src.common.by import By
from src.pages.login_page import LoginPage
from src.pages.recommend_page import RecommendPage
from src.utils import dom


class TestRecommendView(BaseLoggedClass):
    @classmethod
    def setUpClass(cls) -> None:
        super().setUpClass()
        ts = int(time.time() * 1000)
        cls.setup_test_user(f"recui{ts % 100000}", f"recui{ts}@devorapp.test", "Test1234!")

    @classmethod
    def tearDownClass(cls) -> None:
        cls.teardown_test_user()
        super().tearDownClass()

    async def _login_and_go_to_recommend(self) -> RecommendPage:
        """Logs in and navigates to /recommend-restaurants."""
        await self.go_to_login()
        login_page = await LoginPage.create(self.page, self.waiter)
        await login_page.enter_identifier(self.test_email)
        await login_page.enter_password(self.test_password)
        await login_page.submit_login()
        await self.page.goto(self.sut_url + "/recommend-restaurants")
        return await RecommendPage.create(self.page, self.waiter)

    async def _mock_search_results(self, results: list) -> None:
        await self.page.evaluate(
            """(results) => {
                window.originalFetch = window.fetch;
                window.fetch = function(input, init) {
                    if (typeof input === 'string' && input.includes('/api/recommendations/search')) {
                        return Promise.resolve(new Response(JSON.stringify({ results: results, next_page_token: null }),
                            { status: 200, headers: { 'Content-Type': 'application/json' } }));
                    }
                    return window.originalFetch(input, init);
                };
            }""",
            results,
        )

    async def _restore_fetch(self) -> None:
        await self.page.evaluate("() => { if (window.originalFetch) { window.fetch = window.originalFetch; } }")

    # ── 1. BASE + S8: búsqueda con filtros base (ubicación preferida y alternativa) ──

    @async_test
    async def test_base_busqueda_filtros_base_y_ubicacion_alternativa(self):
        """BASE — búsqueda con filtros base y ubicación preferida/alternativa (BASE, S8)."""
        # BASE: preferred location + multiple categories + multiple prices
        page = await self._login_and_go_to_recommend()
        await page.add_category("Mexicano", "Mexicano")
        await page.add_category("Italiano", "Italiano")
        await page.click_price("€")
        await page.click_price("€€")
        await page.set_include_no_price(True)
        await page.set_open_now(True)
        await page.select_preferred_location()
        await page.search()
        self.assertFalse(await page.has_error_message(), "BASE: search with base filters must not produce a validation error")

        # S8: alternate location (autocomplete mock needed)
        page = await self._login_and_go_to_recommend()
        await page.add_category("Mexicano", "Mexicano")
        await page.add_category("Italiano", "Italiano")
        await page.click_price("€")
        await page.click_price("€€")

        await self.inject_autocomplete_mock()
        await page.select_other_location("Barcelona, España")
        await self.trigger_autocomplete_place_changed()

        await page.search()
        self.assertFalse(await page.has_error_message(),
                          "S8: search with custom location and multiple filters must not produce an error")

    # ── 2. S2, S4, S6, S7: filtros opcionales sin categorías ni precio, booleanos en falso ──

    @async_test
    async def test_filtros_opcionales(self):
        """S2, S4, S6, S7 — búsqueda sin categorías ni precio y con booleanos en false."""
        # S2 + S4: no categories, no prices → search without frontend error
        page = await self._login_and_go_to_recommend()
        await page.select_preferred_location()
        await page.search()
        self.assertFalse(await page.has_error_message(), "S2/S4: searching without categories or prices must not block with an error")

        # S6 + S7: uncheck "sin precio" and "abierto ahora" — user is still logged in
        await self.page.goto(self.sut_url + "/recommend-restaurants")
        page = await RecommendPage.create(self.page, self.waiter)
        await page.add_category("Italiano", "Italiano")
        await page.set_include_no_price(False)
        await page.set_open_now(False)
        await page.select_preferred_location()
        await page.search()
        self.assertFalse(await page.has_error_message(), "S6/S7: unchecking boolean filters must not produce a validation error")

        # S3: 1 category, multiple prices
        await self.page.goto(self.sut_url + "/recommend-restaurants")
        page = await RecommendPage.create(self.page, self.waiter)
        await page.add_category("Mexicano", "Mexicano")
        await page.click_price("€")
        await page.click_price("€€")
        await page.select_preferred_location()
        await page.search()
        self.assertFalse(await page.has_error_message(), "S3: searching with 1 category and multiple prices must not produce an error")

        # S5: multiple categories, 1 price
        await self.page.goto(self.sut_url + "/recommend-restaurants")
        page = await RecommendPage.create(self.page, self.waiter)
        await page.add_category("Mexicano", "Mexicano")
        await page.add_category("Italiano", "Italiano")
        await page.click_price("€")
        await page.select_preferred_location()
        await page.search()
        self.assertFalse(await page.has_error_message(), "S5: searching with multiple categories and 1 price must not produce an error")

    # ── 3. S9: ubicación alternativa vacía → error de validación ─────────────

    @async_test
    async def test_s9_otra_ubicacion_vacia(self):
        """S9, S10, S11 — validación de otra ubicación vacía (S9), y control
        de resultados 0 (S10) y 1 (S11)."""
        # 1. S9: empty alternate location
        page_s9 = await self._login_and_go_to_recommend()
        await page_s9.add_category("Mexicano", "Mexicano")
        await page_s9.select_other_location("")  # empty location
        await page_s9.search()

        self.assertTrue(await page_s9.has_error_message(),
                         "Searching without a location when 'otra ubicación' is selected must show an error")
        error_message = (await page_s9.get_error_message()).lower()
        self.assertTrue("ubicación" in error_message or "localiz" in error_message,
                         "Error message must mention location")

        # 2. S10: 0 results (using fetch mock)
        await self.page.goto(self.sut_url + "/recommend-restaurants")
        page_s10 = await RecommendPage.create(self.page, self.waiter)
        await page_s10.add_category("Mexicano", "Mexicano")
        await page_s10.select_preferred_location()

        await self._mock_search_results([])
        await page_s10.search()
        await self.waiter.wait_until(
            lambda: self._result_count_equals(0), "S10: result count did not settle at 0"
        )
        self.assertEqual(0, await page_s10.get_result_count(), "S10: result count must be 0")
        await self._restore_fetch()

        # 3. S11: 1 result (using fetch mock)
        await self.page.goto(self.sut_url + "/recommend-restaurants")
        page_s11 = await RecommendPage.create(self.page, self.waiter)
        await page_s11.add_category("Mexicano", "Mexicano")
        await page_s11.select_preferred_location()

        await self._mock_search_results([{
            "id": "test_place_11", "name": "Restaurante S11", "rating": 4.0, "user_ratings_total": 10,
            "types": ["restaurant"], "address": "Calle 11", "main_photo": None, "summary": "S11", "open_now": True,
        }])
        await page_s11.search()
        await self.waiter.wait_until(
            lambda: self._result_count_equals(1), "S11: result count did not settle at 1"
        )
        self.assertEqual(1, await page_s11.get_result_count(), "S11: result count must be 1")
        await self._restore_fetch()

    async def _result_count_equals(self, expected: int) -> bool:
        cards = await dom.find_all(self.page, By.css(".suggestion-card"))
        return len(cards) == expected
