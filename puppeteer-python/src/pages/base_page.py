"""Base class of the page objects.

Concrete pages locate elements only through ``TestId`` selectors. Puppeteer's
Locators auto-wait, so pages call them directly. ``__init__`` cannot be a
coroutine, so every page is built with the async ``create`` factory, which
waits for the page-specific readiness condition.
"""
import asyncio
import time
from collections.abc import Awaitable, Callable
from typing import Self

from src.browser import ElementTimeoutError, Locator, Page

POLL_INTERVAL_S = 0.1
DEFAULT_WAIT_S = 10.0


class BasePage:
    def __init__(self, page: Page) -> None:
        self.page = page

    @classmethod
    async def create(cls, page: Page) -> Self:
        """Builds the page object, then waits until it is ready."""
        instance = cls(page)
        await instance._wait_ready()
        return instance

    async def _wait_ready(self) -> None:
        """Page-specific readiness wait; none by default."""

    # Shared low-level helpers

    def locator(self, selector: str) -> Locator:
        return self.page.locator(selector)

    async def fill(self, selector: str, text: str) -> None:
        await self.locator(selector).fill(text)

    async def click(self, selector: str) -> None:
        await self.locator(selector).click()

    async def is_visible(self, selector: str) -> bool:
        return await self.locator(selector).is_visible()

    @staticmethod
    def any_of(*selectors: str) -> str:
        """Selector matching any of the given ones (CSS union)."""
        return ", ".join(selectors)

    @staticmethod
    async def text_or_empty(locator: Locator) -> str:
        """Text of the first match, or an empty string when there is none."""
        if await locator.count() == 0:
            return ""
        return await locator.first().text()

    @staticmethod
    async def wait_hidden(locator: Locator) -> None:
        """Waits until the locator is hidden or absent."""
        await locator.first().wait_for("hidden")

    @staticmethod
    async def wait_until(
        condition: Callable[[], Awaitable[bool]],
        description: str,
        timeout_s: float = DEFAULT_WAIT_S,
    ) -> None:
        """Polls an async condition until it holds or the timeout expires."""
        deadline = time.monotonic() + timeout_s
        while not await condition():
            if time.monotonic() > deadline:
                raise ElementTimeoutError(f"Timed out after {timeout_s}s waiting for: {description}")
            await asyncio.sleep(POLL_INTERVAL_S)

    async def wait_for_count(self, locator: Locator, expected: int) -> None:
        """Waits until the locator matches exactly ``expected`` elements."""
        async def matches() -> bool:
            return await locator.count() == expected

        await self.wait_until(matches, f"{locator} to match {expected} elements")
