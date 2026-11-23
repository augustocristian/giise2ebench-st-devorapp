"""API tests for user registration and login - Base-Choice coverage.

Cases covered:
  * BASE   - valid registration returns HTTP 201.
  * S3     - already-used email -> HTTP 409.
  * S7     - login with correct credentials -> HTTP 201 (a session is created).
  * S8     - login with wrong password -> HTTP 401.
  * check  - GET /users/availability reflects email/username status.
"""
from src.common.base_api_class import BaseApiClass

PASSWORD = "Test1234!"


class TestApiRegister(BaseApiClass):
    def register(self, username: str, email: str, first_name: str = "Test", last_name: str = "User") -> int:
        """Registers a user and returns the HTTP status."""
        return self.post_status(self.auth_url("/users"),
                                self.register_payload(username, email, PASSWORD, first_name, last_name, ""))

    # BASE: successful registration

    def test_base_successful_registration(self):
        """BASE - valid registration returns HTTP 201."""
        ts = self.unique()
        status = self.register(self.unique_username(ts), self.unique_email(ts), "Ana", "García")

        assert status == 201, "Valid registration must return HTTP 201"

    # S3: duplicated email

    def test_s3_duplicate_email(self):
        """S3 - registering with a duplicate email returns HTTP 409."""
        ts = self.unique()
        email = self.unique_email(ts)
        self.register(self.unique_username(ts), email, "Ana", "García")

        second_status = self.register(self.unique_username(self.unique()), email, "Ana", "García")

        assert second_status == 409, "Registering with a duplicate email must return HTTP 409"

    # Availability: email

    def test_check_availability_email(self):
        """users/availability - email_taken is false before registration and true after."""
        ts = self.unique()
        email = self.unique_email(ts)

        before = self.get_json_object(self.auth_url(f"/users/availability?email={email}"))
        assert not before["email_taken"], "email_taken must be false before registration"

        self.register(self.unique_username(ts), email)

        after = self.get_json_object(self.auth_url(f"/users/availability?email={email}"))
        assert after["email_taken"], "email_taken must be true after registration"

    # Availability: username

    def test_check_availability_username(self):
        """users/availability - username_taken is false before registration and true after."""
        ts = self.unique()
        username = self.unique_username(ts)

        before = self.get_json_object(self.auth_url(f"/users/availability?username={username}"))
        assert not before["username_taken"], "username_taken must be false before registration"

        self.register(username, self.unique_email(ts))

        after = self.get_json_object(self.auth_url(f"/users/availability?username={username}"))
        assert after["username_taken"], "username_taken must be true after registration"

    # S7: correct login

    def test_s7_correct_login(self):
        """S7 - login with correct credentials returns HTTP 201."""
        ts = self.unique()
        email = self.unique_email(ts)
        self.register(self.unique_username(ts), email)

        login_status = self.post_status(self.auth_url("/sessions"), self.login_payload(email, PASSWORD))
        assert login_status == 201, "Login with correct credentials must return HTTP 201"

    # S8: wrong password

    def test_s8_login_wrong_password(self):
        """S8 - login with wrong password returns HTTP 401."""
        ts = self.unique()
        email = self.unique_email(ts)
        self.register(self.unique_username(ts), email)

        login_status = self.post_status(self.auth_url("/sessions"), self.login_payload(email, "WrongPassword99!"))
        assert login_status == 401, "Login with wrong password must return HTTP 401"
