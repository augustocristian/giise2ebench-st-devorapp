"""Port of epigijon.devorapp.e2e.functional.pages.RecommendPage.

Page object for ``/recommend-restaurants``.

Covers the search form (categories, price levels, boolean toggles, location
selector) and the results panel (suggestion cards).
"""
from src.common.by import By
from src.common.exceptions import ElementNotFoundException
from src.pages.base_page import BasePage
from src.utils import dom
from src.utils.click import click_element


class RecommendPage(BasePage):
    # Filters
    CATEGORY_INPUT = By.css("input[placeholder='+ Añadir tipo de cocina...']")
    SEARCH_BTN = By.xpath("//button[contains(.,'Buscar recomendaciones')]")
    LOC_PREF_RADIO = By.xpath("//label[contains(.,'Usar ubicación preferida')]//input")
    LOC_OTHER_RADIO = By.xpath("//label[contains(.,'Escoger otra ubicación')]//input")
    LOC_OTHER_INPUT = By.css("input[placeholder='Ej. Madrid, Barcelona...']")
    NO_PRICE_CHECK = By.xpath("//label[contains(.,'Incluir sitios sin precio confirmado')]//input")
    OPEN_NOW_CHECK = By.xpath("//label[contains(.,'Solo lugares abiertos ahora')]//input")

    # Results
    RESULT_CARDS = By.css(".suggestion-card")
    RESULTS_TITLE = By.xpath("//*[contains(text(),'Sugerencias para ti')]")
    ERROR_MSG = By.css(".message.error")

    async def _wait_ready(self) -> None:
        await self.waiter.wait_for_recommend_page()

    # ── Category tags ────────────────────────────────────────────────────────

    async def add_category(self, query: str, option_label: str) -> "RecommendPage":
        """Adds a cuisine category by typing ``query`` in the autocomplete
        input and clicking the option containing ``option_label``."""
        input_el = await dom.find(self.page, self.CATEGORY_INPUT)
        await click_element(self.page, self.waiter, input_el, "category-input")
        await dom.clear_and_type(self.page, input_el, query)

        option_by = By.xpath(
            "//input[@placeholder='+ Añadir tipo de cocina...']"
            f"/following-sibling::div//div[contains(text(),'{option_label}')]"
        )
        await self.waiter.wait_for_visible(option_by, f"Category dropdown option '{option_label}' did not appear")
        await self.click(option_by)
        return self

    # ── Price levels ─────────────────────────────────────────────────────────

    async def click_price(self, label: str) -> "RecommendPage":
        """Clicks the price button with the given label (e.g. "€", "€€", "€€€")."""
        buttons = await dom.find_all(self.page, By.tag("button"))
        target = None
        for button in buttons:
            text = (await dom.text_of(self.page, button)).strip()
            if text == label:
                target = button
                break
        if target is None:
            raise ElementNotFoundException(f"Price button '{label}' not found")
        await click_element(self.page, self.waiter, target, f"price[{label}]")
        return self

    # ── Boolean toggles ──────────────────────────────────────────────────────

    async def set_include_no_price(self, checked: bool) -> "RecommendPage":
        checkbox = await dom.find(self.page, self.NO_PRICE_CHECK)
        if (await dom.is_selected(self.page, checkbox)) != checked:
            await click_element(self.page, self.waiter, checkbox, "no-price-checkbox")
        return self

    async def set_open_now(self, checked: bool) -> "RecommendPage":
        checkbox = await dom.find(self.page, self.OPEN_NOW_CHECK)
        if (await dom.is_selected(self.page, checkbox)) != checked:
            await click_element(self.page, self.waiter, checkbox, "open-now-checkbox")
        return self

    # ── Location ─────────────────────────────────────────────────────────────

    async def select_preferred_location(self) -> "RecommendPage":
        await self.click(self.LOC_PREF_RADIO)
        return self

    async def select_other_location(self, location: str) -> "RecommendPage":
        await self.click(self.LOC_OTHER_RADIO)
        await self.fill(self.LOC_OTHER_INPUT, location)
        return self

    # ── Search ───────────────────────────────────────────────────────────────

    async def search(self) -> "RecommendPage":
        await self.click(self.SEARCH_BTN)
        return self

    # ── Results ──────────────────────────────────────────────────────────────

    async def get_result_count(self) -> int:
        return len(await dom.find_all(self.page, self.RESULT_CARDS))

    async def is_results_title_visible(self) -> bool:
        return await self.is_visible(self.RESULTS_TITLE)

    async def get_error_message(self) -> str:
        elements = await dom.find_all(self.page, self.ERROR_MSG)
        if not elements:
            return ""
        return await dom.text_of(self.page, elements[0])

    async def has_error_message(self) -> bool:
        return await self.is_visible(self.ERROR_MSG)
