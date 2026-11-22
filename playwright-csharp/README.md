# DevorApp test suite (Playwright + C#)

End-to-end (browser) and API test suite for **DevorApp**, built with
**[Playwright for .NET](https://playwright.dev/dotnet/)** and **NUnit** (net8.0).

It is the C# counterpart of [`selenium-java`](../selenium-java): the same Base-Choice scenarios (42 API
tests + 22 browser tests) on the same Page Object Model architecture.

---

## Requirements

| Tool | Purpose |
| :--- | :--- |
| **.NET SDK 8.0+** | Build and run the suite |
| **PowerShell 7 (`pwsh`)** | Run the Playwright browser installer script |
| **Docker** (Compose v2) | Run the system under test (SUT) |

---

## Setup

```bash
cd playwright-csharp
dotnet restore
dotnet build
pwsh bin/Debug/net8.0/playwright.ps1 install chromium     # once; on Linux add --with-deps
```

Only Chromium is used.

---

## Running the SUT

The suite runs against the **dev** stack described in the [root README](../README.md). From `sut/`:

```bash
docker compose -f docker-compose.yml -f docker-compose.dev.override.yml up -d --build
```

This exposes the frontend on `http://localhost`, the backend on `http://localhost:8000` and the Google
Places mock on `http://localhost:8002`. Each test creates and deletes its own users, so the suite can run
alongside the other suites against the same instance.

---

## Running the tests

```bash
dotnet test                                      # everything, headless by default
HEADED=1 dotnet test                             # show the browser (PowerShell: $env:HEADED=1; dotnet test)

dotnet test --filter "FullyQualifiedName~Tests.Api"                          # API only
dotnet test --filter "FullyQualifiedName~Tests.E2E"                          # browser only
dotnet test --filter "FullyQualifiedName~TestLogin"                          # one class
dotnet test --filter "FullyQualifiedName~TestApiRegister.TestS7_CorrectLogin"   # one test
```

Results as TRX (this is what the CI job `e2e-playwright-csharp` does, after `dotnet build`):

```bash
dotnet test --no-build --logger "trx;LogFileName=results.trx" --results-directory target/ci
```

### Configuration

[`resources/test.properties`](resources/test.properties) has the same keys as the Selenium suite:

```properties
LOCALHOST_URL=http://localhost:8000   # base URL of the API tests and of the user setup calls
FRONTEND_URL=http://localhost         # base URL of the browser tests
```

`SUT_URL` (environment variable) overrides the base URL of the API tests and of the browser tests, so
set it only when both share one origin. `HEADED=1` shows the browser (read by Playwright itself).
`BROWSER_USER` and `HEADLESS_BROWSER` are kept for parity with the other suites and are not used.

---

## Project structure

```
playwright-csharp/
├── DevorApp.E2ETests.csproj      # NuGet dependencies (the equivalent of pom.xml)
├── resources/test.properties     # SUT URLs
├── Common/
│   ├── BaseApiClass.cs           # HttpClient, URL builders, payloads, auth lifecycle
│   ├── BaseLoggedClass.cs        # extends PageTest; test-user lifecycle, Google Maps autocomplete mock
│   ├── DevorAppConfig.cs         # test.properties + SUT_URL
│   ├── ElementNotFoundException.cs
│   └── TestId.cs                 # data-testid selector factory
├── Pages/                        # one Page Object per view
└── Tests/
    ├── Api/                      # pure REST tests
    └── E2E/                      # browser tests
```

## Locators

Page Objects locate elements **only** by `data-testid` (see [`cypress-js/TESTIDS.md`](../cypress-js/TESTIDS.md))
through `TestId`, never by text, CSS class or structure:

```csharp
TestId.Of("login-submit")        // [data-testid='login-submit']
TestId.Price(2)                  // price-2
TestId.RatingStar("quality", 4)  // rating-star-quality-4
TestId.SideMenu("favorites")     // side-menu-favorites
```

Two states are only readable from attributes, so the pages read them directly: `data-theme` and
`data-font-size` on `<html>`, and the `active` class of the theme and font-size buttons.

Some tests mock endpoints (favorites, history, recommendation search) by overriding `window.fetch`, the same
way the Selenium suite does. UI texts asserted in the tests are the app's Spanish copy.

## Differences from `selenium-java`

- No `Waiter`/`Click` helpers: Playwright locators auto-wait before acting.
- No `clearSession()`: `PageTest` gives every test a fresh page in its own browser context.
- NUnit reuses one fixture instance for all the tests of a class, so the test-user fields set in
  `[OneTimeSetUp]` are plain instance fields.
