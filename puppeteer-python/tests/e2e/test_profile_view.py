"""Port of epigijon.devorapp.e2e.functional.tests.e2e.TestProfileView.

Browser tests for the DevorApp profile page (``/profile``).

Adapts ``profile.spec.ts`` (Playwright) to Puppeteer + pytest.

Base-Choice coverage:
  * BASE — profile data loads correctly and invalid location update is validated (Ubicación = Mal).
  * S2–S4 — save personal info (Nombre = Si, Apellidos = Si) and valid location update (Ubicación = Bien).
  * S5–S9 — email change validations and happy path.
  * S10–S16 — password change validations and happy path.
  * S17 — account deletion.
"""
import time

from src.common.base_logged_class import BaseLoggedClass, async_test
from src.common.by import By
from src.pages.login_page import LoginPage
from src.pages.profile_page import ProfilePage
from src.utils import dom


class TestProfileView(BaseLoggedClass):
    @classmethod
    def setUpClass(cls) -> None:
        super().setUpClass()
        ts = int(time.time() * 1000)
        cls.setup_test_user(f"profui{ts % 100000}", f"profui{ts}@devorapp.test", "Test1234!")

    @classmethod
    def tearDownClass(cls) -> None:
        cls.teardown_test_user()
        super().tearDownClass()

    async def _login_and_go_to_profile(self, email: str, password: str) -> ProfilePage:
        """Logs in and navigates to /profile."""
        await self.go_to_login()
        login_page = await LoginPage.create(self.page, self.waiter)
        await login_page.enter_identifier(email)
        await login_page.enter_password(password)
        await login_page.submit_login()
        await self.page.goto(self.sut_url + "/profile")
        page = await ProfilePage.create(self.page, self.waiter)
        await self.waiter.wait_for_text_in(By.css(".location-info-card"), "UITester", "Profile did not load")
        return page

    # ── 1. Carga inicial + Gestión de Información Personal y Ubicación (BASE, S2–S4) ──

    @async_test
    async def test_cargar_y_gestionar_informacion_personal_y_ubicacion(self):
        """BASE, S2, S3, S4 — el perfil permite cargar y gestionar la
        información personal y la ubicación."""
        ts = int(time.time() * 1000)
        local_email = f"personalui{ts}@devorapp.test"
        local_username = f"personalui{ts % 100000}"
        local_password = "Test1234!"
        self.register_user_api(local_username, local_email, local_password)

        page = await self._login_and_go_to_profile(local_email, local_password)

        # BASE: data is present
        personal_card_text = await page.get_card_text("Información Personal")
        location_card_text = await page.get_card_text("Ubicación Preferida")
        self.assertIn("UITester", personal_card_text, "BASE: personal card must contain name")
        self.assertIn("Test", personal_card_text, "BASE: personal card must contain surname")
        self.assertIn("Gijón", location_card_text, "BASE: location card must contain preferred location")

        await self.inject_autocomplete_mock()

        # Cancel personal edit restores original values
        await page.edit_personal_info()
        await page.fill_input_in_card("Información Personal", 0, "JuanModificado")
        await page.fill_input_in_card("Información Personal", 1, "PérezModificado")
        await page.cancel_personal_info()
        self.assertIn("UITester", await page.get_card_text("Información Personal"), "Cancel must restore original name")

        # S2 & S3: Save updated nombre/apellidos
        await page.edit_personal_info()
        await page.fill_input_in_card("Información Personal", 0, "Juan")
        await page.fill_input_in_card("Información Personal", 1, "Pérez")
        await page.save_personal_info()
        await self.waiter.wait_for_toast("success")
        self.assertTrue(await page.has_success_toast(), "S2/S3: success toast must appear")
        await page.dismiss_success_toast()
        personal_card_text = await page.get_card_text("Información Personal")
        self.assertIn("Juan", personal_card_text, "S2: card must contain updated name")
        self.assertIn("Pérez", personal_card_text, "S3: card must contain updated surname")

        # BASE: Type location manually without selecting → error (Ubicación = Mal)
        await page.click_button_in_card("Ubicación Preferida", "Cambiar")
        await page.fill_input_in_card("Ubicación Preferida", 0, "aifgauif")
        await page.click_button_in_card("Ubicación Preferida", "Guardar cambios")
        self.assertIn("Debes seleccionar una ubicación válida", await page.get_card_text("Ubicación Preferida"),
                       "BASE: manual-typed location must show inline error")

        # S4: Select location from autocomplete list (Ubicación = Bien)
        await page.fill_input_in_card("Ubicación Preferida", 0, "Barcelona, España")
        await self.trigger_autocomplete_place_changed()
        await page.click_button_in_card("Ubicación Preferida", "Guardar cambios")
        await self.waiter.wait_for_toast("success")
        self.assertTrue(await page.has_success_toast(), "S4: success toast must appear after updating location")
        await self.waiter.wait_for_text_in(
            By.xpath("//div[contains(@class,'location-info-card') and contains(.,'Ubicación Preferida')]"),
            "Barcelona, España",
            "Location card did not update to Barcelona, España",
        )

    # ── 2. Gestión de Correo y Contraseña (S5–S16) ───────────────────────────

    @async_test
    async def test_gestionar_correo_y_contrasena(self):
        """S5 a S16 — validación y cambio de correo electrónico y contraseña."""
        ts = int(time.time() * 1000)

        # ── Email section ────────────────────────────────────────────────────
        email_user_email = f"tempemail{ts}@devorapp.test"
        email_user_username = f"tempemail{ts % 100000}"
        email_user_password = "Password123!"
        self.register_user_api(email_user_username, email_user_email, email_user_password)

        page = await self._login_and_go_to_profile(email_user_email, email_user_password)
        await page.open_email_change()

        # S7 & S9: required attributes
        email_input = await dom.find(self.page, By.css("input[type='email']"))
        pass_input = await dom.find(self.page, By.id("email-password-input"))
        self.assertEqual("true", await dom.attr_of(self.page, email_input, "required"), "S7: email must be required")
        self.assertEqual("true", await dom.attr_of(self.page, pass_input, "required"), "S9: password must be required")

        # S5: invalid email format (HTML5 validation)
        await page.fill_new_email("invalidemail")
        await page.fill_email_password(email_user_password)
        await page.submit_email_change()
        is_invalid = await self.page.evaluate("(el) => !el.checkValidity()", email_input)
        self.assertTrue(is_invalid, "S5: HTML5 validity must fail for invalid email format")

        # S8: wrong password
        await page.fill_new_email(f"nuevo{ts}@correo.com")
        await page.fill_email_password("WrongPassword!")
        await page.submit_email_change()
        await self.waiter.wait_for_toast("error")
        self.assertTrue(await page.has_error_toast(), "S8: error toast must appear for wrong password")
        await page.dismiss_error_toast()

        # S6: email already in use
        await page.fill_new_email(self.test_email)
        await page.fill_email_password(email_user_password)
        await page.submit_email_change()
        await self.waiter.wait_for_toast("error")
        self.assertTrue(await page.has_error_toast(), "S6: error toast must appear for email in use")
        await page.dismiss_error_toast()

        # Happy path: successful email change
        new_email = f"newtempemail{ts}@devorapp.test"
        await page.fill_new_email(new_email)
        await page.fill_email_password(email_user_password)
        await page.submit_email_change()
        await self.waiter.wait_for_toast("success")
        self.assertTrue(await page.has_success_toast(), "Success toast must appear")
        self.assertIn("confirmación", await page.get_success_toast_text(), "Toast must mention confirmation")
        self.assertIn(email_user_email, await page.get_card_text("Correo Electrónico"),
                       "Card must still display original email")

        # ── Password section ─────────────────────────────────────────────────
        ts2 = int(time.time() * 1000)
        pass_user_email = f"temppass{ts2}@devorapp.test"
        pass_user_username = f"temppass{ts2 % 100000}"
        pass_user_password = "Password123!"
        self.register_user_api(pass_user_username, pass_user_email, pass_user_password)

        page = await self._login_and_go_to_profile(pass_user_email, pass_user_password)
        await page.open_password_change()

        # S11 & S12: required attributes
        current_pass_input = await dom.find(self.page, By.id("current-password-input"))
        new_pass_input = await dom.find(self.page, By.id("new-password-input"))
        self.assertEqual("true", await dom.attr_of(self.page, current_pass_input, "required"),
                          "S11: current pass must be required")
        self.assertEqual("true", await dom.attr_of(self.page, new_pass_input, "required"),
                          "S12: new pass must be required")

        # S13: password too short (7 chars)
        await page.fill_password_change(pass_user_password, "Short1!", "Short1!")
        await page.submit_password_change()
        await self.waiter.wait_for_toast("error")
        self.assertTrue(await page.has_error_toast(), "S13: error toast for short password")
        error_text = (await page.get_error_toast_text())
        self.assertTrue("8" in error_text or "caracteres" in error_text.lower(), "S13: message content")
        await page.dismiss_error_toast()

        # S15: no numbers in new password
        await page.fill_password_change(pass_user_password, "OnlyLettersPassword", "OnlyLettersPassword")
        await page.submit_password_change()
        await self.waiter.wait_for_toast("error")
        self.assertTrue(await page.has_error_toast(), "S15: error toast for no-number password")
        await page.dismiss_error_toast()

        # S16: no letters in new password
        await page.fill_password_change(pass_user_password, "1234567890", "1234567890")
        await page.submit_password_change()
        await self.waiter.wait_for_toast("error")
        self.assertTrue(await page.has_error_toast(), "S16: error toast for no-letter password")
        await page.dismiss_error_toast()

        # S10: wrong old password
        await page.fill_password_change("WrongPassword!", "NewPassword123!", "NewPassword123!")
        await page.submit_password_change()
        await self.waiter.wait_for_toast("error")
        self.assertTrue(await page.has_error_toast(), "S10: error toast for wrong old password")
        await page.dismiss_error_toast()

        # S14: successful password change (16-char new password)
        await page.fill_password_change(pass_user_password, "NewPassword12345!", "NewPassword12345!")
        await page.submit_password_change()
        await self.waiter.wait_for_toast("success")
        self.assertTrue(await page.has_success_toast(), "S14: success toast must appear")

    # ── 3. Eliminar Cuenta (S17) ──────────────────────────────────────────────

    @async_test
    async def test_eliminar_cuenta(self):
        """S17 — eliminación de cuenta tras validación de confirmación."""
        ts = int(time.time() * 1000)
        del_email = f"delui{ts}@devorapp.test"
        del_username = f"delui{ts % 100000}"
        del_password = "Delete1234!"

        self.register_user_api(del_username, del_email, del_password)

        page = await self._login_and_go_to_profile(del_email, del_password)
        await page.open_delete_account()

        self.assertFalse(await page.is_delete_button_enabled(),
                          "Delete button must be disabled before typing confirm phrase")

        await page.fill_delete_confirm("NO_CONFIRMAR")
        self.assertFalse(await page.is_delete_button_enabled(),
                          "Delete button must remain disabled with incorrect phrase")

        await page.fill_delete_confirm("CONFIRMAR")
        self.assertTrue(await page.is_delete_button_enabled(), "Delete button must be enabled with CONFIRMAR")

        await page.submit_delete_account()
        await self.waiter.wait_for_toast("success")

        self.assertTrue(await page.has_success_toast(), "A success toast must appear after account deletion")
        await self.waiter.wait_for_url_contains("/login", "URL did not redirect to /login after account deletion")
        self.assertIn("/login", self.page.url, "After deletion the user must be redirected to /login")
