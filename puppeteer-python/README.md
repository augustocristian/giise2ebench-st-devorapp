# DevorApp Test Suite (Puppeteer + Python)

End-to-end (E2E) and API test suite for **DevorApp** (a restaurant discovery and recommendation app). The tests are written in Python with **pytest**, and the browser is driven by the **current Puppeteer** (pinned to 25.16.0).

Puppeteer only exists for Node.js, and the Python port `pyppeteer` is abandoned and ships an obsolete Chromium. So the tests stay in Python and talk to a small Node process (the *bridge*) that runs the real Puppeteer.

It is the functional equivalent of the [`selenium-java`](../selenium-java) suite: same Base-Choice test cases and the same Page Object Model.

## Architecture

```
 pytest (Python 3.12, asyncio)
   |  tests/e2e/*  ->  src/pages/* (page objects)  ->  src/browser (Browser, Page, Locator, TestId)
   |
   |  newline-delimited JSON-RPC over stdin/stdout  (asyncio subprocess, request ids)
   v
 Node bridge  (bridge/server.mjs, Node >= 22.12, puppeteer 25.16.0)
   |  Puppeteer Locators API (auto-waiting), browser contexts, evaluateOnNewDocument
   v
 Google Chrome (system install, channel "chrome", headless by default)  ->  DevorApp
```

- Auto-waiting comes from Puppeteer Locators on the Node side, so there are no polling waiters in Python.
- Selectors are always CSS of the form `[data-testid='...']`, built with `TestId` (see [`../cypress-js/TESTIDS.md`](../cypress-js/TESTIDS.md)). There is no XPath and no CSS-class selector.
- The browser starts once per test session; each test gets its own isolated browser context (own cookies and storage).
- `nth` and `within` scoping is implemented with a Puppeteer custom query handler (`scope/...`), so scoped locators auto-wait too.
- The bridge exits (and closes Chrome) when Python closes its stdin, so a crashed test run does not leave Chrome behind.

## Requirements

| Tool | Purpose |
| :--- | :--- |
| Python 3.12+ | pytest suite |
| Node.js 22.12+ (Node 22 in CI) | runs the bridge |
| Google Chrome | driven by Puppeteer (no browser is downloaded) |
| Docker (Compose v2) | runs the SUT |

As in the Selenium suite, put `firebase-service-account.json` in the project root for user authentication in the tests.

## Install

```bash
# Bridge: Puppeteer without downloading a browser (the system Chrome is used)
cd bridge && PUPPETEER_SKIP_DOWNLOAD=true npm ci && cd ..

# Python
python -m venv .venv
source .venv/bin/activate            # Windows: .venv\Scripts\Activate.ps1
pip install .                        # all dependencies pinned in pyproject.toml (or: poetry install)
```

To use a different Chrome/Chromium binary, set `PUPPETEER_EXECUTABLE_PATH`. Set `NODE_BINARY` if `node` is not on the PATH.

## Run

Start the SUT first (`../deploy.sh` or `..\deploy.ps1`), then:

```bash
python -m pytest                       # everything, headless
HEADED=1 python -m pytest tests/e2e    # show the browser
python -m pytest -m api                # API tests only (no browser)
python -m pytest -m e2e                # browser tests only
python -m pytest -m bridge             # bridge smoke test
python -m pytest tests/bridge/test_bridge_smoke.py::test_fill_type_and_clear
python -m pytest tests --junitxml=results/junit.xml
python -m pytest --html=target/local/report.html --self-contained-html
```

| Variable | Effect |
| :--- | :--- |
| `HEADED=1` | Shows the browser (default is headless) |
| `SUT_URL` | Overrides the frontend and API URLs from `resources/test.properties` |
| `PUPPETEER_EXECUTABLE_PATH` | Chrome binary to use instead of the system Chrome |
| `BROWSER_ARGS` | Extra Chrome flags, space separated |
| `NODE_BINARY` | Node executable |
| `USE_SYSTEM_PROXY=1` | Do not force `--no-proxy-server` (see below) |
| `CI` | Adds `--no-sandbox` to Chrome (needed on Linux CI runners) |
| `TJOB_NAME` | Name used in logs and report paths |

The bridge launches Chrome with `--no-proxy-server`: Windows proxy auto-detection can add 20-30 seconds to every navigation to `localhost`.

When a test fails, a full-page screenshot is saved to `reports/screenshots/<test>.png` and the browser console errors, page errors and failed requests are logged. Logs go to `logs/pytest.log`. Coverage is on by default (`coverage.xml`).

### CI

The GitHub Actions job `e2e-puppeteer-python` (ubuntu-latest, Python 3.12, Node 22, preinstalled Chrome) runs:

```bash
cd puppeteer-python && pip install .
cd bridge && PUPPETEER_SKIP_DOWNLOAD=true npm ci
cd .. && python -m pytest tests --junitxml=results/junit.xml
```

## Project structure

```
puppeteer-python/
├── bridge/                     # Node bridge: package.json, package-lock.json, server.mjs
├── pyproject.toml              # dependencies (exact versions), pytest, asyncio and logging config
├── conftest.py                 # fixtures: sut_url, browser (session), page (per test); failure screenshots
├── resources/test.properties   # SUT URLs (same format as selenium-java)
├── src/
│   ├── browser/                # Python client of the bridge (client, Browser, Page, Locator, TestId, errors)
│   ├── common/                 # base_api_class, base_logged_class (browser tests + test users), config, exceptions
│   └── pages/                  # Page Objects, one per view
└── tests/
    ├── api/                    # pure REST tests (no browser)
    ├── bridge/                 # smoke test of the Python-Node bridge
    └── e2e/                    # browser tests (Page Objects)
```

## Browser API (`src.browser`)

All methods are `async`. Waiting actions use a default auto-wait timeout of 10 s, set per locator with `with_timeout`.

### `Browser`

| Member | Description |
| :--- | :--- |
| `await Browser.launch(headless=True, executable_path=None, args=None, node_binary=None)` | Starts the bridge and Chrome |
| `await browser.new_context()` | Isolated `BrowserContext` (own cookies and storage) |
| `await browser.new_page()` | Page in a fresh context; closing the page closes the context |
| `await browser.close()` | Closes Chrome and the bridge (also via `async with`) |
| `browser.version` | Chrome version string |

`BrowserContext` has `await new_page()` and `await close()`.

### `Page`

| Method | Description |
| :--- | :--- |
| `locator(selector, timeout_ms=10000) -> Locator` | Lazy locator for a CSS selector (normally `TestId.of(...)`) |
| `goto(url, timeout_ms=30000)` | Navigates and waits for DOMContentLoaded |
| `reload(timeout_ms=30000)` | Reloads the page |
| `url() -> str` | Current URL |
| `title() -> str` | Document title |
| `evaluate(script, *args)` | Runs a JS function expression (`"(a, b) => a + b"`) with JSON args and awaits promises |
| `add_init_script(script, *args)` | Runs a JS function expression in every new document before page scripts (mocks, fetch stubs) |
| `press_key(key)` | Presses a key on whatever has focus |
| `set_viewport(width, height)` | Resizes the viewport |
| `clear_storage()` | Clears localStorage, sessionStorage and IndexedDB of the current origin |
| `clear_cookies()` / `cookies()` | Deletes / lists the cookies of the page's context |
| `screenshot(path, full_page=True) -> Path` | Saves a PNG |
| `diagnostics(clear=True)` | Console errors/warnings, page errors and failed requests captured so far |
| `close()` | Closes the page |

### `Locator` (immutable and lazy; Puppeteer auto-waits when an action runs)

| Method | Description |
| :--- | :--- |
| `nth(i)` / `first()` / `last()` | The i-th match (0-based, negative counts from the end) |
| `within(selector)` | Matches of a CSS selector below this locator's elements |
| `with_timeout(timeout_ms)` | Same locator with another auto-wait timeout |
| `click()` | Waits for visible, enabled and stable, scrolls into view, clicks |
| `fill(value)` | Clears and sets the value; `""` really clears |
| `type(text, delay_ms=0)` | Types key by key |
| `press(key)` | Focuses the element and presses a key (`"Enter"`) |
| `hover()` / `scroll_into_view()` | Hovers / scrolls the element into view |
| `text()` / `input_value()` | Text content / input value (waits for the element to exist) |
| `attribute(name)` / `property(name)` | DOM attribute / property (for example `checked`) |
| `count()` | Number of current matches (never waits) |
| `is_visible()` / `is_enabled()` | Current state of the first match (never waits) |
| `wait_for(state="visible")` | Waits for `visible`, `hidden`, `attached` or `detached` |

### `TestId` (selector builders, same as the Selenium and C# suites)

`of(id)`, `indexed(prefix, n)`, `price(level)`, `rating_star(aspect, n)`, `side_menu(entry)`, `history_menu(action)`, `cuisine_option(tag_id)`, `profile_card(card)`, `toast(kind)`, `element_id(id)` (for the few elements located by DOM id).

### Errors

`BrowserError` is the base class. `ElementTimeoutError` is a Puppeteer timeout (element, state or navigation). `BridgeProtocolError` is any other error reported by the bridge (bad selector, JS exception). `BridgeTimeoutError` means no answer at all. `BridgeCrashedError` means the Node process died and carries its stderr.

## Test infrastructure

- `conftest.py`: `sut_url` and `browser` (session scope), `page` (one isolated context per test; screenshot on failure). pytest-asyncio runs in auto mode with a single session-wide loop.
- `BaseLoggedClass` (`src/common/base_logged_class.py`): a plain pytest class with `self.page`, `self.sut_url`, `self.api_client`, `self.test_email/test_password/test_username`, the class methods `setup_test_user`, `register_user_api`, `register_email_for_cleanup`, `teardown_test_user` (call them from `setup_class` / `teardown_class`), `clear_session`, `go_to_login`, `api_login`, `api_post`, `api_delete`, and the Google Places mock helpers `inject_autocomplete_mock` and `trigger_autocomplete_place_changed`.
- `tests/api` still uses `unittest`-style classes without a browser.

## Page objects and mocks

- `BasePage` offers `create`, `locator`, `fill`, `click`, `is_visible`, `text_or_empty`, `wait_hidden`, `wait_until` (polls an async condition) and `wait_for_count`.
- Pages: `LoginPage`, `RegisterPage`, `HomePage`, `SideMenuPage`, `ProfilePage`, `RecommendPage`, `FavoritesPage`, `HistoryPage`. Theme and font-size state is read from `<html>` with `page.evaluate`.
- Favorites, history and recommend tests stub `window.fetch` with `page.evaluate` (`/api/v1/favorites/lists`, `/api/v1/history` with the `{items, total, limit, offset}` envelope, `/api/v1/recommendations/search`). Every scenario reloads the page, which drops the previous stub.
- `inject_autocomplete_mock` replaces `window.google` in the current document, so call it after the page loaded and before the component mounts.

## Differences from `selenium-java`

- Selectors are `data-testid` CSS strings (`TestId`) instead of `By`.
- Page objects (`src/pages`, one per view) mirror the Java/C# ones method for method, with snake_case names. They extend `BasePage`, locate only through `TestId` and are built with an async factory, `await XxxPage.create(page)`, because `__init__` cannot wait.
- Tests are `async def` methods; assertions are plain `assert`.
