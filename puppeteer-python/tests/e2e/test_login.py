"""Port of epigijon.devorapp.e2e.functional.tests.e2e.TestLogin.

Browser tests for the DevorApp login page.

Base-Choice coverage:
  * BASE — valid credentials redirect to /home (S7 - Happy Path).
  * S3–S6 — empty identifier and/or password trigger a validation error (BASE, S3, S4, S5, S6).
  * S8 — wrong password shows an error and stays on /login.
"""
import time

from src.common.base_logged_class import BaseLoggedClass, async_test
from src.pages.login_page import LoginPage

PASSWORD = "Test1234!"


class TestLogin(BaseLoggedClass):
    @classmethod
    def setUpClass(cls) -> None:
        super().setUpClass()
        ts = int(time.time() * 1000)
        username = f"tst{ts}"
        if len(username) > 30:
            username = username[-30:]
        cls.setup_test_user(username, f"testui{ts}@devorapp.test", PASSWORD)

    @classmethod
    def tearDownClass(cls) -> None:
        cls.teardown_test_user()
        super().tearDownClass()

    # ── Tests ────────────────────────────────────────────────────────────────

    @async_test
    async def test_successful_login(self):
        """S7 — valid credentials redirect the user to /home."""
        await self.go_to_login()
        page = await LoginPage.create(self.page, self.waiter)
        await page.enter_identifier(self.test_email)
        await page.enter_password(PASSWORD)
        home = await page.submit_login()

        url = await home.get_current_url()
        self.assertIn("/home", url, "After login the URL must contain /home (S7)")

    @async_test
    async def test_login_validation_errors(self):
        """BASE, S3–S6, S8 — empty fields and wrong password are rejected with an error."""
        # 1. BASE: existing email, empty password
        await self.go_to_login()
        page = await LoginPage.create(self.page, self.waiter)
        await page.enter_identifier(self.test_email)
        await page.enter_password("")
        await page.submit_login_expecting_failure()
        self.assertTrue(await page.has_error_message(), "Error message must show for empty password (BASE)")

        # 2. S3: non-existing email, empty password
        await self.go_to_login()
        page = await LoginPage.create(self.page, self.waiter)
        await page.enter_identifier("nonexistent@devorapp.test")
        await page.enter_password("")
        await page.submit_login_expecting_failure()
        self.assertTrue(await page.has_error_message(),
                         "Error message must show for non-existing email and empty password (S3)")

        # 3. S4: existing username, empty password
        await self.go_to_login()
        page = await LoginPage.create(self.page, self.waiter)
        await page.enter_identifier(self.test_username)
        await page.enter_password("")
        await page.submit_login_expecting_failure()
        self.assertTrue(await page.has_error_message(),
                         "Error message must show for existing username and empty password (S4)")

        # 4. S5: non-existing username, empty password
        await self.go_to_login()
        page = await LoginPage.create(self.page, self.waiter)
        await page.enter_identifier("nonexistentuser")
        await page.enter_password("")
        await page.submit_login_expecting_failure()
        self.assertTrue(await page.has_error_message(),
                         "Error message must show for non-existing username and empty password (S5)")

        # 5. S6: both fields empty
        await self.go_to_login()
        page = await LoginPage.create(self.page, self.waiter)
        await page.enter_identifier("")
        await page.enter_password("")
        await page.submit_login_expecting_failure()
        self.assertTrue(await page.has_error_message(), "Error message must show when both fields are empty (S6)")

        # 6. S8: correct identifier, wrong password
        await self.go_to_login()
        page = await LoginPage.create(self.page, self.waiter)
        await page.enter_identifier(self.test_email)
        await page.enter_password("WrongPassword99!")
        await page.submit_login_expecting_failure()

        self.assertTrue(await page.has_error_message(), "An error message must be visible after a failed login (S8)")
        self.assertIn("/login", self.page.url, "The URL must remain on /login after a failed attempt (S8)")
