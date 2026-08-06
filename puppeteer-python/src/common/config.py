"""Loads src/test/resources-style configuration for the DevorApp test suite.

Mirrors the way the Selenium-Java suite loads ``test.properties``: a flat
``KEY=VALUE`` file. Browser behavior is controlled only by environment
variables (HEADED, PUPPETEER_EXECUTABLE_PATH, BROWSER_ARGS).
"""
import os
from pathlib import Path

_PROPERTIES_PATH = Path(__file__).resolve().parent.parent.parent / "resources" / "test.properties"


def load_properties() -> dict:
    """Parses resources/test.properties into a plain dict."""
    properties = {}
    with open(_PROPERTIES_PATH, encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            key, value = line.split("=", 1)
            properties[key.strip()] = value.strip()
    return properties


def get_sut_api_url(properties: dict) -> str:
    """Base URL for API requests: SUT_URL env var > LOCALHOST_URL property."""
    return os.environ.get("SUT_URL") or properties.get("LOCALHOST_URL", "http://localhost:8000")


def get_sut_frontend_url(properties: dict) -> str:
    """Base URL for the browser: SUT_URL env var > FRONTEND_URL property."""
    return os.environ.get("SUT_URL") or properties.get("FRONTEND_URL", "http://localhost")


def is_headed() -> bool:
    """Browser is headless unless HEADED=1 (or true/yes) is set."""
    return os.environ.get("HEADED", "").strip().lower() in ("1", "true", "yes")


def get_tjob_name() -> str:
    return os.environ.get("TJOB_NAME", "local")


def get_browser_executable_path() -> str | None:
    """Explicit Chrome binary; by default the bridge uses the system Chrome (channel "chrome")."""
    return os.environ.get("PUPPETEER_EXECUTABLE_PATH") or None


def get_browser_args() -> list[str]:
    """Extra Chrome flags from BROWSER_ARGS (space separated), e.g. --no-sandbox on locked-down CI."""
    return os.environ.get("BROWSER_ARGS", "").split()
