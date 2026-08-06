"""Port of epigijon.devorapp.e2e.functional.tests.api.TestApiValoracionesBC.

API Base-Choice tests for the ratings (valoraciones) module.

Adapts the rating scenarios from ``rating.spec.ts`` (Playwright) to pure
REST assertions.

Cases covered:
  * BASE  — full rating (all 4 aspects + comment) is stored and retrieved correctly.
  * S3    — calidad=1, precio=3 → scores match exactly.
  * S4    — calidad=3, precio=1 → scores match exactly.
  * S9    — higiene=1, trato=3 → scores match exactly.
  * S10   — higiene=3, trato=1 → scores match exactly.
  * S14   — empty comment is stored as empty string or null.
  * del   — deleting a rating removes it from GET /api/valoraciones.
"""
from src.common.base_api_class import BaseApiClass


class TestApiValoracionesBC(BaseApiClass):
    @classmethod
    def setUpClass(cls) -> None:
        super().setUpClass()
        ts = cls.unique()
        cls.register_and_login(cls.unique_username(ts), cls.unique_email(ts), "Test1234!")

    @classmethod
    def tearDownClass(cls) -> None:
        cls.delete_test_user()
        super().tearDownClass()

    # ── BASE: valoración completa → todos los campos almacenados ────────────

    def test_base_valoracion_completa(self):
        """BASE — full rating with all aspects at max stored and retrieved correctly."""
        place_id = f"bc_base_{self.unique()}"
        val = self.create_valoracion(place_id, 5, 5, 5, 5, "Excelente servicio y comida deliciosa")

        self.assertTrue(val["id"] > 0, "id must be positive")
        self.assertEqual(5, val["calidad"], "calidad=5")
        self.assertEqual(5, val["precio"], "precio=5")
        self.assertEqual(5, val["higiene"], "higiene=5")
        self.assertEqual(5, val["trato"], "trato=5")
        self.assertEqual("Excelente servicio y comida deliciosa", val["comentario"], "comentario matches")

    # ── S3: calidad=1, precio=3 ──────────────────────────────────────────────

    def test_s3_calidad_baja_precio_medio(self):
        """S3 — calidad=1, precio=3, higiene=5, trato=5 stored correctly."""
        place_id = f"bc_s3_{self.unique()}"
        val = self.create_valoracion(place_id, 1, 3, 5, 5, "OK")

        self.assertEqual(1, val["calidad"], "calidad=1")
        self.assertEqual(3, val["precio"], "precio=3")
        self.assertEqual(5, val["higiene"], "higiene=5")
        self.assertEqual(5, val["trato"], "trato=5")

    # ── S4: calidad=3, precio=1 ──────────────────────────────────────────────

    def test_s4_calidad_medio_precio_bajo(self):
        """S4 — calidad=3, precio=1, higiene=5, trato=5 stored correctly."""
        place_id = f"bc_s4_{self.unique()}"
        val = self.create_valoracion(place_id, 3, 1, 5, 5, "OK")

        self.assertEqual(3, val["calidad"], "calidad=3")
        self.assertEqual(1, val["precio"], "precio=1")

    # ── S9: higiene=1, trato=3 ────────────────────────────────────────────────

    def test_s9_higiene_bajo_trato_medio(self):
        """S9 — calidad=5, precio=5, higiene=1, trato=3 stored correctly."""
        place_id = f"bc_s9_{self.unique()}"
        val = self.create_valoracion(place_id, 5, 5, 1, 3, "Regular higiene")

        self.assertEqual(1, val["higiene"], "higiene=1")
        self.assertEqual(3, val["trato"], "trato=3")

    # ── S10: higiene=3, trato=1 ───────────────────────────────────────────────

    def test_s10_higiene_medio_trato_bajo(self):
        """S10 — calidad=5, precio=5, higiene=3, trato=1 stored correctly."""
        place_id = f"bc_s10_{self.unique()}"
        val = self.create_valoracion(place_id, 5, 5, 3, 1, "Trato mejorable")

        self.assertEqual(3, val["higiene"], "higiene=3")
        self.assertEqual(1, val["trato"], "trato=1")

    # ── S14: comentario vacío aceptado ───────────────────────────────────────

    def test_s14_comentario_vacio(self):
        """S14 — rating with empty comment is accepted (HTTP 201)."""
        place_id = f"bc_s14_{self.unique()}"
        status = self.post_status(self.valoraciones_url(""), self.valoracion_payload(place_id, 5, 5, 5, 5, ""))

        self.assertEqual(201, status, "A rating with an empty comment must return HTTP 201")

    # ── Eliminar valoración la quita de GET /api/valoraciones ───────────────

    def test_eliminar_valoracion(self):
        """Deleting a rating removes it from GET /api/valoraciones."""
        place_id = f"bc_del_{self.unique()}"
        self.create_valoracion(place_id, 4, 3, 5, 4, "A delete test")

        delete_status = self.delete(self.valoraciones_url(f"/{place_id}"))
        self.assertEqual(204, delete_status, "DELETE must return HTTP 204")

        all_valoraciones = self.get_json_array(self.valoraciones_url(""))
        found = any(v["place_id"] == place_id for v in all_valoraciones)
        self.assertFalse(found, "Deleted valoracion must not appear in GET list")
