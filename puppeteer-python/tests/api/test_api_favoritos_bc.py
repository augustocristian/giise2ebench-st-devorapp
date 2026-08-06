"""Port of epigijon.devorapp.e2e.functional.tests.api.TestApiFavoritosBC.

API Base-Choice tests for the favorites module.

Adapts the favorites scenarios from ``favorites.spec.ts`` (Playwright) to
pure REST assertions using :class:`BaseApiClass`.

Cases covered:
  * BASE   — create list, add several restaurants, GET returns all.
  * Caso 2 — GET empty list returns empty restaurantes array.
  * Caso 3 — GET list with 1 restaurant returns array of size 1.
  * Caso 4 — GET all lists returns the expected count.
  * Caso 5 — DELETE restaurant removes it from the list detail.
  * Caso 6 — DELETE list removes it from the user's collection.
"""
from src.common.base_api_class import BaseApiClass

PLACE_A = "ChIJN1t_tDeuEmsRUsoyG83frY4"
PLACE_B = "ChIJdd4hrwug2EcRmSrV3Vo6llI"
PLACE_C = "ChIJ2eUgeAK6j4ARbn5u_wAGqWA"


class TestApiFavoritosBC(BaseApiClass):
    @classmethod
    def setUpClass(cls) -> None:
        super().setUpClass()
        ts = cls.unique()
        cls.register_and_login(cls.unique_username(ts), cls.unique_email(ts), "Test1234!")

    @classmethod
    def tearDownClass(cls) -> None:
        cls.delete_test_user()
        super().tearDownClass()

    def setUp(self) -> None:
        self.lista_id = self.create_lista(f"BCTest{self.unique()}")

    # ── BASE: varias listas + varios restaurantes ───────────────────────────

    def test_base_varios_restaurantes(self):
        """BASE — adding 3 restaurants to a list returns all 3 in the detail endpoint."""
        self.post(self.favoritos_url(f"/listas/{self.lista_id}"), self.favorito_payload(PLACE_A))
        self.post(self.favoritos_url(f"/listas/{self.lista_id}"), self.favorito_payload(PLACE_B))
        self.post(self.favoritos_url(f"/listas/{self.lista_id}"), self.favorito_payload(PLACE_C))

        detail = self.get_json_object(self.favoritos_url(f"/listas/{self.lista_id}"))
        restaurantes = detail["restaurantes"]

        self.assertEqual(3, len(restaurantes), "After adding 3 restaurants the detail must return exactly 3")

    # ── Caso 2: lista vacía → restaurantes array vacío ──────────────────────

    def test_caso2_lista_vacia(self):
        """Caso 2 — a new list has an empty restaurantes array."""
        detail = self.get_json_object(self.favoritos_url(f"/listas/{self.lista_id}"))
        restaurantes = detail["restaurantes"]

        self.assertEqual(0, len(restaurantes), "A brand-new list must have 0 restaurants")

    # ── Caso 3: lista con 1 restaurante ──────────────────────────────────────

    def test_caso3_un_restaurante(self):
        """Caso 3 — adding 1 restaurant returns a restaurantes array of size 1."""
        self.post(self.favoritos_url(f"/listas/{self.lista_id}"), self.favorito_payload(PLACE_A))

        detail = self.get_json_object(self.favoritos_url(f"/listas/{self.lista_id}"))
        restaurantes = detail["restaurantes"]

        self.assertEqual(1, len(restaurantes), "After adding 1 restaurant the detail must return exactly 1")
        self.assertEqual(PLACE_A, restaurantes[0]["place_id"], "The place_id must match the added restaurant")

    # ── Caso 4: GET /api/favoritos/listas devuelve las listas del usuario ───

    def test_caso4_get_listas(self):
        """Caso 4 — GET /api/favoritos/listas returns a non-empty array with the created list."""
        listas = self.get_json_array(self.favoritos_url("/listas"))

        self.assertTrue(len(listas) > 0, "The listas array must not be empty after creating a list")
        found = any(lista["id"] == self.lista_id for lista in listas)
        self.assertTrue(found, f"The created list id={self.lista_id} must appear in GET /api/favoritos/listas")

    # ── Caso 5: eliminar un restaurante lo quita del detalle ────────────────

    def test_caso5_eliminar_restaurante(self):
        """Caso 5 — deleting a restaurant removes it from the list detail."""
        fav_id_a = self.add_favorito(self.lista_id, PLACE_A)
        self.post(self.favoritos_url(f"/listas/{self.lista_id}"), self.favorito_payload(PLACE_B))

        delete_status = self.delete(self.favoritos_url(f"/{fav_id_a}"))
        self.assertEqual(204, delete_status, "DELETE favorito must return HTTP 204")

        restaurantes = self.get_json_object(self.favoritos_url(f"/listas/{self.lista_id}"))["restaurantes"]

        self.assertFalse(self.contains_by_field(restaurantes, "place_id", PLACE_A),
                          "Deleted restaurant (PLACE_A) must not appear in list detail")
        self.assertTrue(self.contains_by_field(restaurantes, "place_id", PLACE_B),
                         "Non-deleted restaurant (PLACE_B) must still appear")

    # ── Caso 6: eliminar lista la quita de la colección ─────────────────────

    def test_caso6_eliminar_lista(self):
        """Caso 6 — deleting a list removes it from GET /api/favoritos/listas."""
        status = self.delete(self.favoritos_url(f"/listas/{self.lista_id}"))
        self.assertEqual(204, status, "DELETE lista must return HTTP 204")

        listas = self.get_json_array(self.favoritos_url("/listas"))
        still_present = any(lista["id"] == self.lista_id for lista in listas)
        self.assertFalse(still_present, "Deleted list must not appear in GET /api/favoritos/listas")

        # Prevent tearDown-less setUp from causing double-delete issues on the next test
        self.lista_id = -1
