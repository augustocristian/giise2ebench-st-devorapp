"""Port of epigijon.devorapp.e2e.functional.common.BaseLoggedClass.

Base class for all DevorApp browser (Puppeteer) tests. Manages two concerns:

1. **Browser lifecycle** — launches a single Chromium instance once per test
   class (mirroring Selema's ``setManageAtClass()``) and hands a fresh
   Puppeteer ``page`` + :class:`~src.utils.waiter.Waiter` to each test
   method, clearing cookies/storage between tests.
2. **Test-user lifecycle** — provides ``setup_test_user`` / ``teardown_test_user``
   so every subclass creates and deletes a real backend user with a couple
   of lines, without duplicating HTTP-client boilerplate.

Tests interact with the UI exclusively through the page objects in
``src.pages``.

Async/event-loop note
----------------------
Pyppeteer's ``Browser``/``Page`` objects are bound to the asyncio event loop
that created them, and ``unittest.IsolatedAsyncioTestCase`` creates a *new*
event loop per test method — which would invalidate a browser shared across
tests. Instead, this class owns a single, persistent event loop for the
whole test class (created in ``setUpClass``, closed in ``tearDownClass``)
and the :func:`async_test` decorator below drives every async test method
through that same loop via ``loop.run_until_complete``.
"""
import functools
import logging
import time
import unittest
from typing import Dict, List, Tuple, Type

import requests
from pyppeteer import launch

from src.common.config import (
    get_chromium_executable_path,
    get_sut_frontend_url,
    get_tjob_name,
    is_headless,
    load_properties,
)
from src.utils.waiter import Waiter

log = logging.getLogger(__name__)


def async_test(coro_func):
    """Decorator that runs an ``async def test_xxx(self)`` method to
    completion on the test case's persistent event loop, so it can be
    collected and run as a plain (synchronous) unittest/pytest test."""

    @functools.wraps(coro_func)
    def wrapper(self, *args, **kwargs):
        return self.run_async(coro_func(self, *args, **kwargs))

    return wrapper


class BaseLoggedClass(unittest.TestCase):
    properties: dict = {}
    sut_url: str = ""
    loop = None
    browser = None
    api_client: requests.Session = None

    _class_emails: Dict[Type, str] = {}
    _class_passwords: Dict[Type, str] = {}
    _class_usernames: Dict[Type, str] = {}
    _class_registered_users: Dict[Type, List[Tuple[str, str]]] = {}

    # ── Class-level (browser) lifecycle ─────────────────────────────────────

    @classmethod
    def setUpClass(cls) -> None:
        import asyncio

        cls.properties = load_properties()
        cls.sut_url = get_sut_frontend_url(cls.properties)
        log.info("Browser base URL: %s", cls.sut_url)

        headless = is_headless(cls.properties)
        args = ["--start-maximized", "--incognito"]
        if headless:
            log.info("Running Chromium in headless mode.")
            args.append("--headless=new")

        launch_kwargs = dict(headless=headless, args=args, defaultViewport=None, handleSIGINT=False,
                             handleSIGTERM=False, handleSIGHUP=False)
        executable_path = get_chromium_executable_path()
        if executable_path:
            log.info("Using pinned browser executable: %s", executable_path)
            launch_kwargs["executablePath"] = executable_path

        cls.loop = asyncio.new_event_loop()
        cls.browser = cls.loop.run_until_complete(launch(**launch_kwargs))
        cls.api_client = requests.Session()
        log.info("Browser and API client initialised (TJOB_NAME=%s).", get_tjob_name())

    @classmethod
    def tearDownClass(cls) -> None:
        if cls.browser is not None:
            cls.loop.run_until_complete(cls.browser.close())
            cls.browser = None
        if cls.api_client is not None:
            cls.api_client.close()
            cls.api_client = None
        if cls.loop is not None:
            cls.loop.close()
            cls.loop = None

    def run_async(self, coro):
        return self.loop.run_until_complete(coro)

    # ── Per-test lifecycle ───────────────────────────────────────────────────

    def setUp(self) -> None:
        log.info("Starting: %s", self.id())
        self.page = self.loop.run_until_complete(self.browser.newPage())
        self.waiter = Waiter(self.page)
        self.loop.run_until_complete(self.page.goto(self.sut_url))
        self.loop.run_until_complete(self.clear_session())

        cls = type(self)
        self.test_email = self._class_emails.get(cls)
        self.test_password = self._class_passwords.get(cls)
        self.test_username = self._class_usernames.get(cls)

    def tearDown(self) -> None:
        log.info("Finished: %s", self.id())
        self.loop.run_until_complete(self.page.close())

    async def clear_session(self) -> None:
        """Clears cookies, localStorage, sessionStorage, and deletes all
        IndexedDB databases (where Firebase stores JWT tokens)."""
        try:
            await self.page.goto(self.sut_url + "/vite.svg")
        except Exception:
            pass
        try:
            cookies = await self.page.cookies()
            if cookies:
                await self.page.deleteCookie(*cookies)
        except Exception:
            pass
        try:
            await self.page.evaluate("() => window.localStorage.clear()")
        except Exception:
            pass
        try:
            await self.page.evaluate("() => window.sessionStorage.clear()")
        except Exception:
            pass
        try:
            await self.page.evaluate(
                """async () => {
                    if (window.indexedDB && window.indexedDB.databases) {
                        const dbs = await window.indexedDB.databases();
                        await Promise.all(dbs.map((db) => new Promise((resolve) => {
                            const req = window.indexedDB.deleteDatabase(db.name);
                            req.onsuccess = () => resolve();
                            req.onerror = () => resolve();
                            req.onblocked = () => resolve();
                        })));
                    }
                }"""
            )
        except Exception:
            pass

    async def go_to_login(self) -> None:
        """Convenience helper equivalent to the Java suite's repeated
        ``clearSession(); driver.get(sutUrl + "/login");`` snippet."""
        await self.clear_session()
        await self.page.goto(self.sut_url + "/login")

    # ── Test-user helpers ────────────────────────────────────────────────────

    @classmethod
    def setup_test_user(cls, username: str, email: str, password: str) -> None:
        """Registers a new test user via POST /api/register and stores the
        credentials for later teardown. Call from a subclass ``setUpClass``
        (after ``super().setUpClass()``)."""
        cls._class_usernames[cls] = username
        cls._class_emails[cls] = email
        cls._class_passwords[cls] = password

        api_base = cls.properties.get("LOCALHOST_URL", "http://localhost:8000")
        payload = {
            "username": username,
            "email": email,
            "password": password,
            "nombre": "UITester",
            "apellidos": "Test",
            "ubicacion": "Gijón",
        }
        cls.api_client.post(f"{api_base}/api/register", json=payload, headers={"Accept": "application/json"})
        log.info("Registered browser test user: %s", email)

    @classmethod
    def register_email_for_cleanup(cls, email: str, password: str) -> None:
        """Registers a username/email/password created during a test so it
        is cleaned up automatically in :meth:`teardown_test_user`."""
        cls._class_registered_users.setdefault(cls, []).append((email, password))

    @classmethod
    def register_user_api(cls, username: str, email: str, password: str) -> None:
        """Registers a new test user via POST /api/register directly,
        without storing the credentials as the class's primary test user (to
        avoid session pollution for other tests)."""
        cls.register_email_for_cleanup(email, password)
        api_base = cls.properties.get("LOCALHOST_URL", "http://localhost:8000")
        payload = {
            "username": username,
            "email": email,
            "password": password,
            "nombre": "UITester",
            "apellidos": "Test",
            "ubicacion": "Gijón",
        }
        cls.api_client.post(f"{api_base}/api/register", json=payload, headers={"Accept": "application/json"})
        log.info("Registered API-only test user: %s", email)

    @classmethod
    def teardown_test_user(cls) -> None:
        """Logs in and calls DELETE /api/profile to permanently remove the
        test user created by :meth:`setup_test_user`, as well as any extra
        users registered during the test. Call from a subclass
        ``tearDownClass`` (before ``super().tearDownClass()``)."""
        api_base = cls.properties.get("LOCALHOST_URL", "http://localhost:8000")

        extra_users = cls._class_registered_users.pop(cls, [])
        for extra_email, extra_password in extra_users:
            try:
                cls.api_client.post(
                    f"{api_base}/api/login",
                    json={"identifier": extra_email, "password": extra_password},
                    headers={"Accept": "application/json"},
                )
                cls.api_client.delete(
                    f"{api_base}/api/profile",
                    params={"password": extra_password},
                    headers={"Accept": "application/json"},
                )
                log.info("Deleted extra registered test user: %s", extra_email)
            except Exception as e:
                log.warning("Could not delete extra registered test user %s: %s", extra_email, e)

        email = cls._class_emails.get(cls)
        password = cls._class_passwords.get(cls)
        if email is None or password is None:
            return
        try:
            cls.api_client.post(
                f"{api_base}/api/login",
                json={"identifier": email, "password": password},
                headers={"Accept": "application/json"},
            )
            cls.api_client.delete(
                f"{api_base}/api/profile",
                params={"password": password},
                headers={"Accept": "application/json"},
            )
            log.info("Deleted browser test user: %s", email)
        except Exception as e:
            log.warning("Could not delete browser test user %s: %s", email, e)
        finally:
            cls._class_emails.pop(cls, None)
            cls._class_passwords.pop(cls, None)
            cls._class_usernames.pop(cls, None)

    def api_post(self, url: str, payload: dict) -> dict:
        """POSTs a JSON body to the given absolute URL using the shared API
        client. Already authenticated if :meth:`setup_test_user` was called.
        Returns the parsed JSON response body."""
        response = self.api_client.post(url, json=payload, headers={"Accept": "application/json"})
        return response.json()

    def api_login(self) -> None:
        """Logs in the test user (using ``self.test_email``/``self.test_password``)
        with the shared API client so that subsequent :meth:`api_post` /
        :meth:`api_delete` calls carry the JWT session cookie."""
        api_base = self.properties.get("LOCALHOST_URL", "http://localhost:8000")
        self.api_client.post(
            f"{api_base}/api/login",
            json={"identifier": self.test_email, "password": self.test_password},
            headers={"Accept": "application/json"},
        )

    def api_delete(self, url: str) -> int:
        """DELETEs the given absolute URL using the shared API client.
        Returns the HTTP status code."""
        return self.api_client.delete(url, headers={"Accept": "application/json"}).status_code

    # ── Google Maps Autocomplete mock ───────────────────────────────────────

    async def inject_autocomplete_mock(self) -> None:
        """Injects a bulletproof Google Maps Autocomplete mock into the window object."""
        await self.page.evaluate(
            """() => {
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
                    return {
                      formatted_address: this.input ? this.input.value : 'Barcelona, España'
                    };
                  }
                  setTypes() {}
                  setBounds() {}
                  setFields() {}
                  setComponentRestrictions() {}
                  getBounds() { return {}; }
                  getFields() { return []; }
                  setOptions() {}
                };
                const mockPlaces = {};
                Object.defineProperty(mockPlaces, 'Autocomplete', { value: mockAutocompleteClass, writable: false, configurable: false });
                const mockMaps = {};
                Object.defineProperty(mockMaps, 'places', { value: mockPlaces, writable: false, configurable: false });
                const mockGoogle = {};
                Object.defineProperty(mockGoogle, 'maps', { value: mockMaps, writable: false, configurable: false });
                Object.defineProperty(window, 'google', { value: mockGoogle, writable: false, configurable: false });
            }"""
        )

    async def trigger_autocomplete_place_changed(self) -> None:
        """Waits for the mock Autocomplete instance to be initialized and
        have a 'place_changed' listener, then triggers all its callbacks."""
        await self.waiter.wait_until(
            lambda: self.page.evaluate(
                "() => window.mockAutocompleteInstance?.listeners?.['place_changed'] !== undefined"
            ),
            "Mock Autocomplete 'place_changed' listener was never registered",
        )
        await self.page.evaluate(
            "() => window.mockAutocompleteInstance.listeners['place_changed'].forEach((cb) => cb())"
        )
