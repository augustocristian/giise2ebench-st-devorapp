"""Base class for the DevorApp browser tests.

A plain pytest class, so async tests and fixtures work natively:

1. Browser: the session-wide ``browser`` and the per-test ``page`` fixtures
   live in ``conftest.py``; the autouse fixture below exposes the page as
   ``self.page`` (every test gets its own isolated browser context).
2. Test user: ``setup_test_user`` / ``teardown_test_user`` create and delete a
   real backend user through the API, so a subclass needs only a few lines in
   ``setup_class`` / ``teardown_class``.

Tests interact with the UI exclusively through the page objects in ``src.pages``.
"""
import logging

import pytest_asyncio
import requests

from src.browser import Page
from src.common.config import get_sut_api_url, get_sut_frontend_url, get_tjob_name, load_properties

log = logging.getLogger(__name__)

# Fake Google Places Autocomplete; replaces any real google object already loaded by the page.
AUTOCOMPLETE_MOCK_JS = """() => {
    const mockAutocompleteClass = class {
      constructor(input, options) {
        window.mockAutocompleteInstance = this;
        this.input = input;
      }
      addListener(event, callback) {
        if (!this.listeners) this.listeners = {};
        if (!this.listeners[event]) this.listeners[event] = [];
        this.listeners[event].push(callback);
        return { remove: () => {} };
      }
      getPlace() {
        return { formatted_address: this.input ? this.input.value : 'Barcelona, España' };
      }
      setTypes() {}
      setBounds() {}
      setFields() {}
      setComponentRestrictions() {}
      getBounds() { return {}; }
      getFields() { return []; }
      setOptions() {}
    };
    const lock = (target, name, value) =>
      Object.defineProperty(target, name, { value, writable: false, configurable: false });
    const mockPlaces = {};
    lock(mockPlaces, 'Autocomplete', mockAutocompleteClass);
    const mockMaps = {};
    lock(mockMaps, 'places', mockPlaces);
    const mockGoogle = {};
    lock(mockGoogle, 'maps', mockMaps);
    lock(window, 'google', mockGoogle);
}"""

# Polls inside the page, so no Python-side waiting is needed.
TRIGGER_PLACE_CHANGED_JS = """async () => {
    const deadline = Date.now() + 10000;
    while (!window.mockAutocompleteInstance?.listeners?.['place_changed']) {
        if (Date.now() > deadline) {
            throw new Error("Mock Autocomplete 'place_changed' listener was never registered");
        }
        await new Promise((resolve) => setTimeout(resolve, 50));
    }
    window.mockAutocompleteInstance.listeners['place_changed'].forEach((cb) => cb());
}"""

API_PREFIX = "/api/v1"
_JSON_HEADERS = {"Accept": "application/json"}


class BaseLoggedClass:
    properties: dict = {}
    sut_url: str = ""
    api_base: str = ""
    api_client: requests.Session | None = None

    # Credentials of the class-level test user (set by setup_test_user).
    test_username: str | None = None
    test_email: str | None = None
    test_password: str | None = None
    _extra_users: list[tuple[str, str]] | None = None

    page: Page

    # ── Class-level lifecycle ───────────────────────────────────────────────

    @classmethod
    def setup_class(cls) -> None:
        cls.properties = load_properties()
        cls.sut_url = get_sut_frontend_url(cls.properties)
        cls.api_base = get_sut_api_url(cls.properties)
        cls.api_client = requests.Session()
        cls._extra_users = []
        log.info("Browser base URL: %s (TJOB_NAME=%s)", cls.sut_url, get_tjob_name())

    @classmethod
    def teardown_class(cls) -> None:
        if cls.api_client is not None:
            cls.api_client.close()
            cls.api_client = None

    # ── Per-test lifecycle ───────────────────────────────────────────────────

    @pytest_asyncio.fixture(autouse=True, loop_scope="session")
    async def _open_app(self, page: Page):
        """Binds the isolated page to ``self.page`` and opens the SUT."""
        self.page = page
        await page.goto(self.sut_url)
        yield

    async def clear_session(self) -> None:
        """Clears cookies, localStorage, sessionStorage and IndexedDB."""
        # Storage is per origin, so the page must be on the SUT (any cheap file will do).
        await self.page.goto(self.sut_url + "/vite.svg")
        await self.page.clear_cookies()
        await self.page.clear_storage()

    async def go_to_login(self) -> None:
        """Starts from a clean session and opens /login."""
        await self.clear_session()
        await self.page.goto(self.sut_url + "/login")

    # ── Test-user helpers ────────────────────────────────────────────────────

    @classmethod
    def _register(cls, username: str, email: str, password: str) -> None:
        payload = {
            "username": username,
            "email": email,
            "password": password,
            "first_name": "UITester",
            "last_name": "Test",
            "location": "Gijón",
        }
        cls.api_client.post(f"{cls.api_base}{API_PREFIX}/users", json=payload, headers=_JSON_HEADERS)

    @classmethod
    def setup_test_user(cls, username: str, email: str, password: str) -> None:
        """Registers a new test user via POST /api/v1/users and stores the
        credentials for later teardown. Call from a subclass ``setup_class``
        (after ``super().setup_class()``)."""
        cls.test_username = username
        cls.test_email = email
        cls.test_password = password
        cls._register(username, email, password)
        log.info("Registered browser test user: %s", email)

    @classmethod
    def register_email_for_cleanup(cls, email: str, password: str) -> None:
        """Registers a username/email/password created during a test so it
        is cleaned up automatically in :meth:`teardown_test_user`."""
        cls._extra_users.append((email, password))

    @classmethod
    def register_user_api(cls, username: str, email: str, password: str) -> None:
        """Registers a new test user via POST /api/v1/users directly,
        without storing the credentials as the class's primary test user (to
        avoid session pollution for other tests)."""
        cls.register_email_for_cleanup(email, password)
        cls._register(username, email, password)
        log.info("Registered API-only test user: %s", email)

    @classmethod
    def _delete_user(cls, email: str, password: str) -> None:
        cls.api_client.post(
            f"{cls.api_base}{API_PREFIX}/sessions",
            json={"identifier": email, "password": password},
            headers=_JSON_HEADERS,
        )
        cls.api_client.delete(
            f"{cls.api_base}{API_PREFIX}/profile",
            params={"password": password},
            headers=_JSON_HEADERS,
        )

    @classmethod
    def teardown_test_user(cls) -> None:
        """Logs in and calls DELETE /api/v1/profile to permanently remove the
        test user created by :meth:`setup_test_user`, as well as any extra
        users registered during the test. Call from a subclass
        ``teardown_class`` (before ``super().teardown_class()``)."""
        extra_users, cls._extra_users = cls._extra_users or [], []
        for extra_email, extra_password in extra_users:
            try:
                cls._delete_user(extra_email, extra_password)
                log.info("Deleted extra registered test user: %s", extra_email)
            except Exception as e:
                log.warning("Could not delete extra registered test user %s: %s", extra_email, e)

        if cls.test_email is None or cls.test_password is None:
            return
        try:
            cls._delete_user(cls.test_email, cls.test_password)
            log.info("Deleted browser test user: %s", cls.test_email)
        except Exception as e:
            log.warning("Could not delete browser test user %s: %s", cls.test_email, e)
        finally:
            cls.test_email = cls.test_password = cls.test_username = None

    def api_post(self, url: str, payload: dict) -> dict:
        """POSTs a JSON body to the given absolute URL using the shared API
        client. Already authenticated if :meth:`setup_test_user` was called.
        Returns the parsed JSON response body."""
        response = self.api_client.post(url, json=payload, headers=_JSON_HEADERS)
        return response.json()

    def api_login(self) -> None:
        """Logs in the test user (using ``self.test_email``/``self.test_password``)
        with the shared API client so that subsequent :meth:`api_post` /
        :meth:`api_delete` calls carry the JWT session cookie."""
        self.api_client.post(
            f"{self.api_base}{API_PREFIX}/sessions",
            json={"identifier": self.test_email, "password": self.test_password},
            headers=_JSON_HEADERS,
        )

    def api_delete(self, url: str) -> int:
        """DELETEs the given absolute URL using the shared API client.
        Returns the HTTP status code."""
        return self.api_client.delete(url, headers=_JSON_HEADERS).status_code

    # ── Google Maps Autocomplete mock ───────────────────────────────────────

    async def inject_autocomplete_mock(self) -> None:
        """Installs the Google Maps Autocomplete mock in the current document.
        Call it after the page loaded and before the component under test mounts."""
        await self.page.evaluate(AUTOCOMPLETE_MOCK_JS)

    async def trigger_autocomplete_place_changed(self) -> None:
        """Waits for the mock Autocomplete instance to register a
        'place_changed' listener, then triggers all its callbacks."""
        await self.page.evaluate(TRIGGER_PLACE_CHANGED_JS)
