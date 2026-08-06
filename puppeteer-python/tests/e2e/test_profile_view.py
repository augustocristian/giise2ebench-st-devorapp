"""Browser tests for the profile page (/profile).

Base-Choice coverage:
  * BASE - profile data loads and an invalid location update is rejected.
  * S2-S4 - save first/last name and a valid location update.
  * S5-S9 - email change validations and happy path.
  * S10-S16 - password change validations and happy path.
  * S17 - account deletion.
"""
import time

from src.browser import Locator, TestId
from src.common.base_logged_class import BaseLoggedClass
from src.pages.login_page import LoginPage
from src.pages.profile_page import ProfilePage

INVALID_LOCATION_ERROR = "Debes seleccionar una ubicación válida"


def _now_ms() -> int:
    return int(time.time() * 1000)


async def _card_contains(profile: ProfilePage, card: str, text: str) -> bool:
    return text in await profile.card_text(card)


async def _locator_contains(locator: Locator, text: str) -> bool:
    return await locator.count() > 0 and text in await locator.first().text()


class TestProfileView(BaseLoggedClass):
    @classmethod
    def setup_class(cls) -> None:
        super().setup_class()
        ts = _now_ms()
        cls.setup_test_user(f"profui{ts % 100000}", f"profui{ts}@devorapp.test", "Test1234!")

    @classmethod
    def teardown_class(cls) -> None:
        cls.teardown_test_user()
        super().teardown_class()

    async def _login_and_go_to_profile(self, email: str, password: str) -> ProfilePage:
        await self.go_to_login()
        login = await LoginPage.create(self.page)
        await login.enter_identifier(email)
        await login.enter_password(password)
        await login.submit_login()
        await self.page.goto(f"{self.sut_url}/profile")
        profile = await ProfilePage.create(self.page)
        await profile.wait_until(
            lambda: _card_contains(profile, "personal", "UITester"), "the profile data to load")
        return profile

    async def test_load_and_manage_personal_info_and_location(self):
        """BASE, S2, S3, S4 - profile loads; personal info and location can be managed."""
        # A dedicated user avoids cross-test pollution when mutating profile data.
        ts = _now_ms()
        email = f"personalui{ts}@devorapp.test"
        password = "Test1234!"
        self.register_user_api(f"personalui{ts % 100000}", email, password)

        profile = await self._login_and_go_to_profile(email, password)

        # BASE: data is present
        personal = await profile.card_text("personal")
        location = await profile.card_text("location")
        assert "UITester" in personal, "BASE: personal card must contain the first name"
        assert "Test" in personal, "BASE: personal card must contain the last name"
        assert "Gijón" in location, "BASE: location card must contain the preferred location"

        await self.inject_autocomplete_mock()

        # Cancelling the edit restores the original values
        await profile.edit_personal_info()
        await profile.fill_first_name("JuanModificado")
        await profile.fill_last_name("PérezModificado")
        await profile.cancel_personal_info()
        assert "UITester" in await profile.card_text("personal"), "Cancel must restore the original name"

        # S2 & S3: save updated first/last name
        await profile.edit_personal_info()
        await profile.fill_first_name("Juan")
        await profile.fill_last_name("Pérez")
        await profile.save_personal_info()
        await profile.wait_for_toast("success")
        assert await profile.has_success_toast(), "S2/S3: success toast must appear"
        await profile.dismiss_success_toast()
        personal = await profile.card_text("personal")
        assert "Juan" in personal, "S2: card must contain the updated first name"
        assert "Pérez" in personal, "S3: card must contain the updated last name"

        # BASE: manually typed location (not picked from autocomplete) -> inline error
        await profile.edit_location()
        await profile.fill_location("aifgauif")
        await profile.save_location()
        error = self.page.locator(TestId.of("profile-location-error"))
        await profile.wait_until(
            lambda: _locator_contains(error, INVALID_LOCATION_ERROR), "the invalid location error")
        assert INVALID_LOCATION_ERROR in await profile.card_text("location"), \
            "BASE: a manually typed location must show an inline error"

        # S4: location picked from autocomplete
        await profile.fill_location("Barcelona, España")
        await self.trigger_autocomplete_place_changed()
        await profile.save_location()
        await profile.wait_for_toast("success")
        assert await profile.has_success_toast(), "S4: success toast must appear after updating the location"
        await profile.wait_until(
            lambda: _card_contains(profile, "location", "Barcelona, España"), "the new location in its card")

    async def test_manage_email_and_password(self):
        """S5-S16 - email and password change validations and happy paths."""
        ts = _now_ms()

        # Email section
        email_user = f"tempemail{ts}@devorapp.test"
        email_password = "Password123!"
        self.register_user_api(f"tempemail{ts % 100000}", email_user, email_password)

        profile = await self._login_and_go_to_profile(email_user, email_password)
        await profile.open_email_change()

        # S7 & S9: required attributes
        assert await profile.new_email_input.attribute("required") is not None, "S7: email must be required"
        assert await profile.email_password_input.attribute("required") is not None, "S9: password must be required"

        # S5: invalid email format (HTML5 validation)
        await profile.fill_new_email("invalidemail")
        await profile.fill_email_password(email_password)
        await profile.submit_email_change()
        invalid = await self.page.evaluate(
            "(selector) => !document.querySelector(selector).checkValidity()", TestId.of("profile-email-input"))
        assert invalid is True, "S5: HTML5 validity must fail for an invalid email format"

        # S8: wrong password
        await profile.fill_new_email(f"new{ts}@devorapp.test")
        await profile.fill_email_password("WrongPassword!")
        await profile.submit_email_change()
        await profile.wait_for_toast("error")
        assert await profile.has_error_toast(), "S8: error toast must appear for a wrong password"
        await profile.dismiss_error_toast()

        # S6: email already in use
        await profile.fill_new_email(self.test_email)
        await profile.fill_email_password(email_password)
        await profile.submit_email_change()
        await profile.wait_for_toast("error")
        assert await profile.has_error_toast(), "S6: error toast must appear for an email in use"
        await profile.dismiss_error_toast()

        # Happy path: successful email change
        await profile.fill_new_email(f"newtempemail{ts}@devorapp.test")
        await profile.fill_email_password(email_password)
        await profile.submit_email_change()
        await profile.wait_for_toast("success")
        assert await profile.has_success_toast(), "Success toast must appear"
        assert "confirmación" in await profile.success_toast_text(), "Toast must mention the confirmation"
        assert email_user in await profile.card_text("email"), "Card must still display the original email"

        # Password section
        ts2 = _now_ms()
        pass_user = f"temppass{ts2}@devorapp.test"
        pass_password = "Password123!"
        self.register_user_api(f"temppass{ts2 % 100000}", pass_user, pass_password)

        profile = await self._login_and_go_to_profile(pass_user, pass_password)
        await profile.open_password_change()

        # S11 & S12: required attributes
        assert await profile.current_password_input.attribute("required") is not None, \
            "S11: current password must be required"
        assert await profile.new_password_input.attribute("required") is not None, \
            "S12: new password must be required"

        # S13: password too short (7 characters)
        await profile.fill_password_change(pass_password, "Short1!", "Short1!")
        await profile.submit_password_change()
        await profile.wait_for_toast("error")
        assert await profile.has_error_toast(), "S13: error toast for a short password"
        error_text = await profile.error_toast_text()
        assert "8" in error_text or "caracteres" in error_text.lower(), "S13: message content"
        await profile.dismiss_error_toast()

        # S15: no numbers in the new password
        await profile.fill_password_change(pass_password, "OnlyLettersPassword", "OnlyLettersPassword")
        await profile.submit_password_change()
        await profile.wait_for_toast("error")
        assert await profile.has_error_toast(), "S15: error toast for a password without numbers"
        await profile.dismiss_error_toast()

        # S16: no letters in the new password
        await profile.fill_password_change(pass_password, "1234567890", "1234567890")
        await profile.submit_password_change()
        await profile.wait_for_toast("error")
        assert await profile.has_error_toast(), "S16: error toast for a password without letters"
        await profile.dismiss_error_toast()

        # S10: wrong old password
        await profile.fill_password_change("WrongPassword!", "NewPassword123!", "NewPassword123!")
        await profile.submit_password_change()
        await profile.wait_for_toast("error")
        assert await profile.has_error_toast(), "S10: error toast for a wrong old password"
        await profile.dismiss_error_toast()

        # S14: successful password change (16-character new password)
        await profile.fill_password_change(pass_password, "NewPassword12345!", "NewPassword12345!")
        await profile.submit_password_change()
        await profile.wait_for_toast("success")
        assert await profile.has_success_toast(), "S14: success toast must appear"

    async def test_delete_account(self):
        """S17 - account deletion after the confirmation check."""
        ts = _now_ms()
        email = f"delui{ts}@devorapp.test"
        password = "Delete1234!"
        self.register_user_api(f"delui{ts % 100000}", email, password)

        profile = await self._login_and_go_to_profile(email, password)
        await profile.open_delete_account()

        assert not await profile.is_delete_button_enabled(), "Delete button must be disabled before typing the phrase"

        await profile.fill_delete_confirm("NO_CONFIRMAR")
        assert not await profile.is_delete_button_enabled(), "Delete button must stay disabled with a wrong phrase"

        await profile.fill_delete_confirm("CONFIRMAR")
        assert await profile.is_delete_button_enabled(), "Delete button must be enabled with CONFIRMAR"

        await profile.submit_delete_account()
        await profile.wait_for_toast("success")
        assert await profile.has_success_toast(), "A success toast must appear after the account deletion"

        async def on_login() -> bool:
            return "/login" in await self.page.url()

        await profile.wait_until(on_login, "the redirect to /login")
