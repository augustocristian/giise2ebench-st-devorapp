"""Typed, lazy wrappers over the bridge: Browser, Page and Locator."""
import logging
from pathlib import Path
from typing import Any, Literal, Self

from src.browser.client import BridgeClient
from src.browser.errors import BrowserError

log = logging.getLogger(__name__)

WaitState = Literal["visible", "hidden", "attached", "detached"]
DEFAULT_TIMEOUT_MS = 10_000
NAVIGATION_TIMEOUT_MS = 30_000

Chain = tuple[tuple[str, int | None], ...]


class Browser:
    """One Chrome process driven by Puppeteer through the Node bridge."""

    def __init__(self, client: BridgeClient) -> None:
        self._client = client
        self.version = ""

    @classmethod
    async def launch(
        cls,
        headless: bool = True,
        executable_path: str | None = None,
        args: list[str] | None = None,
        node_binary: str | None = None,
    ) -> Self:
        """Starts the bridge and launches Chrome (system Chrome unless a path is given)."""
        client = BridgeClient(node_binary)
        await client.start()
        browser = cls(client)
        try:
            info = await client.request("browser.launch", {
                "headless": headless,
                "executablePath": executable_path,
                "args": args or [],
            }, timeout=120.0)
        except BaseException:
            await client.close()
            raise
        browser.version = info["version"]
        log.info("Browser launched: %s (headless=%s)", browser.version, headless)
        return browser

    async def new_context(self) -> "BrowserContext":
        """Creates an isolated context (own cookies and storage)."""
        result = await self._client.request("context.new")
        return BrowserContext(self._client, result["context"])

    async def new_page(self) -> "Page":
        """Page in a fresh context; closing the page also closes that context."""
        context = await self.new_context()
        return await context.new_page(owns_context=True)

    async def close(self) -> None:
        """Closes Chrome and stops the bridge."""
        try:
            await self._client.request("browser.close", timeout=30.0)
        except BrowserError as error:
            log.warning("Browser did not close cleanly: %s", error)
        finally:
            await self._client.close()

    async def __aenter__(self) -> Self:
        return self

    async def __aexit__(self, *exc_info: object) -> None:
        await self.close()


class BrowserContext:
    def __init__(self, client: BridgeClient, context_id: str) -> None:
        self._client = client
        self._id = context_id

    async def new_page(self, owns_context: bool = False) -> "Page":
        result = await self._client.request("page.new", {"context": self._id})
        return Page(self._client, result["page"], self, owns_context)

    async def close(self) -> None:
        await self._client.request("context.close", {"context": self._id})


class Page:
    def __init__(self, client: BridgeClient, page_id: str, context: BrowserContext,
                 owns_context: bool = False) -> None:
        self._client = client
        self._id = page_id
        self._context = context
        self._owns_context = owns_context

    async def _call(self, method: str, timeout_ms: int | None = None, **params: Any) -> Any:
        if timeout_ms is not None:
            params["timeout"] = timeout_ms
        return await self._client.request(
            method, {"page": self._id, **params}, timeout=BridgeClient.deadline(timeout_ms))

    def locator(self, selector: str, timeout_ms: int = DEFAULT_TIMEOUT_MS) -> "Locator":
        """Lazy locator for a CSS selector, normally ``TestId.of(...)``."""
        return Locator(self, ((selector, None),), timeout_ms)

    async def goto(self, url: str, timeout_ms: int = NAVIGATION_TIMEOUT_MS) -> None:
        """Navigates and waits for DOMContentLoaded (external fonts must not block; locators auto-wait)."""
        await self._call("page.goto", timeout_ms, url=url)

    async def reload(self, timeout_ms: int = NAVIGATION_TIMEOUT_MS) -> None:
        await self._call("page.reload", timeout_ms)

    async def url(self) -> str:
        """Current URL."""
        return await self._call("page.url")

    async def title(self) -> str:
        return await self._call("page.title")

    async def evaluate(self, script: str, *args: Any) -> Any:
        """Runs a JS function expression, e.g. ``"(a, b) => a + b"``, with JSON args; awaits promises."""
        return await self._call("page.evaluate", script=script, args=list(args))

    async def add_init_script(self, script: str, *args: Any) -> None:
        """Runs a JS function expression in every new document before the page scripts (mocks, stubs)."""
        await self._call("page.addInitScript", script=script, args=list(args))

    async def press_key(self, key: str) -> None:
        """Presses a key on whatever has focus, e.g. ``"Enter"``."""
        await self._call("page.pressKey", key=key)

    async def set_viewport(self, width: int, height: int) -> None:
        await self._call("page.setViewport", width=width, height=height)

    async def clear_storage(self) -> None:
        """Clears localStorage, sessionStorage and IndexedDB of the current origin."""
        await self._call("page.clearStorage")

    async def clear_cookies(self) -> None:
        await self._call("page.clearCookies")

    async def cookies(self) -> list[dict[str, Any]]:
        """All cookies of this page's context."""
        return await self._call("page.cookies")

    async def screenshot(self, path: str | Path, full_page: bool = True) -> Path:
        """Saves a PNG and returns its absolute path."""
        target = Path(path).resolve()
        await self._call("page.screenshot", path=str(target), fullPage=full_page)
        return target

    async def diagnostics(self, clear: bool = True) -> list[dict[str, Any]]:
        """Captured console errors/warnings, page errors and failed requests."""
        return await self._call("page.diagnostics", clear=clear)

    async def close(self) -> None:
        """Closes the page (and its context when created through Browser.new_page)."""
        await self._call("page.close")
        if self._owns_context:
            await self._context.close()


class Locator:
    """Immutable, lazy element reference; Puppeteer auto-waits when an action runs."""

    def __init__(self, page: Page, chain: Chain, timeout_ms: int) -> None:
        self._page = page
        self._chain = chain
        self._timeout_ms = timeout_ms

    def __repr__(self) -> str:
        steps = (css if nth is None else f"{css}[{nth}]" for css, nth in self._chain)
        return "Locator(" + " >> ".join(steps) + ")"

    def _derive(self, chain: Chain, timeout_ms: int | None = None) -> "Locator":
        return Locator(self._page, chain, timeout_ms or self._timeout_ms)

    def nth(self, index: int) -> "Locator":
        """The index-th (0-based, negative from the end) match of this locator."""
        css, _ = self._chain[-1]
        return self._derive(self._chain[:-1] + ((css, index),))

    def first(self) -> "Locator":
        return self.nth(0)

    def last(self) -> "Locator":
        return self.nth(-1)

    def within(self, selector: str) -> "Locator":
        """Elements matching selector below the elements of this locator."""
        return self._derive(self._chain + ((selector, None),))

    def with_timeout(self, timeout_ms: int) -> "Locator":
        """Same locator with a different auto-wait timeout."""
        return self._derive(self._chain, timeout_ms)

    async def _call(self, method: str, **params: Any) -> Any:
        return await self._page._call(
            method, self._timeout_ms, chain=[list(step) for step in self._chain], **params)

    async def click(self) -> None:
        """Waits until visible, enabled and stable, scrolls into view, then clicks."""
        await self._call("element.click")

    async def fill(self, value: str) -> None:
        """Clears the field and sets the value; an empty string really clears."""
        await self._call("element.fill", value=value)

    async def type(self, text: str, delay_ms: int = 0) -> None:
        """Focuses the element and types key by key."""
        await self._call("element.type", text=text, delay=delay_ms)

    async def press(self, key: str) -> None:
        """Focuses the element and presses a key, e.g. ``"Enter"``."""
        await self._call("element.press", key=key)

    async def hover(self) -> None:
        await self._call("element.hover")

    async def scroll_into_view(self) -> None:
        await self._call("element.scrollIntoView")

    async def text(self) -> str:
        """Text content, waiting for the element to exist."""
        return await self._call("element.text")

    async def input_value(self) -> str:
        """Current value of an input, textarea or select."""
        return await self._call("element.value")

    async def attribute(self, name: str) -> str | None:
        return await self._call("element.attribute", name=name)

    async def property(self, name: str) -> Any:
        """A DOM property such as ``checked`` or ``disabled``."""
        return await self._call("element.property", name=name)

    async def count(self) -> int:
        """Number of matches right now; never waits."""
        return await self._call("element.count")

    async def is_visible(self) -> bool:
        """Whether the first match is visible right now; never waits."""
        return await self._call("element.isVisible")

    async def is_enabled(self) -> bool:
        """Whether the first match exists and is not disabled; never waits."""
        return await self._call("element.isEnabled")

    async def wait_for(self, state: WaitState = "visible") -> None:
        """Waits for visible, hidden, attached or detached; raises ElementTimeoutError."""
        await self._call("element.waitFor", state=state)
