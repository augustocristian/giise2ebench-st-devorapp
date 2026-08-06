"""Port of epigijon.devorapp.e2e.functional.pages.LoginPage.

Page object for ``/login``. ``create()`` waits until the login form is
visible before returning, so any LoginPage instance is guaranteed ready.
"""
from src.common.by import By
from src.pages.base_page import BasePage
from src.pages.home_page import HomePage
from src.pages.register_page import RegisterPage


class LoginPage(BasePage):
    IDENTIFIER = By.id("identifier")
    PASSWORD = By.id("password")
    SUBMIT = By.id("login-submit-btn")
    GOOGLE_BTN = By.id("google-login-btn")
    REGISTER_LINK = By.id("go-register-link")
    ERROR_MSG = By.css(".message.error")

    async def _wait_ready(self) -> None:
        await self.waiter.wait_for_login_page()

    async def enter_identifier(self, identifier: str) -> "LoginPage":
        await self.fill(self.IDENTIFIER, identifier)
        return self

    async def enter_password(self, password: str) -> "LoginPage":
        await self.fill(self.PASSWORD, password)
        return self

    async def submit_login(self) -> HomePage:
        """Clicks submit and waits for the home page. Returns the resulting HomePage."""
        await self.click(self.SUBMIT)
        return await HomePage.create(self.page, self.waiter)

    async def submit_login_expecting_failure(self) -> "LoginPage":
        """Clicks submit expecting an error and waits for the error message."""
        await self.click(self.SUBMIT)
        await self.waiter.wait_for_login_error()
        return self

    async def go_to_register(self) -> RegisterPage:
        await self.click(self.REGISTER_LINK)
        return await RegisterPage.create(self.page, self.waiter)

    async def click_google_login(self) -> HomePage:
        await self.click(self.GOOGLE_BTN)
        return await HomePage.create(self.page, self.waiter)

    async def has_error_message(self) -> bool:
        return await self.is_visible(self.ERROR_MSG)
