"""Page object for /login: ready once the login form is visible."""
from typing import Self

from src.browser import TestId
from src.pages.base_page import BasePage
from src.pages.home_page import HomePage
from src.pages.register_page import RegisterPage


class LoginPage(BasePage):
    FORM = TestId.of("login-form")
    IDENTIFIER = TestId.of("login-identifier")
    PASSWORD = TestId.of("login-password")
    SUBMIT = TestId.of("login-submit")
    GOOGLE = TestId.of("login-google")
    REGISTER_LINK = TestId.of("login-register-link")
    ERROR = TestId.of("login-message-error")

    async def _wait_ready(self) -> None:
        await self.locator(self.FORM).wait_for("visible")

    async def enter_identifier(self, identifier: str) -> Self:
        await self.fill(self.IDENTIFIER, identifier)
        return self

    async def enter_password(self, password: str) -> Self:
        await self.fill(self.PASSWORD, password)
        return self

    async def submit_login(self) -> HomePage:
        """Submits the form and waits for the home page."""
        await self.click(self.SUBMIT)
        return await HomePage.create(self.page)

    async def submit_login_expecting_failure(self) -> Self:
        """Submits the form expecting a failure and waits for the error message."""
        await self.click(self.SUBMIT)
        await self.locator(self.ERROR).wait_for("visible")
        return self

    async def go_to_register(self) -> RegisterPage:
        await self.click(self.REGISTER_LINK)
        return await RegisterPage.create(self.page)

    async def click_google_login(self) -> HomePage:
        await self.click(self.GOOGLE)
        return await HomePage.create(self.page)

    async def has_error_message(self) -> bool:
        return await self.is_visible(self.ERROR)
