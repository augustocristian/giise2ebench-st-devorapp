"""API Base-Choice tests for the user profile module.

Cases covered:
  * BASE   - GET /me returns the registered user's data.
  * S2+S3  - PATCH /profile updates first_name and last_name.
  * S8     - PATCH /profile/email with wrong password -> HTTP 401.
  * S10    - PATCH /profile/password with wrong current password -> HTTP 400/401.
  * S13    - PATCH /profile/password with new password < 8 chars -> HTTP 422.
  * S14    - PATCH /profile/password with valid new password -> HTTP 200.
  * S17    - DELETE /profile removes the account; GET /me then returns 401.
"""
from src.common.base_api_class import BaseApiClass


class TestApiProfileBC(BaseApiClass):
    @classmethod
    def setup_class(cls) -> None:
        super().setup_class()
        ts = cls.unique()
        cls.register_and_login(cls.unique_username(ts), cls.unique_email(ts), "Test1234!")

    @classmethod
    def teardown_class(cls) -> None:
        cls.delete_test_user()
        super().teardown_class()

    def test_base_get_me(self):
        """BASE - GET /me returns the authenticated user's username and email."""
        me = self.get_json_object(self.auth_url("/me"))

        assert me["username"] == self.test_username, "username must match"
        assert me["email"] == self.test_email, "email must match"

    def test_s2s3_update_first_and_last_name(self):
        """S2+S3 - PATCH /profile updates first_name and last_name; GET /me reflects them."""
        new_first_name = f"NewFirstName{self.unique()}"
        new_last_name = "NewLastName"

        status = self.patch(self.auth_url("/profile"),
                            self.profile_update_payload(new_first_name, new_last_name, "", self.test_password))
        assert status == 200, "PATCH /profile must return 200"

        me = self.get_json_object(self.auth_url("/me"))
        assert me["first_name"] == new_first_name, "first_name must be updated"
        assert me["last_name"] == new_last_name, "last_name must be updated"

    def test_s8_wrong_password_for_email(self):
        """S8 - PATCH /profile/email with wrong password returns HTTP 401."""
        payload = {
            "new_email": f"new{self.unique()}@devorapp.test",
            "password": "WrongPassword99!",
        }

        status = self.patch(self.auth_url("/profile/email"), payload)
        assert status == 401, "Wrong password for email change must return HTTP 401"

    def test_s10_wrong_current_password(self):
        """S10 - PATCH /profile/password with wrong current password is rejected with HTTP 400 or 401."""
        payload = {"old_password": "WrongCurrent99!", "new_password": "NewPass123!"}

        status = self.patch(self.auth_url("/profile/password"), payload)
        assert status in (400, 401), f"Wrong current password must be rejected (400/401), got: {status}"

    def test_s13_new_password_too_short(self):
        """S13 - PATCH /profile/password with new password < 8 chars returns HTTP 400."""
        payload = {"old_password": self.test_password, "new_password": "Sh1!"}  # 4 chars

        status = self.patch(self.auth_url("/profile/password"), payload)
        assert status == 422, "New password shorter than 8 chars must return HTTP 422"

    def test_s14_password_change_ok(self):
        """S14 - PATCH /profile/password with valid credentials returns HTTP 200."""
        new_pass = "NewPassword1234!"
        payload = {"old_password": self.test_password, "new_password": new_pass}

        status = self.patch(self.auth_url("/profile/password"), payload)
        assert status == 200, "Valid password change must return HTTP 200"

        # Restore original password so other tests and teardown are not affected
        restore = {"old_password": new_pass, "new_password": self.test_password}
        self.patch(self.auth_url("/profile/password"), restore)

    def test_s17_delete_account(self):
        """S17 - DELETE /profile removes the account; subsequent GET /me returns 401."""
        ts = self.unique()
        email = self.unique_email(ts)
        username = self.unique_username(ts)
        password = "Delete1234!"

        with self.new_client(username, email, password) as client:
            delete_response = client.delete(self.auth_url("/profile"), params={"password": password},
                                            headers={"Accept": "application/json"})
            assert delete_response.status_code == 200, "DELETE /profile must return HTTP 200"

            me_response = client.get(self.auth_url("/me"), headers={"Accept": "application/json"})
            assert me_response.status_code == 401, "After account deletion GET /me must return 401"
