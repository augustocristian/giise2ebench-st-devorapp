# conftest.py
import logging
import os
import sys
from pathlib import Path

# Guarantees "src"/"tests" are importable even if the project hasn't been
# installed with `poetry install` (e.g. a bare `pip install -r` or CI runner
# invoking pytest directly). See tests/context.py for the same bootstrap,
# kept for structural parity with the reference project template.
ROOT_DIR = Path(__file__).resolve().parent
if str(ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(ROOT_DIR))

logger = logging.getLogger(__name__)


def pytest_runtest_setup(item):
    logger.debug("Starting setup of the Test: " + item.name)

    logger.debug("Ending setup of the Test: " + item.name)


def pytest_runtest_teardown(item):
    logger.debug("Starting teardown of the Test: " + item.name)

    logger.debug("Ending teardown of the Test: " + item.name)


def pytest_collection_modifyitems(items):
    """Auto-tags tests with the ``api``/``e2e`` markers declared in
    pyproject.toml based on their path, so ``pytest -m api`` / ``pytest -m
    e2e`` work without decorating every test class (mirrors ``mvn test
    -Dtest="TestApi*"`` vs ``-Dtest="Test*View,TestSideMenu"`` in the
    selenium-java suite)."""
    for item in items:
        path = str(item.fspath)
        if f"{os.sep}api{os.sep}" in path:
            item.add_marker("api")
        elif f"{os.sep}e2e{os.sep}" in path:
            item.add_marker("e2e")
