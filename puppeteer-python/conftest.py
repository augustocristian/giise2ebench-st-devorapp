# conftest.py
import logging
import os
import re
import sys
from pathlib import Path

import pytest
import pytest_asyncio

# Guarantees "src"/"tests" are importable even if the project hasn't been
# installed with `poetry install` (e.g. a bare `pip install -r` or CI runner
# invoking pytest directly). See tests/context.py for the same bootstrap,
# kept for structural parity with the reference project template.
ROOT_DIR = Path(__file__).resolve().parent
if str(ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(ROOT_DIR))

from src.browser import Browser, Page  # noqa: E402
from src.common.config import (  # noqa: E402
    get_browser_args,
    get_browser_executable_path,
    get_sut_frontend_url,
    is_headed,
    load_properties,
)

logger = logging.getLogger(__name__)

SCREENSHOT_DIR = ROOT_DIR / "reports" / "screenshots"


def pytest_runtest_setup(item):
    logger.debug("Starting setup of the Test: " + item.name)

    logger.debug("Ending setup of the Test: " + item.name)


def pytest_runtest_teardown(item):
    logger.debug("Starting teardown of the Test: " + item.name)

    logger.debug("Ending teardown of the Test: " + item.name)


def pytest_collection_modifyitems(items):
    """Auto-tags tests with the ``api``/``e2e``/``bridge`` markers declared in
    pyproject.toml based on their path, so ``pytest -m api`` / ``pytest -m
    e2e`` work without decorating every test class (mirrors ``mvn test
    -Dtest="TestApi*"`` vs ``-Dtest="Test*View,TestSideMenu"`` in the
    selenium-java suite)."""
    for item in items:
        path = str(item.fspath)
        for marker in ("api", "e2e", "bridge"):
            if f"{os.sep}{marker}{os.sep}" in path:
                item.add_marker(marker)
                break


@pytest.hookimpl(wrapper=True)
def pytest_runtest_makereport(item, call):
    # Exposes each phase's report so fixtures can react to a failed test.
    report = yield
    setattr(item, f"rep_{report.when}", report)
    return report


@pytest.fixture(scope="session")
def sut_url() -> str:
    """Frontend base URL: SUT_URL env var > FRONTEND_URL property."""
    return get_sut_frontend_url(load_properties())


@pytest_asyncio.fixture(scope="session", loop_scope="session")
async def browser():
    """One Chrome for the whole session; HEADED=1 shows it."""
    instance = await Browser.launch(
        headless=not is_headed(),
        executable_path=get_browser_executable_path(),
        args=get_browser_args(),
    )
    yield instance
    await instance.close()


@pytest_asyncio.fixture(loop_scope="session")
async def page(request, browser: Browser):
    """A page in its own isolated context, discarded after each test."""
    current: Page = await browser.new_page()
    yield current
    report = getattr(request.node, "rep_call", None)
    if report is not None and report.failed:
        await _save_failure_artifacts(request.node.name, current)
    await current.close()


async def _save_failure_artifacts(test_name: str, current: Page) -> None:
    safe_name = re.sub(r"[^\w.-]+", "_", test_name)
    try:
        path = await current.screenshot(SCREENSHOT_DIR / f"{safe_name}.png")
        logger.error("Screenshot of the failed test saved to %s", path)
        for entry in await current.diagnostics():
            logger.error("Browser diagnostic: %s", entry)
    except Exception as error:  # diagnostics must never mask the real failure
        logger.warning("Could not capture failure artifacts: %s", error)
