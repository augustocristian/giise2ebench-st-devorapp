"""End-to-end smoke test of the Python-Node Puppeteer bridge against the running SUT."""
import pytest

from src.browser import Browser, BridgeProtocolError, ElementTimeoutError, Page, TestId

FORM = TestId.of("login-form")
IDENTIFIER = TestId.of("login-identifier")
PASSWORD = TestId.of("login-password")
SUBMIT = TestId.of("login-submit")
TOGGLE = TestId.of("login-toggle-password")
ERROR = TestId.of("login-message-error")


@pytest.fixture
async def login(page: Page, sut_url: str) -> Page:
    await page.goto(f"{sut_url}/login")
    await page.locator(FORM).wait_for("visible")
    return page


async def test_finds_form_and_reads_state(login: Page, sut_url: str):
    assert await login.url() == f"{sut_url}/login"
    assert await login.locator(FORM).count() == 1
    assert await login.locator(FORM).is_visible()
    assert await login.locator(SUBMIT).is_enabled()
    assert await login.locator(PASSWORD).attribute("type") == "password"
    assert await login.locator(PASSWORD).property("disabled") is False
    assert await login.locator(TestId.of("does-not-exist")).count() == 0
    assert not await login.locator(TestId.of("does-not-exist")).is_visible()


async def test_fill_type_and_clear(login: Page):
    identifier = login.locator(IDENTIFIER)
    await identifier.fill("someone@devorapp.test")
    assert await identifier.input_value() == "someone@devorapp.test"
    await identifier.fill("")
    assert await identifier.input_value() == ""
    await identifier.fill("overwritten")
    await identifier.fill("short")
    assert await identifier.input_value() == "short"
    await identifier.fill("")
    await identifier.type("abc", delay_ms=10)
    assert await identifier.input_value() == "abc"


async def test_click_toggles_and_wrong_login_shows_error(login: Page):
    password = login.locator(PASSWORD)
    await password.fill("secret-value")
    await login.locator(TOGGLE).click()
    assert await password.attribute("type") == "text"

    await login.locator(IDENTIFIER).fill("nobody@devorapp.test")
    await login.locator(ERROR).wait_for("hidden")
    await login.locator(SUBMIT).click()
    await login.locator(ERROR).wait_for("visible")
    assert await login.locator(ERROR).text()
    assert "/login" in await login.url()


async def test_press_enter_submits_form(login: Page):
    await login.locator(IDENTIFIER).fill("nobody@devorapp.test")
    await login.locator(PASSWORD).fill("wrong-password")
    await login.locator(PASSWORD).press("Enter")
    await login.locator(ERROR).wait_for("visible")


async def test_wait_for_states(login: Page):
    await login.locator(FORM).wait_for("attached")
    await login.locator(TestId.of("does-not-exist")).wait_for("hidden")
    await login.locator(TestId.of("does-not-exist")).wait_for("detached")
    await login.evaluate("() => document.querySelector('[data-testid=\"login-form\"]').remove()")
    await login.locator(FORM).wait_for("detached")
    await login.locator(FORM).wait_for("hidden")


async def test_evaluate_with_args_and_promises(login: Page):
    assert await login.evaluate("(a, b) => a + b", 2, 3) == 5
    greet = "async (name) => { await Promise.resolve(); return `hi ${name}`; }"
    assert await login.evaluate(greet, "bridge") == "hi bridge"
    assert await login.evaluate("() => location.pathname") == "/login"


async def test_init_script_runs_before_page_scripts(page: Page, sut_url: str):
    await page.add_init_script("(value) => { window.__injected = value; }", "from-init-script")
    await page.goto(f"{sut_url}/login")
    assert await page.evaluate("() => window.__injected") == "from-init-script"
    await page.reload()
    assert await page.evaluate("() => window.__injected") == "from-init-script"


async def test_contexts_are_isolated(browser: Browser, sut_url: str):
    first = await browser.new_page()
    second = await browser.new_page()
    try:
        await first.goto(f"{sut_url}/login")
        await second.goto(f"{sut_url}/login")
        await first.evaluate("() => { localStorage.setItem('k', 'v'); document.cookie = 'c=1'; }")
        assert await first.evaluate("() => localStorage.getItem('k')") == "v"
        assert await second.evaluate("() => localStorage.getItem('k')") is None
        assert any(c["name"] == "c" for c in await first.cookies())
        assert await second.cookies() == []
        await first.clear_storage()
        await first.clear_cookies()
        assert await first.evaluate("() => localStorage.getItem('k')") is None
        assert await first.cookies() == []
    finally:
        await first.close()
        await second.close()


async def test_nth_and_within_scoping(login: Page):
    inputs = login.locator(FORM).within("input")
    assert await inputs.count() >= 2
    assert await inputs.nth(0).attribute("data-testid") == "login-identifier"
    assert await inputs.nth(1).attribute("data-testid") == "login-password"
    assert await login.locator("input").nth(1).attribute("data-testid") == "login-password"
    assert await inputs.last().attribute("data-testid") in ("login-identifier", "login-password")
    await inputs.nth(0).fill("scoped")
    assert await login.locator(IDENTIFIER).input_value() == "scoped"
    assert await login.locator(FORM).within(PASSWORD).count() == 1
    assert await inputs.nth(99).count() == 0


async def test_scroll_screenshot_viewport_and_diagnostics(login: Page, tmp_path):
    await login.set_viewport(400, 600)
    await login.locator(SUBMIT).scroll_into_view()
    shot = await login.screenshot(tmp_path / "shots" / "login.png")
    assert shot.is_file() and shot.stat().st_size > 0
    await login.evaluate("() => console.error('bridge-diagnostic-probe')")
    entries = await login.diagnostics()
    assert any("bridge-diagnostic-probe" in e["text"] for e in entries)
    assert await login.diagnostics() == []


async def test_timeout_and_protocol_error_paths(login: Page):
    missing = login.locator(TestId.of("does-not-exist"), timeout_ms=500)
    with pytest.raises(ElementTimeoutError):
        await missing.click()
    with pytest.raises(ElementTimeoutError):
        await missing.wait_for("visible")
    with pytest.raises(ElementTimeoutError):
        await login.locator(FORM).with_timeout(500).wait_for("hidden")
    with pytest.raises(BridgeProtocolError):
        await login.evaluate("() => { throw new Error('boom'); }")
    with pytest.raises(BridgeProtocolError):
        await login.locator("###").with_timeout(500).count()
