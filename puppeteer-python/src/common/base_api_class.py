"""Port of epigijon.devorapp.e2e.functional.common.BaseApiClass.

Base class for DevorApp API tests. Provides HTTP request helpers, JSON
payload builders, auth lifecycle (register_and_login / delete_test_user),
and fixture creation methods.

``requests.Session`` plays the role of the Java suite's shared
``CloseableHttpClient`` + ``BasicCookieStore``: the JWT ``access_token``
cookie issued on login is automatically sent on every subsequent request
made through the same session.
"""
import logging
import time
import unittest
from typing import Iterable

import requests

from src.common.config import get_sut_api_url, load_properties

log = logging.getLogger(__name__)

# A stable Google Places ID used as a test restaurant in all test classes.
TEST_PLACE_ID = "ChIJN1t_tDeuEmsRUsoyG83frY4"


class BaseApiClass(unittest.TestCase):
    properties: dict = {}
    sut_url: str = ""
    session: requests.Session = None

    test_username: str = None
    test_email: str = None
    test_password: str = None

    @classmethod
    def setUpClass(cls) -> None:
        log.info("Starting API test global setup")
        cls.properties = load_properties()
        cls.sut_url = get_sut_api_url(cls.properties)
        log.info("API base URL: %s", cls.sut_url)
        cls.session = requests.Session()

    @classmethod
    def tearDownClass(cls) -> None:
        if cls.session is not None:
            cls.session.close()
            log.info("Shared HTTP session closed")

    # ── URL builders ─────────────────────────────────────────────────────────

    def auth_url(self, path: str) -> str:
        return f"{self.sut_url}/api{path}"

    def favoritos_url(self, path: str) -> str:
        return f"{self.sut_url}/api/favoritos{path}"

    def historial_url(self, path: str) -> str:
        return f"{self.sut_url}/api/historial{path}"

    def mas_tarde_url(self, path: str) -> str:
        return f"{self.sut_url}/api/mas-tarde{path}"

    def valoraciones_url(self, path: str) -> str:
        return f"{self.sut_url}/api/valoraciones{path}"

    def recommendations_url(self, path: str) -> str:
        return f"{self.sut_url}/api/recommendations{path}"

    # ── HTTP verbs ───────────────────────────────────────────────────────────

    def get(self, url: str):
        response = self.session.get(url, headers={"Accept": "application/json"})
        log.debug("GET %s -> %s", url, response.status_code)
        return response

    def get_status(self, url: str) -> int:
        return self.get(url).status_code

    def get_json(self, url: str):
        return self.get(url).json()

    # Aliases kept for readability parity with the Java getJsonObject/getJsonArray split.
    def get_json_object(self, url: str) -> dict:
        return self.get_json(url)

    def get_json_array(self, url: str) -> list:
        return self.get_json(url)

    def post(self, url: str, payload: dict):
        response = self.session.post(url, json=payload, headers={"Accept": "application/json"})
        log.debug("POST %s -> %s", url, response.status_code)
        return response

    def post_status(self, url: str, payload: dict) -> int:
        return self.post(url, payload).status_code

    def post_json_object(self, url: str, payload: dict) -> dict:
        return self.post(url, payload).json()

    def patch(self, url: str, payload: dict) -> int:
        response = self.session.patch(url, json=payload, headers={"Accept": "application/json"})
        log.debug("PATCH %s -> %s", url, response.status_code)
        return response.status_code

    def delete(self, url: str) -> int:
        response = self.session.delete(url, headers={"Accept": "application/json"})
        log.debug("DELETE %s -> %s", url, response.status_code)
        return response.status_code

    def delete_with_query(self, url: str, query_param: str, value: str) -> int:
        response = self.session.delete(url, params={query_param: value}, headers={"Accept": "application/json"})
        log.debug("DELETE %s?%s=%s -> %s", url, query_param, value, response.status_code)
        return response.status_code

    @staticmethod
    def contains_by_field(items: Iterable[dict], field_name: str, expected: str) -> bool:
        return any(isinstance(item, dict) and item.get(field_name) == expected for item in items)

    # ── Uniqueness helpers ───────────────────────────────────────────────────

    @staticmethod
    def unique() -> int:
        return int(time.time() * 1000)

    @staticmethod
    def unique_email(ts: int) -> str:
        return f"testuser{ts}@devorapp.test"

    @staticmethod
    def unique_username(ts: int) -> str:
        raw = f"tst{ts}"
        return raw[-30:] if len(raw) > 30 else raw

    # ── Auth lifecycle ───────────────────────────────────────────────────────

    @classmethod
    def register_and_login(cls, username: str, email: str, password: str) -> None:
        """Registers a new test user via POST /api/register, then logs in
        via POST /api/login. The JWT cookie is captured automatically by the
        shared session."""
        cls.test_username = username
        cls.test_email = email
        cls.test_password = password

        reg_body = cls.register_payload(username, email, password, "Test", "User", "")
        reg_response = cls.session.post(f"{cls.sut_url}/api/register", json=reg_body,
                                         headers={"Accept": "application/json"})
        log.info("Registered test user: %s / %s, status: %s", username, email, reg_response.status_code)

        login_body = cls.login_payload(email, password)
        login_response = cls.session.post(f"{cls.sut_url}/api/login", json=login_body,
                                           headers={"Accept": "application/json"})
        log.info("Logged in test user, status: %s", login_response.status_code)

    @classmethod
    def delete_test_user(cls) -> None:
        """Deletes the test user account. Call from tearDownClass."""
        if cls.test_email is None or cls.test_password is None:
            return
        try:
            response = cls.session.delete(
                f"{cls.sut_url}/api/profile",
                params={"password": cls.test_password},
                headers={"Accept": "application/json"},
            )
            log.info("Deleted test user %s -> HTTP %s", cls.test_email, response.status_code)
        except Exception as e:
            log.warning("Could not delete test user %s: %s", cls.test_email, e)

    # ── Payload builders ─────────────────────────────────────────────────────

    @staticmethod
    def register_payload(username: str, email: str, password: str,
                          nombre: str, apellidos: str, ubicacion: str) -> dict:
        return {
            "username": username,
            "email": email,
            "password": password,
            "nombre": nombre,
            "apellidos": apellidos,
            "ubicacion": ubicacion,
        }

    @staticmethod
    def login_payload(identifier: str, password: str) -> dict:
        return {"identifier": identifier, "password": password}

    @staticmethod
    def lista_payload(nombre: str, icono: str = "Heart") -> dict:
        return {"nombre": nombre, "icono": icono}

    @staticmethod
    def favorito_payload(place_id: str) -> dict:
        return {"place_id": place_id}

    @staticmethod
    def mas_tarde_payload(place_id: str) -> dict:
        return {"place_id": place_id}

    @staticmethod
    def historial_payload(place_id: str) -> dict:
        return {"place_id": place_id}

    @staticmethod
    def valoracion_payload(place_id: str, calidad: int, precio: int,
                            higiene: int, trato: int, comentario: str) -> dict:
        return {
            "place_id": place_id,
            "calidad": calidad,
            "precio": precio,
            "higiene": higiene,
            "trato": trato,
            "comentario": comentario,
        }

    @staticmethod
    def profile_update_payload(nombre: str, apellidos: str, ubicacion: str, password: str) -> dict:
        return {"nombre": nombre, "apellidos": apellidos, "ubicacion": ubicacion, "password": password}

    @staticmethod
    def populares_payload(limit: int) -> dict:
        return {"limit": limit}

    @staticmethod
    def search_payload(categories: list, prices: list, include_unconfirmed_price: bool,
                        location: str, max_results: int, open_now: bool = None) -> dict:
        """Builds the request body for POST /api/recommendations/search."""
        payload = {
            "categories": list(categories),
            "prices": list(prices),
            "include_unconfirmed_price": include_unconfirmed_price,
            "location": location,
            "sort_by": "rating",
            "max_results": max_results,
        }
        if open_now is not None:
            payload["open_now"] = open_now
        return payload

    # ── CRUD helpers ─────────────────────────────────────────────────────────

    def create_lista(self, nombre: str) -> int:
        """Creates a favorite list and returns its assigned id."""
        response = self.post_json_object(self.favoritos_url("/listas"), self.lista_payload(nombre))
        return response["id"]

    def add_favorito(self, lista_id: int, place_id: str) -> int:
        """Adds a restaurant to a list and returns the favorito id."""
        response = self.post_json_object(self.favoritos_url(f"/listas/{lista_id}"), self.favorito_payload(place_id))
        return response["id"]

    def add_historial(self, place_id: str) -> int:
        """Adds a restaurant to historial and returns the entry id."""
        response = self.post_json_object(self.historial_url(""), self.historial_payload(place_id))
        return response["id"]

    def add_mas_tarde(self, place_id: str) -> int:
        """Adds a restaurant to mas-tarde and returns the entry id."""
        response = self.post_json_object(self.mas_tarde_url(""), self.mas_tarde_payload(place_id))
        return response["id"]

    def create_valoracion(self, place_id: str, calidad: int, precio: int,
                           higiene: int, trato: int, comentario: str) -> dict:
        """Creates a valoracion and returns the full response object."""
        return self.post_json_object(
            self.valoraciones_url(""),
            self.valoracion_payload(place_id, calidad, precio, higiene, trato, comentario),
        )

    def get_default_lista_id(self) -> int:
        """Returns the id of the first lista named "Favoritos" in the user's
        lista collection, or -1 if not found."""
        listas = self.get_json_array(self.favoritos_url("/listas"))
        for lista in listas:
            if lista.get("nombre") == "Favoritos":
                return lista["id"]
        return -1
