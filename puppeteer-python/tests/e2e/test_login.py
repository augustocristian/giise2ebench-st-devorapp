"""Browser tests for the login page.

Base-Choice coverage:
  * S7 - valid credentials redirect to /home (happy path).
  * BASE, S3-S6 - empty identifier and/or password trigger a validation error.
  * S8 - wrong password shows an error and stays on /login.
"""
import time

from src.common.base_logged_class import BaseLoggedClass
from src.pages.login_page import LoginPage

PASSWORD = "Test1234!"


class TestLogin(BaseLoggedClass):
    @classmethod
    def setup_class(cls) -> None:
        super().setup_class()
        ts = int(time.time() * 1000)
        cls.setup_test_user(f"tst{ts}"[-30:], f"testui{ts}@devorapp.test", PASSWORD)

    @classmethod
    def teardown_class(cls) -> None:
        cls.teardown_test_user()
        super().teardown_class()

    async def _open_login(self) -> LoginPage:
        await self.go_to_login()
        return await LoginPage.create(self.page)

    async def _fail_login(self, identifier: str, password: str) -> LoginPage:
        login = await self._open_login()
        await login.enter_identifier(identifier)
        await login.enter_password(password)
        return await login.submit_login_expecting_failure()

    async def test_successful_login(self):
        """S7 - valid credentials redirect the user to the home page."""
        login = await self._open_login()
        await login.enter_identifier(self.test_email)
        await login.enter_password(PASSWORD)
        home = await login.submit_login()

        assert "/home" in await home.current_url(), "After login the URL must contain /home (S7)"

    async def test_login_validation_errors(self):
        """BASE, S3-S6, S8 - empty fields and a wrong password are rejected with an error."""
        login = await self._fail_login(self.test_email, "")
        assert await login.has_error_message(), "Error message must show for empty password (BASE)"

        login = await self._fail_login("nonexistent@devorapp.test", "")
        assert await login.has_error_message(), "Error message must show for non-existing email and empty password (S3)"

        login = await self._fail_login(self.test_username, "")
        assert await login.has_error_message(), "Error message must show for existing username and empty password (S4)"

        login = await self._fail_login("nonexistentuser", "")
        assert await login.has_error_message(), \
            "Error message must show for non-existing username and empty password (S5)"

        login = await self._fail_login("", "")
        assert await login.has_error_message(), "Error message must show when both fields are empty (S6)"

        login = await self._fail_login(self.test_email, "WrongPassword99!")
        assert await login.has_error_message(), "An error message must be visible after a failed login (S8)"
        assert "/login" in await self.page.url(), "The URL must remain on /login after a failed attempt (S8)"
