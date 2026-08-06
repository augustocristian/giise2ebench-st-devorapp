# CLAUDE.md — giise2ebench-st-devorapp

## Project overview

This repository packages **DevorApp** — a restaurant discovery and recommendation app — as a **System Under Test (SUT)** together with two independent, parallel E2E/API test suites written against it. Users browse restaurants, call them, rate them, and receive personalised recommendations from a Keras neural network. The React web frontend is also packaged as an Android APK.

The repo is organized as three top-level, mostly-independent projects sharing one Git history:

```
giise2ebench-st-devorapp/
├── sut/                 # The System Under Test: DevorApp itself (frontend + backend + keras-api)
├── selenium-java/       # E2E + API test suite: Java + JUnit 5 + Selenium 4 + Maven
├── cypress-js/          # E2E + API test suite: JavaScript + Cypress (port of selenium-java)
├── docs/                # Requirements documents (ES/EN)
├── deploy.ps1           # Root-level Windows deploy script — builds/starts the SUT
├── deploy.sh            # Root-level Linux/macOS deploy script — builds/starts the SUT
└── .github/             # CI/tooling config (modernize/java-upgrade hooks)
```

`selenium-java` and `cypress-js` both test the **same** running instance of `sut` — they are not alternatives to each other in terms of what they cover, but two different technology implementations of the same test scenarios (the Cypress suite is an explicit port of the Selenium suite; see `cypress-js/README.md` for the file-by-file mapping). Both suites assume the SUT is already running — neither one starts it.

## Repository layout in detail

### `sut/` — the System Under Test

```
sut/
├── frontend/
│   ├── src/
│   │   ├── components/    # Shared UI (NotificationSystem, TopBar, …)
│   │   ├── controllers/   # Hooks and API wrappers
│   │   ├── models/        # TS types + API service clients (authService, etc.)
│   │   ├── views/         # Page components (HomePage, FavoritesPage, …)
│   │   └── tests/         # Vitest unit tests + setupTests.ts
│   ├── android/           # Capacitor Android project (committed — do not delete)
│   ├── e2e/                # Playwright E2E suite (separate from selenium-java/cypress-js — fully network-mocked)
│   ├── fastlane/           # deploy / deploy_production lanes (com.devorapp.epi)
│   ├── Dockerfile          # multi-stage: node build → nginx serve
│   ├── Dockerfile.dev      # node:22-alpine + npm run dev (hot reload)
│   ├── nginx.conf          # SPA fallback + /api/ proxy to backend:8000
│   ├── vite.config.ts      # /api proxy → localhost:8000, BasicSSL
│   └── playwright.config.ts
├── backend/
│   ├── app/
│   │   ├── core/                  # config.py (pydantic-settings), security.py (JWT)
│   │   ├── infrastructure/        # database.py, firebase/firebase_admin.py (lazy singleton; mocked in tests)
│   │   ├── models/dtos/           # Pydantic request/response schemas
│   │   ├── models/entities/       # SQLAlchemy ORM models
│   │   ├── presentation/routers/  # FastAPI routers
│   │   └── services/              # Business logic
│   ├── alembic/            # DB migrations
│   ├── tests/               # pytest suite (Firebase mocked via conftest.py)
│   ├── Dockerfile           # python:3.12-slim + poetry install
│   └── pyproject.toml
├── keras-api/               # Standalone ML recommendation microservice (FastAPI, port 8001)
├── docker-compose.yml       # Production: db + backend:8000 + keras-api:8001 + frontend:80/443
├── docker-compose.dev.yml   # Dev override: volumes + hot reload
└── README.md                 # Full setup/run docs (Spanish)
```

**Important**: `sut/deploy.ps1` and `sut/deploy.sh` were removed from `sut/` and now live at the **repository root** (see below) — they were relocated so all three top-level projects (`sut`, `selenium-java`, `cypress-js`) share one deployment entry point instead of each nesting its own.

Backend health check: `GET /health` at `http://localhost:8000/health` (mounted at the app root, not under `/api`) — poll this to confirm the SUT is ready before running either test suite.

Ports: frontend `80`/`443` (Docker) or `5173` (native/Vite dev), backend `8000`, keras-api `8001`, Postgres `5432` (internal to Docker network).

### `selenium-java/` — Selenium + Java + JUnit 5 + Maven suite

Standalone Maven project (`retorch-st-devorapp`), sibling to `sut/`. Package root: `epigijon.devorapp.e2e.functional`.

```
selenium-java/
├── pom.xml                   # JUnit 5, Selenium 4.44, Selema (driver lifecycle), Apache HttpClient, Gson
├── README.md                 # Full usage docs (Spanish): prereqs, mvn test invocations, report locations
└── src/test/
    ├── resources/
    │   ├── test.properties    # BROWSER_USER, LOCALHOST_URL (API base), FRONTEND_URL (browser base), HEADLESS_BROWSER
    │   └── log4j2.xml
    └── java/epigijon/devorapp/e2e/functional/
        ├── common/            # BaseApiClass (REST test base), BaseLoggedClass (browser test base), ElementNotFoundException
        ├── pages/              # Page Object Model — BasePage + 8 page classes (LoginPage, RegisterPage, HomePage, FavoritesPage, HistoryPage, ProfilePage, RecommendPage, SideMenuPage)
        ├── utils/               # Waiter (centralized explicit waits), Click (resilient click helper)
        └── tests/
            ├── e2e/             # 8 browser test classes (Test<Feature>View.java / TestLogin / TestSideMenu)
            └── api/             # 7 pure-REST test classes (TestApi<Feature>[BC].java)
```

Run with Maven: `mvn test` (visual), `mvn test -Dheadless=true`, `mvn test -Dtest="TestApi*"` (API subset), `mvn test -Dtest="Test*View,TestSideMenu"` (E2E subset). Reports land in `target/local/surefire-reports/` (or `target/${TJOB_NAME}/...` in CI). Requires JDK 17+, Maven, and a running SUT (`SUT_URL` system property or `test.properties` override the base URLs).

Tests follow the **Base-Choice testing technique** — `@DisplayName` annotations and comments reference scenario IDs (`BASE`, `S2`, `S3`, …) that map to documented equivalence classes, not arbitrary labels.

### `cypress-js/` — Cypress + JavaScript suite (port of `selenium-java`)

Standalone npm project, sibling to `sut/` and `selenium-java/`. A deliberate port preserving the same Base-Choice scenario coverage and naming, using idiomatic Cypress patterns instead of literal translation.

```
cypress-js/
├── package.json
├── cypress.config.js         # baseUrl (frontend), env.apiUrl (backend)
├── cypress.env.json.example  # local override template (real file gitignored)
├── scripts/wait-for-sut.js   # polls backend /health + frontend baseUrl before tests run
└── cypress/
    ├── e2e/                   # 8 browser specs
    │   └── api/               # 7 API specs (cy.request only, no browser)
    └── support/
        ├── e2e.js             # global beforeEach (session clearing), uncaught-exception handling
        ├── commands/          # api.js, auth.js, mocks.js — custom Cypress commands
        └── pages/              # 8 Page Object classes (class-based, fluent, mirrors selenium-java's POM)
```

Run with npm: `npm run cypress:open` (interactive), `npm run cypress:run` (full, headless), `npm run cypress:run:e2e` / `npm run cypress:run:api` (subsets), `npm test` (waits for the SUT via `scripts/wait-for-sut.js`, then runs everything). See `cypress-js/README.md` for the full file-by-file mapping back to `selenium-java` and the design differences (no `Waiter`/`Click`/`BasePage` equivalents needed — Cypress's built-in retry-ability supersedes them; network mocking uses `cy.intercept()` instead of a `window.fetch` monkey-patch).

### `docs/`

Plain-text functional requirements documents in Spanish and English (`userrequirements_es.txt`, `userrequirements_en.txt`) — the source specification both test suites' Base-Choice scenarios were derived from.

### `.github/`

CI/tooling scaffolding, currently a `modernize/java-upgrade` hook set (PowerShell/Bash scripts recording tool use during an automated Java-upgrade workflow) — not a general CI pipeline definition.

## Deployment

Two scripts at the **repository root** start the whole SUT (`sut/` — frontend, backend, keras-api, database):

```powershell
# Windows
.\deploy.ps1                                   # docker, all components, with tests
.\deploy.ps1 -Component backend                # backend + DB only
.\deploy.ps1 -Component frontend               # frontend only
.\deploy.ps1 -Dev                              # docker with hot-reload overlay
.\deploy.ps1 -Mode native -Component backend   # native (no Docker), backend only
.\deploy.ps1 -SkipTests                        # skip pytest + vitest
.\deploy.ps1 -Apk                              # also build a debug Android APK
.\deploy.ps1 -Stop                             # stop and remove containers
```

```bash
# Linux / macOS
./deploy.sh                          # docker, all components
./deploy.sh --component backend      # backend + DB only
./deploy.sh --component frontend     # frontend only
./deploy.sh --dev                    # docker with hot-reload
./deploy.sh --mode native            # native processes
./deploy.sh --skip-tests             # skip pytest + vitest
./deploy.sh --apk                    # build debug APK
./deploy.sh --stop                   # stop containers
```

Both scripts resolve their working directory as `<repo-root>/sut` internally (`$Root`/`$ROOT` = `sut/`), so all `frontend`, `backend`, `keras-api`, and `docker-compose.yml` references inside them correctly target the SUT subdirectory even though the scripts themselves live one level up, at the repo root.

**Typical workflow**: run `.\deploy.ps1` (or `./deploy.sh`) from the repo root first, wait for `http://localhost:8000/health` to respond, then run either `selenium-java` (`mvn test`) or `cypress-js` (`npm test`) against the running SUT — see each suite's own README for details.

## Key commands reference

### Frontend (`sut/frontend`)
```bash
cd sut/frontend
npm install
npm run dev          # https://localhost:5173
npm run build        # Vite production build → dist/
npm run test         # vitest (unit)
npm run test:e2e     # playwright (separate suite from selenium-java/cypress-js)
npm run lint
```

### Backend (`sut/backend`)
```bash
cd sut/backend
poetry install --with dev
poetry run uvicorn app.main:app --reload --port 8000
poetry run pytest tests/ -v
poetry run alembic upgrade head
```

### Docker (from `sut/`)
```bash
cd sut
docker compose up --build                                            # production
docker compose -f docker-compose.yml -f docker-compose.dev.yml up  # dev (hot reload)
```

### selenium-java
```bash
cd selenium-java
mvn test
mvn test -Dheadless=true
```

### cypress-js
```bash
cd cypress-js
npm install
npm test
```

## Conventions and things worth knowing

- **Firebase**: the backend's Firebase Admin integration is a lazy singleton (`sut/backend/app/infrastructure/firebase/firebase_admin.py`) and is mocked in backend unit tests; both E2E suites hit the *real* backend (and therefore real Firebase-backed auth) unless a specific test explicitly mocks network calls via `cy.intercept()` (Cypress) or a `window.fetch` override (Selenium/Java).
- **Google Maps / Google Identity mocking**: both suites inject mock implementations of `window.google.maps.places.Autocomplete` (location autocomplete) and, for login, `window.google.accounts.oauth2` (Google Identity Services) before the relevant page mounts, since the app depends on these external SDKs. See `cypress-js`'s `support/commands/mocks.js` or `selenium-java`'s `BaseLoggedClass#injectAutocompleteMock`.
- **Test-user lifecycle**: both suites create real users via `POST /api/register` against the live backend and delete them via `DELETE /api/profile` in teardown — there is no seeded/fixture database state to reset between runs.
- **Base-Choice testing**: scenario IDs (`BASE`, `S2`, `S3`, …) appearing in test names/comments across both suites are deliberate equivalence-class references tied to `docs/userrequirements_*.txt`, not arbitrary labels — preserve them when modifying tests.
- **Three independent `.gitignore` files** exist for `sut/`, `selenium-java/`, and `cypress-js/`, each covering that subproject's own build artifacts/dependencies. The root `.gitignore` only covers cross-cutting IDE (Eclipse, VS Code, PyCharm, IntelliJ) and OS clutter that can appear anywhere in the tree — git applies all of them cumulatively, so avoid duplicating subproject-specific ignores at the root.
