"""Browser tests for the registration flow (BASE, S2-S16).

Base-Choice coverage:
  * BASE - successful registration with a valid 9-character password.
  * S2-S10 - step 1 field validations (email, username, first name, last name, password).
  * S11-S16 - step 2 validations (location required, backend password policy: no letter,
    no number) plus a successful registration with a 16-character password.
"""
import time

from src.common.base_logged_class import BaseLoggedClass
from src.pages.register_page import RegisterPage

BASE_PASSWORD = "Segura123"
BASE_FIRST_NAME = "Ana"
BASE_LAST_NAME = "García"


def _now_ms() -> int:
    return int(time.time() * 1000)


class TestRegisterView(BaseLoggedClass):
    @classmethod
    def setup_class(cls) -> None:
        super().setup_class()
        ts = _now_ms()
        cls.setup_test_user(f"dupuser{ts % 100000}", f"dup.email.{ts}@devorapp.test", BASE_PASSWORD)

    @classmethod
    def teardown_class(cls) -> None:
        cls.teardown_test_user()
        super().teardown_class()

    async def _open_register(self) -> RegisterPage:
        await self.page.goto(f"{self.sut_url}/register")
        return await RegisterPage.create(self.page)

    @staticmethod
    async def _fill_step1(reg: RegisterPage, email: str, username: str, password: str,
                          first_name: str, last_name: str) -> None:
        await reg.enter_email(email)
        await reg.enter_username(username)
        await reg.enter_password(password)
        await reg.enter_first_name(first_name)
        await reg.enter_last_name(last_name)

    async def _register_through_step2(self, reg: RegisterPage, location: str) -> None:
        """Continues to step 2, picks a location from the (mocked) autocomplete and submits."""
        # Inject before step 2 mounts so the component finds window.google right away.
        await self.inject_autocomplete_mock()
        await reg.click_continue()
        await reg.wait_for_step2()
        await reg.enter_location(location)
        await self.trigger_autocomplete_place_changed()
        await reg.click_submit()

    async def test_successful_registration_base(self):
        """BASE - registers with valid data and shows the verify-email screen."""
        reg = await self._open_register()
        ts = _now_ms()
        email = f"regbase{ts}@devorapp.test"
        self.register_email_for_cleanup(email, BASE_PASSWORD)

        await self._fill_step1(reg, email, f"regbase{ts % 100000}", BASE_PASSWORD, BASE_FIRST_NAME, BASE_LAST_NAME)
        await self._register_through_step2(reg, "Madrid, España")

        await reg.wait_for_verify_email()
        assert await reg.is_verify_email_visible(), "Verification screen must be shown"

    async def test_step1_validations(self):
        """S2-S10 - validates all required fields in step 1."""
        ts = _now_ms()
        valid_email = f"valid{ts}@devorapp.test"
        valid_username = f"valid{ts % 100000}"

        # S4: empty email
        reg = await self._open_register()
        await self._fill_step1(reg, "", valid_username, BASE_PASSWORD, BASE_FIRST_NAME, BASE_LAST_NAME)
        await reg.click_continue()
        assert await reg.is_on_step1(), "S4: must stay on step 1"
        error = await reg.wait_for_error_message()
        assert "email" in error or "obligatorio" in error, "S4: email error"

        # S2: invalid email
        reg = await self._open_register()
        await self._fill_step1(reg, "correosinformato", valid_username, BASE_PASSWORD, BASE_FIRST_NAME,
                               BASE_LAST_NAME)
        await reg.click_continue()
        assert await reg.is_on_step1(), "S2: must stay on step 1"
        error = await reg.wait_for_error_message()
        assert "email" in error or "válido" in error, "S2: invalid email error"

        # S3: email already in use
        reg = await self._open_register()
        await self._fill_step1(reg, self.test_email, valid_username, BASE_PASSWORD, BASE_FIRST_NAME, BASE_LAST_NAME)
        await reg.click_continue()
        error = await reg.wait_for_field_error(RegisterPage.EMAIL_ERROR)
        assert "registrado" in error, "S3: email in use error"

        # S5: empty username
        reg = await self._open_register()
        await self._fill_step1(reg, valid_email, "", BASE_PASSWORD, BASE_FIRST_NAME, BASE_LAST_NAME)
        await reg.click_continue()
        assert await reg.is_on_step1(), "S5: must stay on step 1"
        error = await reg.wait_for_error_message()
        assert "usuario" in error or "obligatorio" in error, "S5: username error"

        # S6: username already in use
        reg = await self._open_register()
        await self._fill_step1(reg, valid_email, self.test_username, BASE_PASSWORD, BASE_FIRST_NAME, BASE_LAST_NAME)
        await reg.click_continue()
        error = await reg.wait_for_field_error(RegisterPage.USERNAME_ERROR)
        assert "uso" in error, "S6: username in use error"

        # S7: empty first name
        reg = await self._open_register()
        await self._fill_step1(reg, valid_email, valid_username, BASE_PASSWORD, "", BASE_LAST_NAME)
        await reg.click_continue()
        assert await reg.is_on_step1(), "S7: must stay on step 1"
        error = await reg.wait_for_error_message()
        assert "nombre" in error, "S7: first name error"

        # S8: empty last name
        reg = await self._open_register()
        await self._fill_step1(reg, valid_email, valid_username, BASE_PASSWORD, BASE_FIRST_NAME, "")
        await reg.click_continue()
        assert await reg.is_on_step1(), "S8: must stay on step 1"
        # The wording varies, so only check that some error is shown.
        assert await reg.wait_for_error_message(), "S8: last name error must be shown"

        # S9: empty password
        reg = await self._open_register()
        await self._fill_step1(reg, valid_email, valid_username, "", BASE_FIRST_NAME, BASE_LAST_NAME)
        await reg.click_continue()
        assert await reg.is_on_step1(), "S9: must stay on step 1"
        error = await reg.wait_for_error_message()
        assert "contraseña" in error or "obligatoria" in error, "S9: empty password error"

        # S10: short password (6 characters)
        reg = await self._open_register()
        await self._fill_step1(reg, valid_email, valid_username, "Seg123", BASE_FIRST_NAME, BASE_LAST_NAME)
        await reg.click_continue()
        assert await reg.is_on_step1(), "S10: must stay on step 1"
        error = await reg.wait_for_error_message()
        assert "8" in error or "caracteres" in error, "S10: short password error"

    async def test_step2_validations_and_long_password(self):
        """S15, S16 location, S12, S13 backend password policy, S11 long password."""
        ts = _now_ms()

        # S16: empty location
        reg = await self._open_register()
        await self._fill_step1(reg, f"regloc1{ts}@devorapp.test", f"reglocone{ts % 10000}", "12345678",
                               BASE_FIRST_NAME, BASE_LAST_NAME)
        await reg.click_continue()
        await reg.wait_for_step2()
        await reg.click_submit()
        assert await reg.is_on_step2(), "S16: must stay on step 2"
        error = await reg.wait_for_error_message()
        assert "ubicación" in error or "lista" in error, "S16: location empty error"

        # S15: manually typed location, not picked from the list
        reg = await self._open_register()
        await self._fill_step1(reg, f"regloc2{ts}@devorapp.test", f"regloctwo{ts % 10000}", "12345678",
                               BASE_FIRST_NAME, BASE_LAST_NAME)
        await reg.click_continue()
        await reg.wait_for_step2()
        await reg.enter_location("Ubicación No Válida")
        await reg.click_submit()
        assert await reg.is_on_step2(), "S15: must stay on step 2"
        error = await reg.wait_for_error_message()
        assert "ubicación" in error or "lista" in error, "S15: manual location error"

        # S13: password without letters (backend error)
        reg = await self._open_register()
        await self._fill_step1(reg, f"regloc3{ts}@devorapp.test", f"reglocthree{ts % 10000}", "12345678",
                               BASE_FIRST_NAME, BASE_LAST_NAME)
        await self._register_through_step2(reg, "Gijón, España")
        error = (await reg.wait_for_error_message()).lower()
        assert any(word in error for word in ("letra", "contraseña", "password")), \
            "S13: no-letter password backend error"

        # S12: password without numbers (backend error)
        reg = await self._open_register()
        await self._fill_step1(reg, f"regloc4{ts}@devorapp.test", f"reglocfour{ts % 10000}", "PasswordNoNum",
                               BASE_FIRST_NAME, BASE_LAST_NAME)
        await self._register_through_step2(reg, "Gijón, España")
        error = (await reg.wait_for_error_message()).lower()
        assert any(word in error for word in ("número", "number", "contraseña", "password")), \
            "S12: no-number password backend error"

        # S11: successful registration with a long password (16 characters)
        reg = await self._open_register()
        ts2 = _now_ms()
        email = f"reglong{ts2}@devorapp.test"
        password = "Segura1234567890"
        self.register_email_for_cleanup(email, password)
        await self._fill_step1(reg, email, f"reglong{ts2 % 100000}", password, BASE_FIRST_NAME, BASE_LAST_NAME)
        await self.inject_autocomplete_mock()
        await reg.click_continue()
        await reg.wait_for_step2()
        assert await reg.is_on_step2(), "S11: must advance to step 2"
        await reg.enter_location("Madrid, España")
        await self.trigger_autocomplete_place_changed()
        await reg.click_submit()

        await reg.wait_for_verify_email()
        assert await reg.is_verify_email_visible(), "S11: verification screen must be shown"
