"""Page object for /profile. The page has five cards (personal, location, email,
security, danger), each with its own edit / save / cancel actions. Ready once
the personal card is shown."""
from typing import Self

from src.browser import Locator, TestId
from src.pages.base_page import BasePage


class ProfilePage(BasePage):
    async def _wait_ready(self) -> None:
        await self.locator(TestId.profile_card("personal")).wait_for("visible")

    async def card_text(self, card: str) -> str:
        """Full text of a card: personal, location, email, security or danger."""
        return await self.locator(TestId.profile_card(card)).text()

    async def _click_id(self, test_id: str) -> Self:
        await self.click(TestId.of(test_id))
        return self

    async def _fill_id(self, test_id: str, value: str) -> Self:
        await self.fill(TestId.of(test_id), value)
        return self

    # Personal info
    async def edit_personal_info(self) -> Self:
        return await self._click_id("profile-personal-edit")

    async def save_personal_info(self) -> Self:
        return await self._click_id("profile-personal-save")

    async def cancel_personal_info(self) -> Self:
        return await self._click_id("profile-personal-cancel")

    async def fill_first_name(self, value: str) -> Self:
        return await self._fill_id("profile-personal-first-name", value)

    async def fill_last_name(self, value: str) -> Self:
        return await self._fill_id("profile-personal-last-name", value)

    # Location
    async def edit_location(self) -> Self:
        return await self._click_id("profile-location-edit")

    async def save_location(self) -> Self:
        return await self._click_id("profile-location-save")

    async def fill_location(self, value: str) -> Self:
        return await self._fill_id("profile-location-input", value)

    # Email change
    async def open_email_change(self) -> Self:
        return await self._click_id("profile-email-edit")

    async def fill_new_email(self, email: str) -> Self:
        return await self._fill_id("profile-email-input", email)

    async def fill_email_password(self, password: str) -> Self:
        return await self._fill_id("profile-email-password", password)

    async def submit_email_change(self) -> Self:
        return await self._click_id("profile-email-submit")

    @property
    def new_email_input(self) -> Locator:
        return self.locator(TestId.of("profile-email-input"))

    @property
    def email_password_input(self) -> Locator:
        return self.locator(TestId.of("profile-email-password"))

    # Password change
    async def open_password_change(self) -> Self:
        return await self._click_id("profile-security-edit")

    async def submit_password_change(self) -> Self:
        return await self._click_id("profile-security-submit")

    @property
    def current_password_input(self) -> Locator:
        return self.locator(TestId.of("profile-security-current"))

    @property
    def new_password_input(self) -> Locator:
        return self.locator(TestId.of("profile-security-new"))

    async def fill_password_change(self, current: str, new_password: str, confirm: str) -> Self:
        await self._fill_id("profile-security-current", current)
        await self._fill_id("profile-security-new", new_password)
        return await self._fill_id("profile-security-confirm", confirm)

    # Delete account
    async def open_delete_account(self) -> Self:
        return await self._click_id("profile-danger-open")

    async def fill_delete_confirm(self, text: str) -> Self:
        return await self._fill_id("profile-danger-confirm-input", text)

    async def submit_delete_account(self) -> Self:
        return await self._click_id("profile-danger-submit")

    async def is_delete_button_enabled(self) -> bool:
        return await self.locator(TestId.of("profile-danger-submit")).is_enabled()

    # Toasts
    async def has_success_toast(self) -> bool:
        return await self.locator(TestId.toast("success")).first().is_visible()

    async def success_toast_text(self) -> str:
        return await self._last_text(self.locator(TestId.toast("success")))

    async def has_error_toast(self) -> bool:
        return await self.locator(TestId.toast("error")).first().is_visible()

    async def error_toast_text(self) -> str:
        return await self._last_text(self.locator(TestId.toast("error")))

    async def dismiss_success_toast(self) -> Self:
        return await self._dismiss_last(self.locator(TestId.toast("success")))

    async def dismiss_error_toast(self) -> Self:
        return await self._dismiss_last(self.locator(TestId.toast("error")))

    async def wait_for_toast(self, toast_type: str) -> None:
        """Waits for a toast of the given type: success or error."""
        await self.locator(TestId.toast(toast_type)).first().wait_for("visible")

    async def _last_text(self, toasts: Locator) -> str:
        return "" if await toasts.count() == 0 else await toasts.last().text()

    async def _dismiss_last(self, toasts: Locator) -> Self:
        """Clicks the newest toast and waits until it is gone, so the next
        ``wait_for_toast`` cannot match the one just dismissed."""
        before = await toasts.count()
        if before > 0:
            await toasts.last().click()

            async def removed() -> bool:
                return await toasts.count() < before

            await self.wait_until(removed, "the toast to disappear")
        return self
