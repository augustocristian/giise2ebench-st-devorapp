"""Port of epigijon.devorapp.e2e.functional.tests.e2e.TestRegisterView.

Browser tests for the DevorApp registration flow.

Base-Choice coverage:
  * BASE — successful registration with valid 9-char password (S7 happy path).
  * S2–S10 — step-1 field validations (email, username, nombre, apellidos, password).
  * S11–S16 — step-2 validations (location required, backend password policy:
    no-letter, no-number) plus successful registration with a 16-character password.
"""
import time

from src.common.base_logged_class import BaseLoggedClass, async_test
from src.pages.register_page import RegisterPage

BASE_PASSWORD = "Segura123"
BASE_NOMBRE = "Ana"
BASE_APELLIDOS = "García"


class TestRegisterView(BaseLoggedClass):
    @classmethod
    def setUpClass(cls) -> None:
        super().setUpClass()
        ts = int(time.time() * 1000)
        cls.setup_test_user(f"dupuser{ts % 100000}", f"dup.email.{ts}@devorapp.test", BASE_PASSWORD)

    @classmethod
    def tearDownClass(cls) -> None:
        cls.teardown_test_user()
        super().tearDownClass()

    async def _fill_step1(self, reg: RegisterPage, email: str, username: str,
                           password: str, nombre: str, apellidos: str) -> None:
        await reg.enter_email(email)
        await reg.enter_username(username)
        await reg.enter_password(password)
        await reg.enter_nombre(nombre)
        await reg.enter_apellidos(apellidos)

    async def _get_error_message_with_wait(self, reg: RegisterPage) -> str:
        await self.waiter.wait_until(
            lambda: self._has_error_message(reg), "Register page error message never appeared"
        )
        return await reg.get_error_message()

    async def _has_error_message(self, reg: RegisterPage) -> bool:
        return (await reg.get_error_message()) != ""

    # ── 1. Registro Exitoso - Caso BASE (BASE) ───────────────────────────────

    @async_test
    async def test_registro_exitoso_base(self):
        """debe registrarse correctamente con datos válidos y redirigir a verifica correo (BASE)."""
        await self.page.goto(self.sut_url + "/register")
        reg = await RegisterPage.create(self.page, self.waiter)

        ts = int(time.time() * 1000)
        email = f"regbase{ts}@devorapp.test"
        password = BASE_PASSWORD
        self.register_email_for_cleanup(email, password)

        await self._fill_step1(reg, email, f"regbase{ts % 100000}", password, BASE_NOMBRE, BASE_APELLIDOS)
        # inject BEFORE step 2 mounts so the component finds window.google immediately
        await self.inject_autocomplete_mock()
        await reg.click_continue()
        await reg.wait_for_step2()

        self.assertTrue(await reg.is_on_step2(), "Must advance to step 2")

        await reg.enter_ubicacion("Madrid, España")
        await self.trigger_autocomplete_place_changed()
        await reg.click_submit()

        await self.waiter.wait_until(lambda: reg.is_verify_email_visible(), "Verification screen was never shown")
        self.assertTrue(await reg.is_verify_email_visible(), "Verification screen must be shown")

    # ── 2. Validaciones en Paso 1 (S2–S10) ───────────────────────────────────
    #    Condensa: correo vacío (S4), correo inválido (S2), correo en uso (S3),
    #              username vacío (S5), username en uso (S6),
    #              nombre vacío (S7), apellidos vacíos (S8),
    #              contraseña vacía (S9), contraseña corta (S10).

    @async_test
    async def test_validaciones_paso1(self):
        """debe validar todos los campos obligatorios en el paso 1 (S2–S10)."""
        ts = int(time.time() * 1000)
        valid_email = f"valid{ts}@devorapp.test"
        valid_username = f"valid{ts % 100000}"

        # S4: Correo vacío
        await self.page.goto(self.sut_url + "/register")
        reg = await RegisterPage.create(self.page, self.waiter)
        await self._fill_step1(reg, "", valid_username, BASE_PASSWORD, BASE_NOMBRE, BASE_APELLIDOS)
        await reg.click_continue()
        self.assertTrue(await reg.is_on_step1(), "S4: must stay on step 1")
        err_s4 = await self._get_error_message_with_wait(reg)
        self.assertTrue("email" in err_s4 or "obligatorio" in err_s4, "S4: email error")

        # S2: Correo inválido
        await self.page.goto(self.sut_url + "/register")
        reg = await RegisterPage.create(self.page, self.waiter)
        await self._fill_step1(reg, "correosinformato", valid_username, BASE_PASSWORD, BASE_NOMBRE, BASE_APELLIDOS)
        await reg.click_continue()
        self.assertTrue(await reg.is_on_step1(), "S2: must stay on step 1")
        err_s2 = await self._get_error_message_with_wait(reg)
        self.assertTrue("email" in err_s2 or "válido" in err_s2, "S2: invalid email error")

        # S3: Correo en uso
        await self.page.goto(self.sut_url + "/register")
        reg = await RegisterPage.create(self.page, self.waiter)
        await self._fill_step1(reg, self.test_email, valid_username, BASE_PASSWORD, BASE_NOMBRE, BASE_APELLIDOS)
        await reg.click_continue()
        await self.waiter.wait_until(lambda: self._has_email_error(reg), "S3: email-in-use error never appeared")
        self.assertIn("registrado", await reg.get_email_error(), "S3: email in use error")

        # S5: Nombre de usuario vacío
        await self.page.goto(self.sut_url + "/register")
        reg = await RegisterPage.create(self.page, self.waiter)
        await self._fill_step1(reg, valid_email, "", BASE_PASSWORD, BASE_NOMBRE, BASE_APELLIDOS)
        await reg.click_continue()
        self.assertTrue(await reg.is_on_step1(), "S5: must stay on step 1")
        err_s5 = await self._get_error_message_with_wait(reg)
        self.assertTrue("usuario" in err_s5 or "obligatorio" in err_s5, "S5: username error")

        # S6: Nombre de usuario en uso
        await self.page.goto(self.sut_url + "/register")
        reg = await RegisterPage.create(self.page, self.waiter)
        await self._fill_step1(reg, valid_email, self.test_username, BASE_PASSWORD, BASE_NOMBRE, BASE_APELLIDOS)
        await reg.click_continue()
        await self.waiter.wait_until(lambda: self._has_username_error(reg), "S6: username-in-use error never appeared")
        self.assertIn("uso", await reg.get_username_error(), "S6: username in use error")

        # S7: Nombre vacío
        await self.page.goto(self.sut_url + "/register")
        reg = await RegisterPage.create(self.page, self.waiter)
        await self._fill_step1(reg, valid_email, valid_username, BASE_PASSWORD, "", BASE_APELLIDOS)
        await reg.click_continue()
        self.assertTrue(await reg.is_on_step1(), "S7: must stay on step 1")
        err_s7 = await self._get_error_message_with_wait(reg)
        self.assertIn("nombre", err_s7, "S7: nombre error")

        # S8: Apellidos vacíos
        await self.page.goto(self.sut_url + "/register")
        reg = await RegisterPage.create(self.page, self.waiter)
        await self._fill_step1(reg, valid_email, valid_username, BASE_PASSWORD, BASE_NOMBRE, "")
        await reg.click_continue()
        self.assertTrue(await reg.is_on_step1(), "S8: must stay on step 1")
        # The UI may say "apellidos", "obligatorio", "requerido", etc. — just check any error is shown
        err_s8 = await self._get_error_message_with_wait(reg)
        self.assertNotEqual("", err_s8, "S8: apellidos error must be shown")

        # S9: Contraseña vacía
        await self.page.goto(self.sut_url + "/register")
        reg = await RegisterPage.create(self.page, self.waiter)
        await self._fill_step1(reg, valid_email, valid_username, "", BASE_NOMBRE, BASE_APELLIDOS)
        await reg.click_continue()
        self.assertTrue(await reg.is_on_step1(), "S9: must stay on step 1")
        err_s9 = await self._get_error_message_with_wait(reg)
        self.assertTrue("contraseña" in err_s9 or "obligatoria" in err_s9, "S9: password empty error")

        # S10: Contraseña corta (6 chars)
        await self.page.goto(self.sut_url + "/register")
        reg = await RegisterPage.create(self.page, self.waiter)
        await self._fill_step1(reg, valid_email, valid_username, "Seg123", BASE_NOMBRE, BASE_APELLIDOS)
        await reg.click_continue()
        self.assertTrue(await reg.is_on_step1(), "S10: must stay on step 1")
        err_s10 = await self._get_error_message_with_wait(reg)
        self.assertTrue("8" in err_s10 or "caracteres" in err_s10, "S10: short password error")

    async def _has_email_error(self, reg: RegisterPage) -> bool:
        return (await reg.get_email_error()) != ""

    async def _has_username_error(self, reg: RegisterPage) -> bool:
        return (await reg.get_username_error()) != ""

    # ── 3. Validaciones de Paso 2 y Registro con Contraseña Larga (S11–S16) ──
    #    Condensa: ubicación vacía (S16), ubicación manual (S15),
    #              contraseña sin letras backend (S13), sin números backend (S12),
    #              registro exitoso con contraseña larga (S11).

    @async_test
    async def test_validaciones_paso2_y_password_larga(self):
        """debe validar ubicación, política de contraseña backend (S12, S13,
        S15, S16) y registro exitoso con contraseña larga (S11)."""
        ts = int(time.time() * 1000)

        # S16: Ubicación vacía
        await self.page.goto(self.sut_url + "/register")
        reg = await RegisterPage.create(self.page, self.waiter)
        await self._fill_step1(reg, f"regloc1{ts}@devorapp.test", f"reglocone{ts % 10000}", "12345678",
                                BASE_NOMBRE, BASE_APELLIDOS)
        await reg.click_continue()
        await reg.wait_for_step2()
        await reg.click_submit()
        self.assertTrue(await reg.is_on_step2(), "S16: must stay on step 2")
        err_s16 = await self._get_error_message_with_wait(reg)
        self.assertTrue("ubicación" in err_s16 or "lista" in err_s16, "S16: location empty error")

        # S15: Ubicación manual no seleccionada
        await self.page.goto(self.sut_url + "/register")
        reg = await RegisterPage.create(self.page, self.waiter)
        await self._fill_step1(reg, f"regloc2{ts}@devorapp.test", f"regloctwo{ts % 10000}", "12345678",
                                BASE_NOMBRE, BASE_APELLIDOS)
        await reg.click_continue()
        await reg.wait_for_step2()
        await reg.enter_ubicacion("Ubicación No Válida")
        await reg.click_submit()
        self.assertTrue(await reg.is_on_step2(), "S15: must stay on step 2")
        err_s15 = await self._get_error_message_with_wait(reg)
        self.assertTrue("ubicación" in err_s15 or "lista" in err_s15, "S15: manual location error")

        # S13: Contraseña sin letras (error del backend)
        await self.page.goto(self.sut_url + "/register")
        reg = await RegisterPage.create(self.page, self.waiter)
        await self._fill_step1(reg, f"regloc3{ts}@devorapp.test", f"reglocthree{ts % 10000}", "12345678",
                                BASE_NOMBRE, BASE_APELLIDOS)
        # inject BEFORE step 2 mounts so the component finds window.google immediately
        await self.inject_autocomplete_mock()
        await reg.click_continue()
        await reg.wait_for_step2()
        await reg.enter_ubicacion("Gijón, España")
        await self.trigger_autocomplete_place_changed()
        await reg.click_submit()
        err_s13 = (await self._get_error_message_with_wait(reg)).lower()
        self.assertTrue("letra" in err_s13 or "contraseña" in err_s13 or "password" in err_s13,
                         "S13: no-letter password backend error")

        # S12: Contraseña sin números (error del backend)
        await self.page.goto(self.sut_url + "/register")
        reg = await RegisterPage.create(self.page, self.waiter)
        await self._fill_step1(reg, f"regloc4{ts}@devorapp.test", f"reglocfour{ts % 10000}", "PasswordNoNum",
                                BASE_NOMBRE, BASE_APELLIDOS)
        await self.inject_autocomplete_mock()  # inject BEFORE step 2 mounts
        await reg.click_continue()
        await reg.wait_for_step2()
        await reg.enter_ubicacion("Gijón, España")
        await self.trigger_autocomplete_place_changed()
        await reg.click_submit()
        err_s12 = (await self._get_error_message_with_wait(reg)).lower()
        self.assertTrue("número" in err_s12 or "number" in err_s12 or "contraseña" in err_s12 or "password" in err_s12,
                         "S12: no-number password backend error")

        # S11: Registro exitoso con contraseña larga (16 chars)
        await self.page.goto(self.sut_url + "/register")
        reg = await RegisterPage.create(self.page, self.waiter)
        ts2 = int(time.time() * 1000)
        email_s11 = f"reglong{ts2}@devorapp.test"
        password_s11 = "Segura1234567890"
        self.register_email_for_cleanup(email_s11, password_s11)

        await self._fill_step1(reg, email_s11, f"reglong{ts2 % 100000}", password_s11, BASE_NOMBRE, BASE_APELLIDOS)
        # inject BEFORE step 2 mounts so the component finds window.google immediately
        await self.inject_autocomplete_mock()
        await reg.click_continue()
        await reg.wait_for_step2()

        self.assertTrue(await reg.is_on_step2(), "S11: must advance to step 2")

        await reg.enter_ubicacion("Madrid, España")
        await self.trigger_autocomplete_place_changed()
        await reg.click_submit()

        await self.waiter.wait_until(lambda: reg.is_verify_email_visible(), "S11: verification screen was never shown")
        self.assertTrue(await reg.is_verify_email_visible(), "S11: verification screen must be shown")
