"""Port of epigijon.devorapp.e2e.functional.pages.RegisterPage.

Page object for ``/register``. Covers both registration steps:
  * Step 1 — email, username, password, nombre, apellidos.
  * Step 2 — location (GPS button or manual text) and final submit.

``create()`` blocks until the form (step 1) is visible.
"""
from src.common.by import By
from src.pages.base_page import BasePage
from src.utils import dom


class RegisterPage(BasePage):
    FORM = By.id("register-form")

    # Step 1
    EMAIL = By.id("reg-email")
    USERNAME = By.id("reg-username")
    PASSWORD = By.id("reg-password")
    NOMBRE = By.id("reg-nombre")
    APELLIDOS = By.id("reg-apellidos")
    CONTINUE_BTN = By.id("register-continue-btn")

    # Step 2
    GPS_BTN = By.id("use-gps-btn")
    UBICACION = By.id("reg-ubicacion")
    SUBMIT_BTN = By.id("register-submit-btn")
    BACK_BTN = By.id("register-back-btn")

    # Feedback
    ERROR_MSG = By.css(".message.error")
    EMAIL_ERROR = By.id("email-error")
    USER_ERROR = By.id("username-error")
    STEP1_LABEL = By.xpath("//*[contains(text(),'Paso 1 de 2')]")
    STEP2_LABEL = By.xpath("//*[contains(text(),'Paso 2 de 2')]")
    VERIFY_MSG = By.xpath("//*[contains(text(),'Verifica tu correo')]")
    LOC_NAME = By.css(".location-detected-name")

    async def _wait_ready(self) -> None:
        await self.waiter.wait_for_register_page()

    # ── Step 1 actions ───────────────────────────────────────────────────────

    async def enter_email(self, email: str) -> "RegisterPage":
        await self.fill(self.EMAIL, email)
        return self

    async def enter_username(self, username: str) -> "RegisterPage":
        await self.fill(self.USERNAME, username)
        return self

    async def enter_password(self, password: str) -> "RegisterPage":
        await self.fill(self.PASSWORD, password)
        return self

    async def enter_nombre(self, nombre: str) -> "RegisterPage":
        await self.fill(self.NOMBRE, nombre)
        return self

    async def enter_apellidos(self, apellidos: str) -> "RegisterPage":
        await self.fill(self.APELLIDOS, apellidos)
        return self

    async def click_continue(self) -> "RegisterPage":
        """Clicks "Continuar" to advance to step 2."""
        await self.click(self.CONTINUE_BTN)
        return self

    # ── Step 2 actions ───────────────────────────────────────────────────────

    async def click_use_gps(self) -> "RegisterPage":
        await self.click(self.GPS_BTN)
        return self

    async def enter_ubicacion(self, location: str) -> "RegisterPage":
        """Types a location manually into the text field (without selecting
        from the autocomplete dropdown)."""
        await self.fill(self.UBICACION, location)
        return self

    async def click_submit(self) -> "RegisterPage":
        await self.click(self.SUBMIT_BTN)
        return self

    async def click_back(self) -> "RegisterPage":
        await self.click(self.BACK_BTN)
        return self

    async def wait_for_step2(self) -> "RegisterPage":
        await self.waiter.wait_for_visible(self.STEP2_LABEL, "Register page did not advance to Step 2")
        return self

    # ── State queries ────────────────────────────────────────────────────────

    async def get_error_message(self) -> str:
        element = await dom.find(self.page, self.ERROR_MSG)
        return await dom.text_of(self.page, element)

    async def get_email_error(self) -> str:
        element = await dom.find(self.page, self.EMAIL_ERROR)
        return await dom.text_of(self.page, element)

    async def get_username_error(self) -> str:
        element = await dom.find(self.page, self.USER_ERROR)
        return await dom.text_of(self.page, element)

    async def is_on_step1(self) -> bool:
        return await self.is_visible(self.STEP1_LABEL)

    async def is_on_step2(self) -> bool:
        return await self.is_visible(self.STEP2_LABEL)

    async def is_verify_email_visible(self) -> bool:
        return await self.is_visible(self.VERIFY_MSG)

    async def get_detected_location_text(self) -> str:
        element = await dom.find(self.page, self.LOC_NAME)
        return await dom.text_of(self.page, element)

    async def is_loaded(self) -> bool:
        return await self.is_visible(self.FORM)
