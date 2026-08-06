"""Base class for DevorApp API tests.

Provides HTTP helpers, JSON payload builders, the auth lifecycle
(register_and_login / delete_test_user) and fixture creation helpers for the
versioned REST API (``/api/v1``).

A shared ``requests.Session`` keeps the ``access_token`` cookie issued on login,
so every later request made through it is authenticated.
"""
from __future__ import annotations

import logging
import time
from typing import Iterable

import requests

from src.common.config import get_sut_api_url, load_properties

log = logging.getLogger(__name__)

API_PREFIX = "/api/v1"
JSON_HEADERS = {"Accept": "application/json"}

# A stable restaurant id served by the mock Places API.
TEST_PLACE_ID = "MOCK_PLACE_101"


class ApiResult:
    """Response wrapper exposing the status, the Location header and the JSON body."""

    def __init__(self, response: requests.Response) -> None:
        self.response = response

    @property
    def status(self) -> int:
        return self.response.status_code

    @property
    def location(self) -> str | None:
        return self.response.headers.get("Location")

    @property
    def body(self) -> str:
        return self.response.text

    def json(self):
        return self.response.json()


class BaseApiClass:
    properties: dict = {}
    sut_url: str = ""
    session: requests.Session | None = None

    test_username: str | None = None
    test_email: str | None = None
    test_password: str | None = None

    @classmethod
    def setup_class(cls) -> None:
        log.info("Starting API test global setup")
        cls.properties = load_properties()
        cls.sut_url = get_sut_api_url(cls.properties)
        log.info("API base URL: %s", cls.sut_url)
        cls.session = requests.Session()

    @classmethod
    def teardown_class(cls) -> None:
        if cls.session is not None:
            cls.session.close()
            log.info("Shared HTTP session closed")

    # ── URL builders ─────────────────────────────────────────────────────────

    def auth_url(self, path: str) -> str:
        return f"{self.sut_url}{API_PREFIX}{path}"

    def favorites_url(self, path: str) -> str:
        return f"{self.sut_url}{API_PREFIX}/favorites{path}"

    def history_url(self, path: str) -> str:
        return f"{self.sut_url}{API_PREFIX}/history{path}"

    def saved_for_later_url(self, path: str) -> str:
        return f"{self.sut_url}{API_PREFIX}/saved-for-later{path}"

    def ratings_url(self, path: str) -> str:
        return f"{self.sut_url}{API_PREFIX}/ratings{path}"

    def restaurants_url(self, path: str) -> str:
        return f"{self.sut_url}{API_PREFIX}/restaurants{path}"

    def recommendations_url(self, path: str) -> str:
        return f"{self.sut_url}{API_PREFIX}/recommendations{path}"

    # ── HTTP verbs ───────────────────────────────────────────────────────────

    def send(self, method: str, url: str, payload: dict | None = None) -> ApiResult:
        """Sends a request through the shared session and wraps the response."""
        response = self.session.request(method, url, json=payload, headers=JSON_HEADERS)
        log.debug("%s %s -> %s", method, url, response.status_code)
        return ApiResult(response)

    def get_status(self, url: str) -> int:
        return self.send("GET", url).status

    def get_json(self, url: str):
        return self.send("GET", url).json()

    def get_json_object(self, url: str) -> dict:
        return self.get_json(url)

    def get_json_array(self, url: str) -> list:
        return self.get_json(url)

    def get_items(self, url: str) -> list:
        """Returns the ``items`` of a paginated response."""
        return self.get_json(url)["items"]

    def post(self, url: str, payload: dict | None = None) -> ApiResult:
        return self.send("POST", url, payload)

    def post_status(self, url: str, payload: dict | None = None) -> int:
        return self.send("POST", url, payload).status

    def post_json_object(self, url: str, payload: dict | None = None) -> dict:
        return self.send("POST", url, payload).json()

    def put(self, url: str, payload: dict) -> ApiResult:
        return self.send("PUT", url, payload)

    def patch(self, url: str, payload: dict) -> int:
        return self.send("PATCH", url, payload).status

    def delete(self, url: str) -> int:
        return self.send("DELETE", url).status

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
        """Registers a test user (POST /users) and logs in (POST /sessions);
        the shared session keeps the auth cookie."""
        cls.test_username = username
        cls.test_email = email
        cls.test_password = password

        reg_body = cls.register_payload(username, email, password, "Test", "User", "")
        reg_response = cls.session.post(f"{cls.sut_url}{API_PREFIX}/users", json=reg_body, headers=JSON_HEADERS)
        log.info("Registered test user: %s / %s, status: %s", username, email, reg_response.status_code)

        login_response = cls.session.post(f"{cls.sut_url}{API_PREFIX}/sessions",
                                          json=cls.login_payload(email, password), headers=JSON_HEADERS)
        log.info("Logged in test user, status: %s", login_response.status_code)

    @classmethod
    def delete_test_user(cls) -> None:
        """Deletes the test user account. Call from teardown_class."""
        if cls.test_email is None or cls.test_password is None:
            return
        try:
            response = cls.session.delete(
                f"{cls.sut_url}{API_PREFIX}/profile",
                params={"password": cls.test_password},
                headers=JSON_HEADERS,
            )
            log.info("Deleted test user %s -> HTTP %s", cls.test_email, response.status_code)
        except requests.RequestException as e:
            log.warning("Could not delete test user %s: %s", cls.test_email, e)

    @classmethod
    def new_client(cls, username: str, email: str, password: str) -> requests.Session:
        """Registers a user and returns a separate logged-in session (the caller closes it)."""
        client = requests.Session()
        client.post(f"{cls.sut_url}{API_PREFIX}/users",
                    json=cls.register_payload(username, email, password, "Other", "User", ""),
                    headers=JSON_HEADERS)
        client.post(f"{cls.sut_url}{API_PREFIX}/sessions",
                    json=cls.login_payload(email, password), headers=JSON_HEADERS)
        return client

    @classmethod
    def delete_client_user(cls, client: requests.Session, password: str) -> None:
        """Deletes the account of a session created by new_client."""
        client.delete(f"{cls.sut_url}{API_PREFIX}/profile", params={"password": password}, headers=JSON_HEADERS)

    # ── Payload builders ─────────────────────────────────────────────────────

    @staticmethod
    def register_payload(username: str, email: str, password: str,
                         first_name: str, last_name: str, location: str) -> dict:
        return {
            "username": username,
            "email": email,
            "password": password,
            "first_name": first_name,
            "last_name": last_name,
            "location": location,
        }

    @staticmethod
    def login_payload(identifier: str, password: str) -> dict:
        return {"identifier": identifier, "password": password}

    @staticmethod
    def list_payload(name: str, icon: str = "Heart") -> dict:
        return {"name": name, "icon": icon}

    @staticmethod
    def place_payload(place_id: str) -> dict:
        return {"place_id": place_id}

    @staticmethod
    def rating_payload(quality: int, price: int, hygiene: int, service: int, comment: str) -> dict:
        return {
            "quality": quality,
            "price": price,
            "hygiene": hygiene,
            "service": service,
            "comment": comment,
        }

    @staticmethod
    def profile_update_payload(first_name: str, last_name: str, location: str, password: str) -> dict:
        return {"first_name": first_name, "last_name": last_name, "location": location, "password": password}

    @staticmethod
    def search_payload(categories: list, prices: list, include_unconfirmed_price: bool,
                       location: str, max_results: int, open_now: bool | None = None) -> dict:
        """Builds the request body for POST /recommendations/search."""
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

    def create_list(self, name: str) -> int:
        """Creates a favorite list and returns its id."""
        return self.post_json_object(self.favorites_url("/lists"), self.list_payload(name))["id"]

    def add_favorite(self, list_id: int, place_id: str) -> int:
        """Adds a restaurant to a list and returns the favorite id."""
        url = self.favorites_url(f"/lists/{list_id}/restaurants")
        return self.post_json_object(url, self.place_payload(place_id))["id"]

    def add_history(self, place_id: str) -> int:
        """Adds a history entry and returns its id."""
        return self.post_json_object(self.history_url(""), self.place_payload(place_id))["id"]

    def add_saved_for_later(self, place_id: str) -> int:
        """Saves a restaurant for later and returns the entry id."""
        return self.post_json_object(self.saved_for_later_url(""), self.place_payload(place_id))["id"]

    def put_rating(self, place_id: str, quality: int, price: int,
                   hygiene: int, service: int, comment: str) -> ApiResult:
        """Creates or replaces the user's rating of a restaurant."""
        return self.put(self.restaurants_url(f"/{place_id}/rating"),
                        self.rating_payload(quality, price, hygiene, service, comment))

    def create_rating(self, place_id: str, quality: int, price: int,
                      hygiene: int, service: int, comment: str) -> dict:
        """Creates a rating and returns the response body."""
        return self.put_rating(place_id, quality, price, hygiene, service, comment).json()

    def get_default_list_id(self) -> int:
        """Returns the id of the user's "Favoritos" list, or -1 if not found."""
        for favorite_list in self.get_json_array(self.favorites_url("/lists")):
            if favorite_list.get("name") == "Favoritos":
                return favorite_list["id"]
        return -1
