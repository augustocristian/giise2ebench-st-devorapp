"""Locator-resolution helpers shared by page objects and the Waiter.

Pyppeteer's ``Page`` (and ``ElementHandle``) expose separate methods for CSS
(``querySelector``/``querySelectorAll``) and XPath (``xpath``) lookups. These
helpers dispatch on :class:`src.common.by.By` so callers can stay
locator-agnostic, the same way Selenium's ``findElement(By ...)`` does.
"""
from typing import List, Optional

from src.common.by import By


async def find(context, by: By):
    """Returns the first matching ElementHandle, or None. ``context`` is a
    Page or an ElementHandle (for relative lookups)."""
    if by.kind == "xpath":
        elements = await context.xpath(by.value)
        return elements[0] if elements else None
    return await context.querySelector(by.value)


async def find_all(context, by: By) -> List:
    """Returns all matching ElementHandles (possibly empty)."""
    if by.kind == "xpath":
        return await context.xpath(by.value)
    return await context.querySelectorAll(by.value)


async def is_present(context, by: By) -> bool:
    """True if at least one element matches ``by``. Mirrors BasePage.isVisible
    in the Java suite, which only checks DOM presence (not actual visibility)."""
    return len(await find_all(context, by)) > 0


async def text_of(page, element) -> str:
    if element is None:
        return ""
    value = await page.evaluate("(el) => el.textContent", element)
    return value or ""


async def attr_of(page, element, name: str) -> str:
    if element is None:
        return ""
    value = await page.evaluate("(el, n) => el.getAttribute(n)", element, name)
    return value or ""


async def is_enabled(page, element) -> bool:
    if element is None:
        return False
    disabled = await page.evaluate("(el) => !!el.disabled", element)
    return not disabled


async def is_selected(page, element) -> bool:
    if element is None:
        return False
    checked = await page.evaluate("(el) => !!el.checked", element)
    return bool(checked)


async def clear_and_type(page, element, text: Optional[str]) -> None:
    """Clears an <input>/<textarea> value, then types ``text`` (if any)."""
    await page.evaluate("(el) => { el.value = ''; }", element)
    if text:
        await element.type(text)
