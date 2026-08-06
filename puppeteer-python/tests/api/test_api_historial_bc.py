"""Port of epigijon.devorapp.e2e.functional.tests.api.TestApiHistorialBC.

API Base-Choice tests for the history (historial) module.

Adapts the history scenarios from ``history.spec.ts`` (Playwright) to pure
REST assertions.

Cases covered:
  * BASE   — multiple history entries are returned by GET /api/historial.
  * Caso 2 — a fresh user has an empty history (0 entries).
  * Caso 5 — exactly 1 history entry is returned with correct fields.
  * Caso 6 — deleting an entry removes it from the history list.
  * Caso 3 — entry has a fecha_acceso (timestamp) field populated.
"""
import requests

from src.common.base_api_class import BaseApiClass

PLACE_A = "ChIJN1t_tDeuEmsRUsoyG83frY4"
PLACE_B = "ChIJdd4hrwug2EcRmSrV3Vo6llI"
PLACE_C = "ChIJ2eUgeAK6j4ARbn5u_wAGqWA"


class TestApiHistorialBC(BaseApiClass):
    @classmethod
    def setUpClass(cls) -> None:
        super().setUpClass()
        ts = cls.unique()
        cls.register_and_login(cls.unique_username(ts), cls.unique_email(ts), "Test1234!")

    @classmethod
    def tearDownClass(cls) -> None:
        cls.delete_test_user()
        super().tearDownClass()

    # ── BASE: múltiples entradas devueltas ──────────────────────────────────

    def test_base_multiples_entradas(self):
        """BASE — adding 3 history entries returns all 3 via GET /api/historial."""
        self.add_historial(PLACE_A)
        self.add_historial(PLACE_B)
        self.add_historial(PLACE_C)

        historial = self.get_json_array(self.historial_url(""))
        self.assertTrue(len(historial) >= 3, "After adding 3 entries historial must have at least 3 items (BASE)")

    # ── Caso 2: historial vacío → array vacío ───────────────────────────────

    def test_caso2_historial_vacio(self):
        """Caso 2 — fresh user with no history gets an empty array."""
        ts = self.unique()
        email = self.unique_email(ts)
        username = self.unique_username(ts)
        password = "Test1234!"

        with requests.Session() as local_client:
            local_client.post(self.auth_url("/register"),
                               json=self.register_payload(username, email, password, "Test", "User", ""),
                               headers={"Accept": "application/json"})
            local_client.post(self.auth_url("/login"),
                               json=self.login_payload(email, password),
                               headers={"Accept": "application/json"})

            response = local_client.get(self.historial_url(""), headers={"Accept": "application/json"})
            historial = response.json()
            self.assertEqual(0, len(historial), "A brand-new user must have an empty history")

            local_client.delete(self.auth_url("/profile"), params={"password": password},
                                 headers={"Accept": "application/json"})

    # ── Caso 5: exactamente 1 entrada ────────────────────────────────────────

    def test_caso5_una_entrada(self):
        """Caso 5 — adding 1 history entry returns it with id, place_id and fecha_acceso."""
        entry = self.post_json_object(self.historial_url(""), self.historial_payload(PLACE_A))

        self.assertTrue(entry["id"] > 0, "Entry id must be positive")
        self.assertEqual(PLACE_A, entry["place_id"], "place_id must match")
        self.assertIn("fecha_acceso", entry, "Entry must have a fecha_acceso timestamp field")

    # ── Caso 6: eliminar entrada la quita del historial ─────────────────────

    def test_caso6_eliminar_entrada(self):
        """Caso 6 — deleting a history entry removes it from GET /api/historial."""
        entry_id = self.add_historial(PLACE_A)

        delete_status = self.delete(self.historial_url(f"/{entry_id}"))
        self.assertEqual(204, delete_status, "DELETE historial entry must return HTTP 204")

        historial = self.get_json_array(self.historial_url(""))
        still_present = any(entry["id"] == entry_id for entry in historial)
        self.assertFalse(still_present, "Deleted entry must not appear in GET /api/historial")

    # ── Caso 3: la entrada tiene fecha_acceso (timestamp) ────────────────────

    def test_caso3_fecha_acceso(self):
        """Caso 3 — each history entry has a non-null fecha_acceso field."""
        self.add_historial(PLACE_B)

        historial = self.get_json_array(self.historial_url(""))
        self.assertTrue(len(historial) > 0, "Historial must have at least 1 entry")

        latest = historial[-1]
        self.assertIn("fecha_acceso", latest, "Entry must have fecha_acceso field")
        self.assertIsNotNone(latest["fecha_acceso"], "fecha_acceso must not be null")
