"""Port of epigijon.devorapp.e2e.functional.tests.api.TestApiRegister.

API tests for user registration and login — Base-Choice coverage.

Adapts the registration/authentication scenarios from ``register.spec.ts``
and ``login.spec.ts`` (Playwright) to pure HTTP/REST assertions.

Cases covered:
  * BASE   — valid registration returns HTTP 201 with user object.
  * S3     — already-used email → HTTP 400 (email taken).
  * S7     — login with correct credentials → HTTP 200.
  * S8     — login with wrong password → HTTP 401.
  * check  — GET /api/check-availability reflects email/username status.
"""
from src.common.base_api_class import BaseApiClass

PASSWORD = "Test1234!"


class TestApiRegister(BaseApiClass):
    # ── BASE: registro exitoso devuelve HTTP 201 ────────────────────────────

    def test_base_registro_exitoso(self):
        """BASE — valid registration returns HTTP 201 with user object."""
        ts = self.unique()
        status = self.post_status(
            self.auth_url("/register"),
            self.register_payload(self.unique_username(ts), self.unique_email(ts), PASSWORD, "Ana", "García", ""),
        )

        self.assertEqual(201, status, "Valid registration must return HTTP 201")

    # ── S3: correo ya registrado → error 400 ────────────────────────────────

    def test_s3_email_duplicado(self):
        """S3 — registering with a duplicate email returns HTTP 400."""
        ts = self.unique()
        email = self.unique_email(ts)
        username = self.unique_username(ts)

        # First registration — must succeed
        self.post_status(self.auth_url("/register"), self.register_payload(username, email, PASSWORD, "Ana", "García", ""))

        # Second registration with same email but different username
        second_status = self.post_status(
            self.auth_url("/register"),
            self.register_payload(self.unique_username(self.unique()), email, PASSWORD, "Ana", "García", ""),
        )

        self.assertIn(second_status, (400, 409),
                       f"Registering with a duplicate email must return HTTP 400 or 409, got: {second_status}")

    # ── Check-availability: correo libre / en uso ────────────────────────────

    def test_check_availability_email(self):
        """check-availability — email free returns email_taken=false; after registration email_taken=true."""
        ts = self.unique()
        email = self.unique_email(ts)
        username = self.unique_username(ts)

        before = self.get_json_object(self.auth_url(f"/check-availability?email={email}"))
        self.assertFalse(before["email_taken"], "email_taken must be false before registration")

        self.post_status(self.auth_url("/register"), self.register_payload(username, email, PASSWORD, "Test", "User", ""))

        after = self.get_json_object(self.auth_url(f"/check-availability?email={email}"))
        self.assertTrue(after["email_taken"], "email_taken must be true after registration")

    # ── Check-availability: username libre / en uso ──────────────────────────

    def test_check_availability_username(self):
        """check-availability — username free returns username_taken=false; after registration username_taken=true."""
        ts = self.unique()
        email = self.unique_email(ts)
        username = self.unique_username(ts)

        before = self.get_json_object(self.auth_url(f"/check-availability?username={username}"))
        self.assertFalse(before["username_taken"], "username_taken must be false before registration")

        self.post_status(self.auth_url("/register"), self.register_payload(username, email, PASSWORD, "Test", "User", ""))

        after = self.get_json_object(self.auth_url(f"/check-availability?username={username}"))
        self.assertTrue(after["username_taken"], "username_taken must be true after registration")

    # ── S7: login con credenciales correctas → HTTP 200 ──────────────────────

    def test_s7_login_correcto(self):
        """S7 — login with correct credentials returns HTTP 200."""
        ts = self.unique()
        email = self.unique_email(ts)
        username = self.unique_username(ts)

        self.post_status(self.auth_url("/register"), self.register_payload(username, email, PASSWORD, "Test", "User", ""))

        login_status = self.post_status(self.auth_url("/login"), self.login_payload(email, PASSWORD))
        self.assertEqual(200, login_status, "Login with correct credentials must return HTTP 200")

    # ── S8: login con contraseña incorrecta → HTTP 401 ───────────────────────

    def test_s8_login_contrasena_incorrecta(self):
        """S8 — login with wrong password returns HTTP 401."""
        ts = self.unique()
        email = self.unique_email(ts)
        username = self.unique_username(ts)

        self.post_status(self.auth_url("/register"), self.register_payload(username, email, PASSWORD, "Test", "User", ""))

        login_status = self.post_status(self.auth_url("/login"), self.login_payload(email, "WrongPassword99!"))
        self.assertEqual(401, login_status, "Login with wrong password must return HTTP 401")
