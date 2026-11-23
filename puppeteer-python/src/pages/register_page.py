"""Page object for /register, both steps: step 1 (email, username, password,
first and last name) and step 2 (location and final submit). Ready once the
email field is visible."""
from typing import Self

from src.browser import TestId
from src.pages.base_page import BasePage


class RegisterPage(BasePage):
    EMAIL = TestId.of("register-email")
    USERNAME = TestId.of("register-username")
    PASSWORD = TestId.of("register-password")
    FIRST_NAME = TestId.of("register-first-name")
    LAST_NAME = TestId.of("register-last-name")
    CONTINUE = TestId.of("register-continue")

    GPS = TestId.of("register-gps")
    LOCATION = TestId.of("register-location")
    SUBMIT = TestId.of("register-submit")
    BACK = TestId.of("register-back")

    STEP_LABEL = TestId.of("register-step-label")
    STEP_ERROR = TestId.of("register-step-error")
    ERROR = TestId.of("register-message-error")
    EMAIL_ERROR = TestId.of("register-email-error")
    USERNAME_ERROR = TestId.of("register-username-error")
    VERIFY_TITLE = TestId.of("register-verify-title")
    LOCATION_NAME = TestId.of("register-location-name")

    async def _wait_ready(self) -> None:
        await self.locator(self.EMAIL).wait_for("visible")

    async def enter_email(self, email: str) -> Self:
        await self.fill(self.EMAIL, email)
        return self

    async def enter_username(self, username: str) -> Self:
        await self.fill(self.USERNAME, username)
        return self

    async def enter_password(self, password: str) -> Self:
        await self.fill(self.PASSWORD, password)
        return self

    async def enter_first_name(self, first_name: str) -> Self:
        await self.fill(self.FIRST_NAME, first_name)
        return self

    async def enter_last_name(self, last_name: str) -> Self:
        await self.fill(self.LAST_NAME, last_name)
        return self

    async def click_continue(self) -> Self:
        await self.click(self.CONTINUE)
        return self

    async def click_use_gps(self) -> Self:
        await self.click(self.GPS)
        return self

    async def enter_location(self, location: str) -> Self:
        """Types a location without picking it from the autocomplete dropdown."""
        await self.fill(self.LOCATION, location)
        return self

    async def click_submit(self) -> Self:
        await self.click(self.SUBMIT)
        return self

    async def click_back(self) -> Self:
        await self.click(self.BACK)
        return self

    async def wait_for_step2(self) -> Self:
        await self.wait_until(self.is_on_step2, "register step 2")
        return self

    async def error_message(self) -> str:
        """Step 1 validation banner, or else the API / step 2 error message."""
        step = await self.text_or_empty(self.locator(self.STEP_ERROR))
        return step or await self.text_or_empty(self.locator(self.ERROR))

    async def wait_for_error_message(self) -> str:
        """Waits until some error text is shown and returns it."""
        async def has_error() -> bool:
            return bool(await self.error_message())

        await self.wait_until(has_error, "a registration error message")
        return await self.error_message()

    async def wait_for_field_error(self, selector: str) -> str:
        """Waits until the given field error has text and returns it."""
        async def has_text() -> bool:
            return bool(await self.text_or_empty(self.locator(selector)))

        await self.wait_until(has_text, f"text in {selector}")
        return await self.text_or_empty(self.locator(selector))

    async def email_error_text(self) -> str:
        return await self.text_or_empty(self.locator(self.EMAIL_ERROR))

    async def username_error_text(self) -> str:
        return await self.text_or_empty(self.locator(self.USERNAME_ERROR))

    async def is_on_step1(self) -> bool:
        return "Paso 1 de 2" in await self.text_or_empty(self.locator(self.STEP_LABEL))

    async def is_on_step2(self) -> bool:
        return "Paso 2 de 2" in await self.text_or_empty(self.locator(self.STEP_LABEL))

    async def is_verify_email_visible(self) -> bool:
        return await self.is_visible(self.VERIFY_TITLE)

    async def wait_for_verify_email(self) -> None:
        await self.locator(self.VERIFY_TITLE).wait_for("visible")

    async def detected_location_text(self) -> str:
        return await self.text_or_empty(self.locator(self.LOCATION_NAME))

    async def is_loaded(self) -> bool:
        return await self.is_visible(self.EMAIL)
