"""Port of epigijon.devorapp.e2e.functional.pages.ProfilePage.

Page object for ``/profile``.

The profile page renders several card sections identified by their heading:
Información Personal, Ubicación Preferida, Correo Electrónico, Seguridad,
and Zona de Peligro. Each card exposes its own edit/save/cancel actions.
"""
from src.common.by import By
from src.common.exceptions import ElementNotFoundException
from src.pages.base_page import BasePage
from src.utils import dom
from src.utils.click import click_element


class ProfilePage(BasePage):
    # Card containers (located by heading text)
    CARDS = By.css(".location-info-card")

    # Toast notifications
    TOAST_SUCCESS = By.css(".toast.success")
    TOAST_ERROR = By.css(".toast.error")

    # Delete-account form
    DELETE_INPUT = By.id("delete-confirm-input")

    # Password change inputs
    CURRENT_PASS = By.id("current-password-input")
    NEW_PASS = By.id("new-password-input")
    CONFIRM_PASS = By.id("confirm-password-input")

    # Email change inputs
    EMAIL_INPUT = By.css("input[type='email']")
    EMAIL_PASS = By.id("email-password-input")

    async def _wait_ready(self) -> None:
        await self.waiter.wait_for_profile_page()

    # ── Card helpers ─────────────────────────────────────────────────────────

    async def _card_with(self, heading: str):
        """Returns the card ElementHandle whose text contains ``heading``
        (e.g. "Información Personal", "Seguridad")."""
        cards = await dom.find_all(self.page, self.CARDS)
        for card in cards:
            text = (await dom.text_of(self.page, card)).lower()
            if heading.lower() in text:
                return card
        raise ElementNotFoundException(f"Profile card not found: {heading}")

    async def get_card_text(self, heading: str) -> str:
        card = await self._card_with(heading)
        return await dom.text_of(self.page, card)

    async def click_button_in_card(self, heading: str, button_text: str) -> "ProfilePage":
        card = await self._card_with(heading)
        buttons = await dom.find_all(card, By.tag("button"))
        target = None
        for button in buttons:
            if button_text in (await dom.text_of(self.page, button)):
                target = button
                break
        if target is None:
            raise ElementNotFoundException(f"Button '{button_text}' not found in card: {heading}")
        await click_element(self.page, self.waiter, target, f"{heading}::{button_text}")
        return self

    async def fill_input_in_card(self, heading: str, index: int, value: str) -> "ProfilePage":
        card = await self._card_with(heading)
        inputs = await dom.find_all(card, By.tag("input"))
        if index >= len(inputs):
            raise ElementNotFoundException(f"Input #{index} not found in card: {heading}")
        await dom.clear_and_type(self.page, inputs[index], value)
        return self

    # ── Personal info ────────────────────────────────────────────────────────

    async def edit_personal_info(self) -> "ProfilePage":
        return await self.click_button_in_card("Información Personal", "Editar")

    async def save_personal_info(self) -> "ProfilePage":
        return await self.click_button_in_card("Información Personal", "Guardar cambios")

    async def cancel_personal_info(self) -> "ProfilePage":
        return await self.click_button_in_card("Información Personal", "Cancelar")

    # ── Email change ─────────────────────────────────────────────────────────

    async def open_email_change(self) -> "ProfilePage":
        return await self.click_button_in_card("Correo Electrónico", "Cambiar")

    async def fill_new_email(self, email: str) -> "ProfilePage":
        await self.fill(self.EMAIL_INPUT, email)
        return self

    async def fill_email_password(self, password: str) -> "ProfilePage":
        await self.fill(self.EMAIL_PASS, password)
        return self

    async def submit_email_change(self) -> "ProfilePage":
        return await self.click_button_in_card("Correo Electrónico", "Cambiar correo")

    # ── Password change ─────────────────────────────────────────────────────

    async def open_password_change(self) -> "ProfilePage":
        return await self.click_button_in_card("Seguridad", "Cambiar contraseña")

    async def fill_password_change(self, current: str, new_pass: str, confirm: str) -> "ProfilePage":
        current_el = await dom.find(self.page, self.CURRENT_PASS)
        await dom.clear_and_type(self.page, current_el, current)
        new_el = await dom.find(self.page, self.NEW_PASS)
        await dom.clear_and_type(self.page, new_el, new_pass)
        confirm_el = await dom.find(self.page, self.CONFIRM_PASS)
        await dom.clear_and_type(self.page, confirm_el, confirm)
        return self

    async def submit_password_change(self) -> "ProfilePage":
        return await self.click_button_in_card("Seguridad", "Actualizar contraseña")

    # ── Delete account ───────────────────────────────────────────────────────

    async def open_delete_account(self) -> "ProfilePage":
        return await self.click_button_in_card("Zona de Peligro", "Eliminar cuenta permanentemente")

    async def fill_delete_confirm(self, text: str) -> "ProfilePage":
        await self.fill(self.DELETE_INPUT, text)
        return self

    async def submit_delete_account(self) -> "ProfilePage":
        return await self.click_button_in_card("Zona de Peligro", "Eliminar permanentemente")

    async def is_delete_button_enabled(self) -> bool:
        card = await self._card_with("Zona de Peligro")
        buttons = await dom.find_all(card, By.tag("button"))
        for button in buttons:
            if "Eliminar permanentemente" in (await dom.text_of(self.page, button)):
                return await dom.is_enabled(self.page, button)
        raise ElementNotFoundException("Delete button not found")

    # ── Toast queries ────────────────────────────────────────────────────────

    async def has_success_toast(self) -> bool:
        return await self.is_visible(self.TOAST_SUCCESS)

    async def get_success_toast_text(self) -> str:
        toasts = await dom.find_all(self.page, self.TOAST_SUCCESS)
        if not toasts:
            return ""
        return await dom.text_of(self.page, toasts[-1])

    async def has_error_toast(self) -> bool:
        return await self.is_visible(self.TOAST_ERROR)

    async def get_error_toast_text(self) -> str:
        toasts = await dom.find_all(self.page, self.TOAST_ERROR)
        if not toasts:
            return ""
        return await dom.text_of(self.page, toasts[-1])

    async def dismiss_success_toast(self) -> "ProfilePage":
        toasts = await dom.find_all(self.page, self.TOAST_SUCCESS)
        if toasts:
            await click_element(self.page, self.waiter, toasts[-1], "success-toast")
        return self

    async def dismiss_error_toast(self) -> "ProfilePage":
        toasts = await dom.find_all(self.page, self.TOAST_ERROR)
        if toasts:
            await click_element(self.page, self.waiter, toasts[-1], "error-toast")
        return self
