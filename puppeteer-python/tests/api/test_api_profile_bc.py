"""Port of epigijon.devorapp.e2e.functional.tests.api.TestApiProfileBC.

API Base-Choice tests for the user profile module.

Adapts the profile scenarios from ``profile.spec.ts`` (Playwright) to pure
REST assertions.

Cases covered:
  * BASE   — GET /api/me returns the registered user's data.
  * S2+S3  — PATCH /api/profile updates nombre and apellidos.
  * S8     — PATCH /api/profile/email with wrong password → HTTP 401.
  * S10    — PATCH /api/profile/password with wrong current password → HTTP 400.
  * S13    — PATCH /api/profile/password with new password < 8 chars → HTTP 400.
  * S14    — PATCH /api/profile/password with valid new password → HTTP 200.
  * S17    — DELETE /api/profile removes the account → subsequent GET /api/me → 401.
"""
import requests

from src.common.base_api_class import BaseApiClass


class TestApiProfileBC(BaseApiClass):
    @classmethod
    def setUpClass(cls) -> None:
        super().setUpClass()
        ts = cls.unique()
        cls.register_and_login(cls.unique_username(ts), cls.unique_email(ts), "Test1234!")

    @classmethod
    def tearDownClass(cls) -> None:
        cls.delete_test_user()
        super().tearDownClass()

    # ── BASE: GET /api/me devuelve los datos del usuario ────────────────────

    def test_base_get_me(self):
        """BASE — GET /api/me returns the authenticated user's username and email."""
        me = self.get_json_object(self.auth_url("/me"))

        self.assertEqual(self.test_username, me["username"], "username must match")
        self.assertEqual(self.test_email, me["email"], "email must match")

    # ── S2+S3: actualizar nombre y apellidos ─────────────────────────────────

    def test_s2s3_actualizar_nombre_apellidos(self):
        """S2+S3 — PATCH /api/profile updates nombre and apellidos; GET /api/me reflects them."""
        new_nombre = f"NuevoNombre{self.unique()}"
        new_apellidos = "NuevosApellidos"

        status = self.patch(self.auth_url("/profile"),
                             self.profile_update_payload(new_nombre, new_apellidos, "", self.test_password))
        self.assertEqual(200, status, "PATCH /api/profile must return 200")

        me = self.get_json_object(self.auth_url("/me"))
        self.assertEqual(new_nombre, me["nombre"], "nombre must be updated")
        self.assertEqual(new_apellidos, me["apellidos"], "apellidos must be updated")

    # ── S8: contraseña incorrecta al cambiar email → HTTP 401 ────────────────

    def test_s8_contrasena_wrong_para_email(self):
        """S8 — PATCH /api/profile/email with wrong password returns HTTP 401."""
        payload = {
            "new_email": f"nuevo{self.unique()}@devorapp.test",
            "password": "WrongPassword99!",
        }

        status = self.patch(self.auth_url("/profile/email"), payload)
        self.assertEqual(401, status, "Wrong password for email change must return HTTP 401")

    # ── S10: contraseña actual incorrecta al cambiar contraseña → HTTP 400 ──

    def test_s10_contrasena_actual_incorrecta(self):
        """S10 — PATCH /api/profile/password with wrong current password is rejected with HTTP 400 or 401."""
        payload = {"old_password": "WrongCurrent99!", "new_password": "NuevaPass123!"}

        status = self.patch(self.auth_url("/profile/password"), payload)
        self.assertIn(status, (400, 401), f"Wrong current password must be rejected (400/401), got: {status}")

    # ── S13: contraseña nueva muy corta → HTTP 400 ───────────────────────────

    def test_s13_nueva_contrasena_muy_corta(self):
        """S13 — PATCH /api/profile/password with new password < 8 chars returns HTTP 400."""
        payload = {"old_password": self.test_password, "new_password": "Sh1!"}  # 4 chars

        status = self.patch(self.auth_url("/profile/password"), payload)
        self.assertEqual(400, status, "New password shorter than 8 chars must return HTTP 400")

    # ── S14: cambio de contraseña correcto → HTTP 200 ────────────────────────

    def test_s14_cambio_contrasena_ok(self):
        """S14 — PATCH /api/profile/password with valid credentials returns HTTP 200."""
        new_pass = "NuevaPassword1234!"
        payload = {"old_password": self.test_password, "new_password": new_pass}

        status = self.patch(self.auth_url("/profile/password"), payload)
        self.assertEqual(200, status, "Valid password change must return HTTP 200")

        # Restore original password so other tests and teardown are not affected
        restore = {"old_password": new_pass, "new_password": self.test_password}
        self.patch(self.auth_url("/profile/password"), restore)

    # ── S17: eliminar cuenta → GET /api/me → 401 ─────────────────────────────

    def test_s17_eliminar_cuenta(self):
        """S17 — DELETE /api/profile removes the account; subsequent GET /api/me returns 401."""
        ts = self.unique()
        email = self.unique_email(ts)
        username = self.unique_username(ts)
        password = "Delete1234!"

        with requests.Session() as local_client:
            local_client.post(self.auth_url("/register"),
                               json=self.register_payload(username, email, password, "Del", "User", ""),
                               headers={"Accept": "application/json"})
            local_client.post(self.auth_url("/login"),
                               json=self.login_payload(email, password),
                               headers={"Accept": "application/json"})

            delete_response = local_client.delete(self.auth_url("/profile"), params={"password": password},
                                                    headers={"Accept": "application/json"})
            self.assertEqual(200, delete_response.status_code, "DELETE /api/profile must return HTTP 200")

            me_response = local_client.get(self.auth_url("/me"), headers={"Accept": "application/json"})
            self.assertEqual(401, me_response.status_code,
                              "After account deletion GET /api/me must return 401")
