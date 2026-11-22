# Cypress + JavaScript E2E suite for DevorApp

Browser (UI) and API tests for **DevorApp**, written with Cypress 13 and JavaScript. It covers the same scenarios as the [`selenium-java`](../selenium-java) suite.

## Prerequisites

- Node.js 22 or newer (`.nvmrc` pins `22`).
- A running SUT: frontend (`http://localhost`), backend (`http://localhost:8000`) and the Google Places mock (`http://localhost:8002`). The suite does not start it; use `deploy.ps1` / `deploy.sh` from the repository root.

## Install

```bash
cd cypress-js
npm ci
npm run cypress:install   # downloads the Cypress binary
```

## Configuration

Defaults live in [`cypress.config.js`](cypress.config.js):

| Setting             | Default                 | Purpose            |
| :------------------ | :---------------------- | :----------------- |
| `baseUrl`           | `http://localhost`      | Frontend           |
| `env.apiUrl`        | `http://localhost:8000` | Backend API        |
| `env.placesMockUrl` | `http://localhost:8002` | Google Places mock |

Override with `cypress.env.json` (gitignored, see `cypress.env.json.example`) or environment variables:

```bash
CYPRESS_BASE_URL=http://localhost:8080 CYPRESS_apiUrl=http://localhost:8000 npm run cypress:run
```

When the `CI` environment variable is set, JUnit XML reports are written to `results/` (gitignored).

## Running

```bash
npm test                  # wait for the SUT, then run everything (UI + API)
npm run test:e2e          # UI specs only (cypress/e2e/ui)
npm run test:api          # API specs only (cypress/e2e/api)
npm run cypress:open      # interactive runner
```

`test*` scripts first run `scripts/wait-for-sut.js`, which polls the backend health endpoint and the frontend until they respond (2 minute timeout).

## Structure

```text
cypress/
  e2e/ui/                 UI specs
  e2e/api/                API specs
  support/
    commands/             custom commands (users.js, testid.js, ...)
    pages/                page objects
    data/                 test data (users, PLACES, ...)
    testids.js            data-testid constants
    e2e.js                global hooks
```

## Adding a test

- Create the user with `useTestUser()` (`support/commands/users.js`); never hard-code credentials.
- Take places from `PLACES` (`support/data/`), not literals.
- Interact through page objects in `support/pages/`; select elements with `cy.tid(...)`, which targets `data-testid` (ids are listed in `support/testids.js`).
- One scenario per `it`, with an English title prefixed by the short scenario id.
- No fixed waits (`cy.wait(1000)`): wait on `cy.intercept` aliases or retry-able assertions.
- No boolean assertions (`expect(x).to.be.true`): assert on the element or value itself (`should("be.visible")`, `should("have.text", ...)`).

## Lint and format

```bash
npm run lint           # ESLint (flat config, eslint-plugin-cypress)
npm run lint:fix
npm run format:check   # Prettier (double quotes, semicolons, width 120)
npm run format
```

## Known local gotchas

- **Cypress binary missing**: with npm >= 11 the Cypress postinstall is not run, so the binary is not downloaded on `npm ci`. Run `npm run cypress:install` (CI does too).
- **VS Code terminals**: they set `ELECTRON_RUN_AS_NODE`, which makes Cypress fail with `bad option`. Run `unset ELECTRON_RUN_AS_NODE` (PowerShell: `Remove-Item Env:ELECTRON_RUN_AS_NODE`) before running Cypress.
