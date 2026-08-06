"""Exceptions raised by the Puppeteer bridge client."""


class BrowserError(Exception):
    """Base class for every error coming from the browser layer."""


class BridgeProtocolError(BrowserError):
    """The bridge answered with an error (bad selector, closed page, ...)."""


class ElementTimeoutError(BrowserError):
    """Puppeteer timed out waiting for an element, state or navigation."""


class BridgeTimeoutError(BrowserError):
    """The bridge did not answer at all within the client-side deadline."""


class BridgeCrashedError(BrowserError):
    """The Node process exited or closed its pipes; carries its stderr."""
