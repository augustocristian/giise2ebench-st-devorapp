# Cypress + JavaScript E2E Suite for DevorApp

End-to-end (browser) and API test suite for **DevorApp**, implemented in Cypress + JavaScript. This is a port of the [`selenium-java`](../selenium-java) suite, preserving its test coverage and "Base-Choice" scenario documentation style while using idiomatic Cypress patterns (`cy.intercept()`, `cy.request()`, `cy.visit({ onBeforeLoad })`) instead of literal Java-to-JS translation.

## Prerequisites

| Tool | Purpose |
| :--- | :--- |
| **Node.js 18+** | Run Cypress and the test suite |
| The running SUT | Backend (`:8000`), frontend (`:80` via Docker or `:5173` native), and database |

This suite does **not** start the SUT itself — start it first from the repository root:

```powershell
# Windows
.\deploy.ps1
```
```bash
# Linux / macOS
./deploy.sh
```

Verify the backend is ready at `http://localhost:8000/health` before running tests.

## Install

```bash
cd cypress-js
npm install
```

## Configuration

Base URLs are set in [`cypress.config.js`](cypress.config.js):
- `baseUrl` — frontend, default `http://localhost`
- `env.apiUrl` — backend, default `http://localhost:8000`

Override locally by copying `cypress.env.json.example` to `cypress.env.json` (gitignored), or via environment variables:

```bash
CYPRESS_BASE_URL=http://localhost:8080 CYPRESS_apiUrl=http://localhost:8000 npm run cypress:run
```

This mirrors `selenium-java`'s `-DSUT_URL=...` override.

## Running the tests

```bash
npm run cypress:open        # interactive runner
npm run cypress:run         # full suite, headless
npm run cypress:run:e2e     # browser specs only (cypress/e2e/*.cy.js)
npm run cypress:run:api     # API specs only (cypress/e2e/api/*.cy.js)
npm run cypress:run:headed  # full suite, headed browser
npm test                    # waits for the SUT to be ready, then runs the full suite
```

`npm test` / `npm run test:e2e` / `npm run test:api` first run `scripts/wait-for-sut.js`, which polls the backend `/health` endpoint and the frontend `baseUrl` until both respond (or times out after 2 minutes) — Cypress has no built-in retry for a not-yet-ready SUT, unlike Selenium's implicit page-load waits.

## Structure

```
cypress-js/
├── cypress.config.js          baseUrl, env.apiUrl, spec pattern
├── scripts/wait-for-sut.js    pre-test readiness check
└── cypress/
    ├── e2e/                   8 browser specs (Page Object Model)
    │   └── api/               7 API specs (cy.request only, no browser)
    └── support/
        ├── e2e.js             global beforeEach (session clearing), uncaught-exception handling
        ├── commands/
        │   ├── api.js         URL/payload builders, cy.apiGet/apiPost/apiPatch/apiDelete, CRUD helpers
        │   ├── auth.js        test-user lifecycle (register/login/delete), session clearing
        │   └── mocks.js       Google Maps Autocomplete + Google Identity Services mocks
        └── pages/              8 Page Object classes (one per app page)
```

## Design notes (differences from `selenium-java`)

- **No `Waiter`/`Click`/`ElementNotFoundException` equivalents.** Cypress's `cy.get()` retries automatically until an element is actionable, and failed commands produce clear errors on their own — a centralized wait/click/exception layer isn't needed.
- **No `BasePage`.** `fill`/`click`/`isVisible` become inline `cy.get().type()/.click()` calls in each Page Object; there's no shared driver/waiter state to inject.
- **No cross-class static user tracking.** Java's `BaseLoggedClass` needed a `ConcurrentHashMap<Class, ...>` keyed by calling class to survive JUnit 5's static `@BeforeAll`/`@AfterAll` lifecycle. Each Cypress spec file is naturally isolated, so a spec-local variable is enough.
- **Network mocking uses `cy.intercept()`**, not a `window.fetch` monkey-patch — the idiomatic Cypress mechanism, used in `favorites.cy.js`, `history.cy.js`, and part of `recommend.cy.js`.
- **The JWT session cookie is carried automatically** by Cypress's per-test cookie jar; no manual cookie-store wiring is needed for authenticated `cy.request()` calls.

## Scenario coverage

Each spec's header comment lists the same Base-Choice scenario IDs (`BASE`, `S2`, `S3`, …) as the corresponding Java class's Javadoc, and test cases bundle scenarios the same way the Java `@Test` methods do. See [the implementation plan](../.claude) or the `selenium-java` source for the full scenario-to-class mapping.

| Spec | Ported from |
| :--- | :--- |
| `cypress/e2e/login.cy.js` | `TestLogin.java` |
| `cypress/e2e/register.cy.js` | `TestRegisterView.java` |
| `cypress/e2e/favorites.cy.js` | `TestFavoritesView.java` |
| `cypress/e2e/history.cy.js` | `TestHistoryView.java` |
| `cypress/e2e/profile.cy.js` | `TestProfileView.java` |
| `cypress/e2e/rating.cy.js` | `TestRatingView.java` |
| `cypress/e2e/recommend.cy.js` | `TestRecommendView.java` |
| `cypress/e2e/sidemenu.cy.js` | `TestSideMenu.java` |
| `cypress/e2e/api/register.cy.js` | `TestApiRegister.java` |
| `cypress/e2e/api/favoritos.cy.js` | `TestApiFavoritosBC.java` |
| `cypress/e2e/api/historial.cy.js` | `TestApiHistorialBC.java` |
| `cypress/e2e/api/mas-tarde.cy.js` | `TestApiMasTarde.java` |
| `cypress/e2e/api/profile.cy.js` | `TestApiProfileBC.java` |
| `cypress/e2e/api/recommend.cy.js` | `TestApiRecommendBC.java` |
| `cypress/e2e/api/valoraciones.cy.js` | `TestApiValoracionesBC.java` |
