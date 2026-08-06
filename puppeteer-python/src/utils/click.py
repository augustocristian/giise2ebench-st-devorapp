"""Port of epigijon.devorapp.e2e.functional.utils.Click.

Tries a native click first; if the element isn't reliably clickable (covered,
off-screen, mid-animation) falls back to dispatching a synthetic MouseEvent
via JS, exactly like the Java ``Click.byJS`` fallback.
"""
import logging

from src.common.exceptions import ElementNotFoundException
from src.utils import dom

log = logging.getLogger(__name__)


async def click_element(page, waiter, element, description: str = ""):
    """Clicks ``element`` (an ElementHandle), waiting until it is clickable.
    Raises ElementNotFoundException if both the native and JS click fail.
    """
    try:
        await waiter.wait_for_clickable_element(element, f"Element not clickable: {description}")
        await element.click()
        log.debug("click_element: %s ==>OK", description)
        return
    except Exception:
        log.exception("click_element: %s ==>KO", description)

    try:
        await click_by_js(page, element)
        log.debug("click_element by JS: %s ==>OK", description)
        return
    except Exception:
        log.exception("click_element by JS: %s ==>KO", description)

    raise ElementNotFoundException(f"click_element ERROR for {description}")


async def click_locator(page, waiter, by, description: str = ""):
    """Resolves ``by`` to an element and clicks it. Used by tests that need
    a one-off click not modelled by any page object (e.g. side-menu
    navigation buttons), mirroring the raw ``driver.findElement(By...)``
    calls the Java tests make directly in the same situations."""
    element = await dom.find(page, by)
    if element is None:
        raise ElementNotFoundException(f"Element not found: {by}")
    await click_element(page, waiter, element, description or str(by))
    return element


async def click_by_js(page, element) -> None:
    await page.evaluate(
        "(el) => {"
        "  var evt = document.createEvent('MouseEvents');"
        "  evt.initMouseEvent('click', true, true, window, 0, 0, 0, 0, 0, false, false, false, false, 0, null);"
        "  el.dispatchEvent(evt);"
        "}",
        element,
    )
