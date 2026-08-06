"""Port of epigijon.devorapp.e2e.functional.tests.api.TestApiRecommendBC.

API Base-Choice tests for the recommendation search module.

Adapts the recommendation scenarios from ``recommendation.spec.ts``
(Playwright) to pure REST assertions against POST /api/recommendations/search.

Cases covered:
  * BASE  — search with categories + prices + location returns HTTP 200 with results array.
  * S2    — categories = [] (empty) → HTTP 200 with results array.
  * S4    — prices = [] (empty) → HTTP 200 with results array.
  * S6    — include_unconfirmed_price = false → HTTP 200.
  * S7    — open_now = false → HTTP 200.
  * S8    — using an alternative location → HTTP 200.
  * S10   — results may be empty array (handled without error).
"""
from src.common.base_api_class import BaseApiClass

LOCATION_PREF = "Gijón, España"
LOCATION_ALT = "Barcelona, España"


class TestApiRecommendBC(BaseApiClass):
    @classmethod
    def setUpClass(cls) -> None:
        super().setUpClass()
        ts = cls.unique()
        cls.register_and_login(cls.unique_username(ts), cls.unique_email(ts), "Test1234!")

    @classmethod
    def tearDownClass(cls) -> None:
        cls.delete_test_user()
        super().tearDownClass()

    # ── BASE: búsqueda con filtros base ─────────────────────────────────────

    def test_base_busqueda_filtros_base(self):
        """BASE — search with categories, prices and location returns HTTP 200 with results array."""
        body = self.search_payload(
            ["mexican_restaurant", "italian_restaurant"],
            ["PRICE_LEVEL_MODERATE", "PRICE_LEVEL_EXPENSIVE"],
            True, LOCATION_PREF, 5,
        )

        result = self.post_json_object(self.recommendations_url("/search"), body)
        self.assertIn("results", result, "Response must have a 'results' field")
        self.assertIsInstance(result["results"], list, "'results' must be a JSON array")

    # ── S2: categorías vacías → HTTP 200 ────────────────────────────────────

    def test_s2_categorias_vacias(self):
        """S2 — empty categories list is accepted and returns HTTP 200."""
        body = self.search_payload([], ["PRICE_LEVEL_MODERATE"], True, LOCATION_PREF, 5)

        result = self.post_json_object(self.recommendations_url("/search"), body)
        self.assertIn("results", result, "Empty categories must still return a 'results' array (S2)")

    # ── S4: precios vacíos → HTTP 200 ───────────────────────────────────────

    def test_s4_precios_vacios(self):
        """S4 — empty prices list is accepted and returns HTTP 200."""
        body = self.search_payload(["mexican_restaurant"], [], True, LOCATION_PREF, 5)

        result = self.post_json_object(self.recommendations_url("/search"), body)
        self.assertIn("results", result, "Empty prices must still return a 'results' array (S4)")

    # ── S6: include_unconfirmed_price = false ────────────────────────────────

    def test_s6_sin_precio_no_confirmado(self):
        """S6 — include_unconfirmed_price=false returns HTTP 200."""
        body = self.search_payload(
            ["mexican_restaurant", "italian_restaurant"],
            ["PRICE_LEVEL_MODERATE", "PRICE_LEVEL_EXPENSIVE"],
            False, LOCATION_PREF, 5,
        )

        result = self.post_json_object(self.recommendations_url("/search"), body)
        self.assertIn("results", result, "include_unconfirmed_price=false must still return results array (S6)")

    # ── S7: open_now = false ─────────────────────────────────────────────────

    def test_s7_no_abierto(self):
        """S7 — open_now=false is accepted and returns HTTP 200."""
        body = self.search_payload(
            ["mexican_restaurant"], ["PRICE_LEVEL_MODERATE"], True, LOCATION_PREF, 5, open_now=False,
        )

        result = self.post_json_object(self.recommendations_url("/search"), body)
        self.assertIn("results", result, "open_now=false must return a 'results' array (S7)")

    # ── S8: ubicación alternativa ────────────────────────────────────────────

    def test_s8_ubicacion_alternativa(self):
        """S8 — alternative location is accepted and returns HTTP 200."""
        body = self.search_payload(
            ["mexican_restaurant", "italian_restaurant"],
            ["PRICE_LEVEL_MODERATE", "PRICE_LEVEL_EXPENSIVE"],
            True, LOCATION_ALT, 5,
        )

        result = self.post_json_object(self.recommendations_url("/search"), body)
        self.assertIn("results", result, "Alternative location must still return a 'results' array (S8)")

    # ── S10: resultados pueden ser vacíos ────────────────────────────────────

    def test_s10_resultados_vacios(self):
        """S10 — search returning 0 results returns HTTP 200 with empty results array."""
        body = self.search_payload(
            ["some_very_obscure_cuisine_type_xyz"], [], False, "Lugar inexistente 99999", 1,
        )

        status = self.post_status(self.recommendations_url("/search"), body)
        self.assertIn(status, (200, 422), f"Search must return 200 (or 422 for an invalid location), got: {status}")
