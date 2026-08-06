"""Port of epigijon.devorapp.e2e.functional.pages.BasePage.

Encapsulates the Puppeteer ``page`` and :class:`~src.utils.waiter.Waiter`
references and exposes low-level helpers (fill, click, is_visible) so
concrete pages never call ``page.querySelector``/``page.xpath`` directly.

Puppeteer's page construction is inherently asynchronous (locating elements,
waiting for readiness), while Python ``__init__`` cannot be a coroutine. The
Java suite relies on a blocking constructor that waits before returning; here
that behaviour is provided by the :meth:`create` async factory, which every
concrete page object uses in place of ``new XxxPage(driver, waiter)``.
"""
from src.common.by import By
from src.common.exceptions import ElementNotFoundException
from src.utils import dom
from src.utils.click import click_element


class BasePage:
    def __init__(self, page, waiter):
        self.page = page
        self.waiter = waiter

    @classmethod
    async def create(cls, page, waiter):
        """Async factory: builds the page object then waits until it is
        ready, mirroring the blocking-constructor pattern of the Java page
        objects (``new LoginPage(driver, waiter)`` etc.)."""
        instance = cls(page, waiter)
        await instance._wait_ready()
        return instance

    async def _wait_ready(self) -> None:
        """Overridden by subclasses: waits for the page-specific readiness
        condition. No-op by default."""
        return None

    # ── Shared low-level helpers ─────────────────────────────────────────────

    async def fill(self, by: By, text: str) -> None:
        element = await dom.find(self.page, by)
        if element is None:
            raise ElementNotFoundException(f"Element not found: {by}")
        await dom.clear_and_type(self.page, element, text)

    async def click(self, by: By) -> None:
        element = await dom.find(self.page, by)
        if element is None:
            raise ElementNotFoundException(f"Element not found: {by}")
        await click_element(self.page, self.waiter, element, str(by))

    async def is_visible(self, by: By) -> bool:
        return await dom.is_present(self.page, by)
