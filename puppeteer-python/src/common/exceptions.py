from src.browser.errors import ElementTimeoutError


class ElementNotFoundException(Exception):
    """Raised when a page object cannot resolve an element by index or text."""


__all__ = ["ElementNotFoundException", "ElementTimeoutError"]
