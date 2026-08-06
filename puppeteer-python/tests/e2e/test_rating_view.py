"""Port of epigijon.devorapp.e2e.functional.tests.e2e.TestRatingView.

Browser tests for the DevorApp rating modal (accessed from the history page).

Base-Choice coverage:
  * BASE — all aspects rated at max with a comment → submission succeeds.
  * S2, S5, S8, S11 — any single aspect at 0 stars disables the submit button.
  * S3, S4, S6, S7 — variable calidad/precio ratings with the rest at max → succeeds.
  * S9, S10, S12, S13 — variable higiene/trato ratings with the rest at max → succeeds.
  * S14 — empty comment is accepted.
"""
import time

from src.common.base_logged_class import BaseLoggedClass, async_test
from src.common.by import By
from src.common.exceptions import ElementNotFoundException
from src.pages.history_page import HistoryPage
from src.pages.login_page import LoginPage
from src.utils import dom
from src.utils.click import click_locator

PLACE_ID = "ChIJN1t_tDeuEmsRUsoyG83frY4"

RATE_BTN = By.xpath("//button[contains(.,'Valorar restaurante')]")
VALUATION_CONTENT = By.css(".valuation-content")
ASPECT_ROWS = By.css(".aspect-row-premium")
SUBMIT_BTN = By.css("button.btn-submit-valuation")
COMMENT_TEXTAREA = By.css("textarea.textarea-premium")


class TestRatingView(BaseLoggedClass):
    @classmethod
    def setUpClass(cls) -> None:
        super().setUpClass()
        ts = int(time.time() * 1000)
        cls.setup_test_user(f"ratingui{ts % 100000}", f"ratingui{ts}@devorapp.test", "Test1234!")

    @classmethod
    def tearDownClass(cls) -> None:
        cls.teardown_test_user()
        super().tearDownClass()

    def setUp(self) -> None:
        super().setUp()
        self.run_async(self._ensure_historial_entry())

    async def _ensure_historial_entry(self) -> None:
        self.api_login()
        api_base = self.properties.get("LOCALHOST_URL", "http://localhost:8000")
        self.api_delete(f"{api_base}/api/valoraciones/{PLACE_ID}")
        self.api_post(f"{api_base}/api/historial", {"place_id": PLACE_ID})

    # ── Navigation helpers ───────────────────────────────────────────────────

    async def _login_and_go_to_history(self) -> HistoryPage:
        await self.go_to_login()
        login_page = await LoginPage.create(self.page, self.waiter)
        await login_page.enter_identifier(self.test_email)
        await login_page.enter_password(self.test_password)
        await login_page.submit_login()
        await self.page.goto(self.sut_url + "/history")
        return await HistoryPage.create(self.page, self.waiter)

    async def _open_rating_modal(self, page: HistoryPage) -> None:
        await page.open_card_menu(0)
        await self.waiter.wait_for_visible(RATE_BTN, "'Valorar restaurante' button did not appear")
        await click_locator(self.page, self.waiter, RATE_BTN, "rate-btn")
        await self.waiter.wait_for_visible(VALUATION_CONTENT, "Valuation modal did not appear")

    async def _select_stars(self, aspect: str, stars: int) -> None:
        if stars <= 0:
            return
        rows = await dom.find_all(self.page, ASPECT_ROWS)
        target = None
        for row in rows:
            text = (await dom.text_of(self.page, row)).lower()
            if aspect.lower() in text:
                target = row
                break
        if target is None:
            raise ElementNotFoundException(f"Aspect row not found: {aspect}")
        stars_container = await dom.find(target, By.xpath("./div[2]"))
        svgs = await dom.find_all(stars_container, By.tag("svg"))
        if stars <= len(svgs):
            await svgs[stars - 1].click()

    async def _is_submit_enabled(self) -> bool:
        buttons = await dom.find_all(self.page, SUBMIT_BTN)
        if not buttons:
            return False
        return await dom.is_enabled(self.page, buttons[0])

    async def _fill_ratings(self, calidad: int, precio: int, higiene: int, trato: int, comentario: str) -> None:
        await self._select_stars("calidad", calidad)
        await self._select_stars("precio", precio)
        await self._select_stars("higiene", higiene)
        await self._select_stars("trato", trato)
        textarea = await dom.find(self.page, COMMENT_TEXTAREA)
        await dom.clear_and_type(self.page, textarea, comentario)

    async def _submit_valuation_and_verify_success(self) -> None:
        await click_locator(self.page, self.waiter, SUBMIT_BTN, "submit-valuation")
        await self.waiter.wait_for_invisible(VALUATION_CONTENT, "Valuation modal did not close after submit")
        await self.waiter.wait_for_toast("success")
        toasts = await dom.find_all(self.page, By.css(".toast.success"))
        self.assertTrue(len(toasts) > 0, "A success toast must appear after a successful rating submission")

    # ── 1. BASE: todos los aspectos al máximo con comentario ────────────────

    @async_test
    async def test_guardar_valoracion_completa_base(self):
        """debe guardar la valoración con todos los aspectos al máximo y comentario (BASE)."""
        page = await self._login_and_go_to_history()
        await self._open_rating_modal(page)
        await self._fill_ratings(5, 5, 5, 5, "Excelente servicio y comida deliciosa")
        self.assertTrue(await self._is_submit_enabled(), "Submit button must be enabled when all aspects are rated")
        await self._submit_valuation_and_verify_success()

    # ── 2. S2, S5, S8, S11 + S14: 0 estrellas deshabilitan el botón; comentario vacío permitido ──

    @async_test
    async def test_validar_cero_estrellas_y_comentario_vacio(self):
        """debe deshabilitar envío con 0 estrellas en cualquier aspecto (S2,
        S5, S8, S11) y aceptar comentario vacío (S14)."""
        # S2: Calidad = 0
        page = await self._login_and_go_to_history()
        await self._open_rating_modal(page)
        await self._fill_ratings(0, 5, 5, 5, "Comentario")
        self.assertFalse(await self._is_submit_enabled(), "S2: submit must be disabled when calidad has 0 stars")

        # S5: Precio = 0
        await self.page.goto(self.sut_url + "/history")
        page = await HistoryPage.create(self.page, self.waiter)
        await self._open_rating_modal(page)
        await self._fill_ratings(5, 0, 5, 5, "Comentario")
        self.assertFalse(await self._is_submit_enabled(), "S5: submit must be disabled when precio has 0 stars")

        # S8: Higiene = 0
        await self.page.goto(self.sut_url + "/history")
        page = await HistoryPage.create(self.page, self.waiter)
        await self._open_rating_modal(page)
        await self._fill_ratings(5, 5, 0, 5, "Comentario")
        self.assertFalse(await self._is_submit_enabled(), "S8: submit must be disabled when higiene has 0 stars")

        # S11: Trato = 0
        await self.page.goto(self.sut_url + "/history")
        page = await HistoryPage.create(self.page, self.waiter)
        await self._open_rating_modal(page)
        await self._fill_ratings(5, 5, 5, 0, "Comentario")
        self.assertFalse(await self._is_submit_enabled(), "S11: submit must be disabled when trato has 0 stars")

        # S14: empty comment is accepted
        await self.page.goto(self.sut_url + "/history")
        page = await HistoryPage.create(self.page, self.waiter)
        await self._open_rating_modal(page)
        await self._fill_ratings(5, 5, 5, 5, "")
        self.assertTrue(await self._is_submit_enabled(), "S14: submit must be enabled even with empty comment")
        await self._submit_valuation_and_verify_success()

    # ── 3. S3, S4, S6, S7, S9, S10, S12, S13: puntuaciones variables ────────

    @async_test
    async def test_puntuaciones_variables(self):
        """debe guardar valoraciones con puntuaciones variables de calidad,
        precio, higiene y trato (S3, S4, S6, S7, S9, S10, S12, S13)."""
        # S3 & S7: Calidad = 1, Precio = 3 (resto base = 5)
        page = await self._login_and_go_to_history()
        await self._open_rating_modal(page)
        await self._fill_ratings(1, 3, 5, 5, "Comentario")
        self.assertTrue(await self._is_submit_enabled(), "S3/S7: submit must be enabled")
        await self._submit_valuation_and_verify_success()

        # S4 & S6: Calidad = 3, Precio = 1
        await self._ensure_historial_entry()
        await self.page.goto(self.sut_url + "/history")
        page = await HistoryPage.create(self.page, self.waiter)
        await self._open_rating_modal(page)
        await self._fill_ratings(3, 1, 5, 5, "Comentario")
        self.assertTrue(await self._is_submit_enabled(), "S4/S6: submit must be enabled")
        await self._submit_valuation_and_verify_success()

        # S9 & S13: Higiene = 1, Trato = 3
        await self._ensure_historial_entry()
        await self.page.goto(self.sut_url + "/history")
        page = await HistoryPage.create(self.page, self.waiter)
        await self._open_rating_modal(page)
        await self._fill_ratings(5, 5, 1, 3, "Comentario")
        self.assertTrue(await self._is_submit_enabled(), "S9/S13: submit must be enabled")
        await self._submit_valuation_and_verify_success()

        # S10 & S12: Higiene = 3, Trato = 1
        await self._ensure_historial_entry()
        await self.page.goto(self.sut_url + "/history")
        page = await HistoryPage.create(self.page, self.waiter)
        await self._open_rating_modal(page)
        await self._fill_ratings(5, 5, 3, 1, "Comentario")
        self.assertTrue(await self._is_submit_enabled(), "S10/S12: submit must be enabled")
        await self._submit_valuation_and_verify_success()
