"""Loads src/test/resources-style configuration for the DevorApp test suite.

Mirrors the way the Selenium-Java suite loads ``test.properties``: a flat
``KEY=VALUE`` file, overridable by JVM system properties / env vars. Here,
``resources/test.properties`` is overridable by OS environment variables of
the same name.
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


def is_headless(properties: dict) -> bool:
    """Headless flag: 'headless' env var > HEADLESS_BROWSER property."""
    value = os.environ.get("headless") or properties.get("HEADLESS_BROWSER", "false")
    return value.strip().lower() == "true"


def get_tjob_name() -> str:
    return os.environ.get("TJOB_NAME", "local")


def get_chromium_executable_path() -> str:
    """Path to a Chrome/Chromium/Edge binary to drive, if one is pinned.

    pyppeteer auto-downloads a Chromium build matching its pinned revision
    the first time a browser is launched, but that revision periodically
    disappears from Google's snapshot bucket (a known upstream issue, since
    pyppeteer has been effectively unmaintained since ~2022). Setting
    ``PUPPETEER_EXECUTABLE_PATH`` (or ``CHROME_PATH``) to any installed
    Chromium-based browser sidesteps that fragility entirely — exactly like
    pointing Node's Puppeteer at ``executablePath``. Returns "" if neither is
    set, in which case pyppeteer falls back to its own auto-download.
    """
    return os.environ.get("PUPPETEER_EXECUTABLE_PATH") or os.environ.get("CHROME_PATH") or ""
