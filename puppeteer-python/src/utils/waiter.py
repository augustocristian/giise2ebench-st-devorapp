"""Port of epigijon.devorapp.e2e.functional.utils.Waiter.

Centralised explicit-wait utility for DevorApp page objects. Each
``wait_for_*`` method corresponds to a specific page-readiness condition and
is called by the matching page-object factory (see pages/base_page.py).

Pyppeteer has no direct equivalent of Selenium's ``WebDriverWait`` +
``ExpectedConditions`` combinator, so this class implements the same idea as
a small async polling loop (``wait_until``) driven by boolean predicates
built on top of ``src.utils.dom``.
"""
import asyncio
import logging

from src.common.by import By
from src.utils import dom

log = logging.getLogger(__name__)

WAIT_SECONDS = 20
POLL_INTERVAL_SECONDS = 0.25


class WaiterTimeoutError(TimeoutError):
    pass


class Waiter:
    def __init__(self, page):
        self.page = page

    # ── Generic polling primitive ───────────────────────────────────────────

    async def wait_until(self, predicate, error_message: str,
                          timeout: float = WAIT_SECONDS,
                          interval: float = POLL_INTERVAL_SECONDS) -> None:
        """Polls ``predicate`` (a zero-arg async callable returning bool)
        until it returns True or ``timeout`` seconds elapse."""
        elapsed = 0.0
        last_error = None
        while elapsed < timeout:
            try:
                if await predicate():
                    return
            except Exception as e:  # transient DOM errors (detached nodes, etc.)
                last_error = e
            await asyncio.sleep(interval)
            elapsed += interval
        log.error(error_message)
        suffix = f" ({last_error})" if last_error else ""
        raise WaiterTimeoutError(f'"{error_message}" > timed out after {timeout}s{suffix}')

    # ── Locator-based conditions ────────────────────────────────────────────

    async def wait_for_visible(self, by: By, error_message: str, timeout: float = WAIT_SECONDS) -> None:
        await self.wait_until(lambda: dom.is_present(self.page, by), error_message, timeout)

    async def wait_for_invisible(self, by: By, error_message: str, timeout: float = WAIT_SECONDS) -> None:
        async def predicate():
            return not await dom.is_present(self.page, by)
        await self.wait_until(predicate, error_message, timeout)

    async def wait_for_any_visible(self, locators, error_message: str, timeout: float = WAIT_SECONDS) -> None:
        async def predicate():
            for by in locators:
                if await dom.is_present(self.page, by):
                    return True
            return False
        await self.wait_until(predicate, error_message, timeout)

    async def wait_for_text_in(self, by: By, text: str, error_message: str, timeout: float = WAIT_SECONDS) -> None:
        async def predicate():
            element = await dom.find(self.page, by)
            return text in (await dom.text_of(self.page, element))
        await self.wait_until(predicate, error_message, timeout)

    async def wait_for_text_not_in(self, by: By, text: str, error_message: str, timeout: float = WAIT_SECONDS) -> None:
        async def predicate():
            element = await dom.find(self.page, by)
            if element is None:
                return False
            return text not in (await dom.text_of(self.page, element))
        await self.wait_until(predicate, error_message, timeout)

    async def wait_for_url_contains(self, fragment: str, error_message: str, timeout: float = WAIT_SECONDS) -> None:
        async def predicate():
            return fragment in self.page.url
        await self.wait_until(predicate, error_message, timeout)

    async def wait_for_clickable_element(self, element, error_message: str, timeout: float = WAIT_SECONDS) -> None:
        async def predicate():
            if element is None:
                return False
            box = await element.boundingBox()
            if box is None:
                return False
            return await dom.is_enabled(self.page, element)
        await self.wait_until(predicate, error_message, timeout)

    # ── Named page-readiness waits (mirrors Java Waiter one-to-one) ────────

    async def wait_for_login_page(self):
        await self.wait_for_visible(By.id("login-form"), "Login page did not load")

    async def wait_for_home_page(self):
        await self.wait_for_url_contains("/home", "Home page did not load after login")

    async def wait_for_register_page(self):
        await self.wait_for_visible(By.id("reg-email"), "Register page did not load")

    async def wait_for_login_error(self):
        await self.wait_for_visible(By.css(".message.error"), "Login error message did not appear")

    async def wait_for_top_bar(self):
        await self.wait_for_visible(By.css(".topbar, header, nav"), "Top navigation bar did not appear")

    async def wait_for_favorites_page(self):
        await self.wait_for_any_visible(
            [
                By.css(".fav-list-card"),
                By.xpath("//*[contains(text(),'Aún no tienes listas')]"),
                By.css(".favorites-container, .fav-page"),
            ],
            "Favorites page did not load",
        )

    async def wait_for_history_page(self):
        await self.wait_for_any_visible(
            [
                By.css(".history-group-title"),
                By.css("input[placeholder='Buscar en historial...']"),
                By.css(".history-container, .history-page"),
            ],
            "History page did not load",
        )

    async def wait_for_recommend_page(self):
        await self.wait_for_visible(
            By.xpath("//button[contains(.,'Buscar recomendaciones')]"), "Recommend page did not load"
        )
        pref_loc_label = By.xpath("//label[contains(.,'Usar ubicación preferida')]")
        await self.wait_for_visible(pref_loc_label, "Preferred location radio label did not appear")
        await self.wait_for_text_not_in(
            pref_loc_label, "Desconocida",
            "Preferred location did not load in time (remained 'Desconocida')",
        )

    async def wait_for_profile_page(self):
        await self.wait_for_visible(By.css(".location-info-card"), "Profile page did not load")

    async def wait_for_side_menu_drawer(self):
        await self.wait_for_visible(By.css(".sidemenu-drawer"), "Side menu drawer did not open")

    async def wait_for_toast(self, toast_type: str):
        await self.wait_for_visible(By.css(f".toast.{toast_type}"), f"Toast of type '{toast_type}' did not appear")
