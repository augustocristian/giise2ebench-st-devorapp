<#
.SYNOPSIS
    EPI-DevorApp - local deployment script for Windows.

.DESCRIPTION
    Installs deps, runs lint + tests, builds, and starts the app.
    Mirrors every stage of the GitLab CI pipeline.

.PARAMETER Mode
    docker  (default) - build images and start with Docker Compose
    native  - run backend (uvicorn) and frontend (vite) directly on the host

.PARAMETER Component
    all       (default) - backend + frontend + database
    backend   - backend + database only (no frontend)
    frontend  - frontend only (assumes backend is already running)

.PARAMETER Dev
    Use docker-compose.dev.yml overlay (hot reload, source volumes).
    Only applies to docker mode.

.PARAMETER SkipTests
    Skip pytest and vitest (lint always runs).

.PARAMETER Apk
    Also build a debug Android APK after the frontend build.
    Requires Java 17+ and ANDROID_HOME set.

.PARAMETER Stop
    Stop and remove all running Docker containers for this project, then exit.

.EXAMPLE
    .\deploy.ps1                                    # docker, all components
    .\deploy.ps1 -Component backend                 # docker, backend only
    .\deploy.ps1 -Component frontend                # docker, frontend only
    .\deploy.ps1 -Dev                               # docker with hot reload
    .\deploy.ps1 -Mode native                       # native, all components
    .\deploy.ps1 -Mode native -Component backend    # native, backend only
    .\deploy.ps1 -Mode native -SkipTests            # native, skip tests
    .\deploy.ps1 -Apk                               # docker + build APK
    .\deploy.ps1 -Stop                              # stop containers
#>

param(
    [ValidateSet("docker","native")]
    [string]$Mode = "docker",

    [ValidateSet("all","backend","frontend")]
    [string]$Component = "all",

    [switch]$Dev,
    [switch]$SkipTests,
    [switch]$Apk,
    [switch]$Stop
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"
$Root = Join-Path $PSScriptRoot "sut"

# --- Helpers ------------------------------------------------------------------

function Show-Step { Write-Host "`n== $args ==" -ForegroundColor Cyan }
function Show-Ok   { Write-Host "  [OK] $args" -ForegroundColor Green }
function Show-Warn { Write-Host "  [WARN] $args" -ForegroundColor Yellow }
function Show-Fail { Write-Host "`n  [ERROR] $args`n" -ForegroundColor Red; exit 1 }
function Need  {
    param([string]$Cmd, [string]$Hint)
    if (-not (Get-Command $Cmd -ErrorAction SilentlyContinue)) { Show-Fail "$Cmd not found. $Hint" }
}
function Run {
    param([string]$Description, [scriptblock]$Block)
    & $Block
    if ($LASTEXITCODE -ne 0) { Show-Fail "$Description failed (exit $LASTEXITCODE)" }
}

$RunFrontend = $Component -in @("all","frontend")
$RunBackend  = $Component -in @("all","backend")

# --- Stop ---------------------------------------------------------------------

if ($Stop) {
    Show-Step "Stopping Docker Compose services"
    Push-Location $Root
    docker compose down --remove-orphans
    Pop-Location
    Show-Ok "All services stopped"
    exit 0
}

# --- Prerequisites ------------------------------------------------------------

Show-Step "Checking prerequisites"

if ($Mode -eq "docker") {
    Need docker "Install Docker Desktop from https://www.docker.com/products/docker-desktop"
    docker info 2>&1 | Out-Null
    if ($LASTEXITCODE -ne 0) { Show-Fail "Docker daemon is not running - start Docker Desktop" }
    Show-Ok "Docker $(docker --version)"
}

if ($RunFrontend -or ($RunBackend -and -not $SkipTests)) {
    Need node "Install Node.js 22+ from https://nodejs.org"
    Need npm  "Comes with Node.js"
    Show-Ok "Node.js $(node --version)  npm $(npm --version)"
}

if ($RunBackend) {
    # Try well-known Poetry locations on Windows
    if (-not (Get-Command poetry -ErrorAction SilentlyContinue)) {
        $fallback = "$env:APPDATA\Python\Scripts\poetry.exe"
        if (Test-Path $fallback) {
            $env:PATH = "$env:APPDATA\Python\Scripts;$env:PATH"
        } else {
            Show-Fail "Poetry not found. Install: pip install poetry"
        }
    }
    Show-Ok "$(poetry --version)"
}

if ($Apk) {
    Need java "Install JDK 17+ from https://adoptium.net"
    if (-not $env:ANDROID_HOME) { Show-Fail "ANDROID_HOME is not set. Install Android SDK." }
    Show-Ok "Android SDK at $env:ANDROID_HOME"
}

# --- Frontend pipeline --------------------------------------------------------

if ($RunFrontend) {
    Show-Step "Installing frontend dependencies"
    Push-Location "$Root\frontend"
    Run "npm ci" { npm ci }
    Show-Ok "node_modules ready"

    Show-Step "Linting frontend (ESLint)"
    Run "ESLint" { npm run lint }
    Show-Ok "Lint passed"

    if (-not $SkipTests) {
        Show-Step "Running frontend tests (Vitest)"
        Run "Vitest" { npm run test }
        Show-Ok "All frontend tests passed"
    }

    Show-Step "Building frontend (Vite -> dist/)"
    Run "Vite build" { npm run build }
    Show-Ok "dist/ generated"
    Pop-Location
}

# --- Backend pipeline ---------------------------------------------------------

if ($RunBackend) {
    Show-Step "Installing backend dependencies (Poetry)"
    Push-Location "$Root\backend"
    Run "poetry install" { poetry install --with dev }
    Show-Ok "Backend dependencies installed"

    if (-not $SkipTests) {
        Show-Step "Running backend tests (pytest)"
        Run "pytest" { poetry run pytest tests/ -v }
        Show-Ok "All backend tests passed"
    }
    Pop-Location

    Show-Step "Installing keras-api dependencies (pip)"
    Push-Location "$Root\keras-api"
    if (-not (Test-Path ".venv") -and -not (Test-Path "venv")) {
        Show-Step "Creating virtual environment (.venv)..."
        Run "venv creation" { python -m venv .venv }
    }
    $pythonCmd = "python"
    if (Test-Path ".venv\Scripts\python.exe") {
        $pythonCmd = ".venv\Scripts\python.exe"
    } elseif (Test-Path "venv\Scripts\python.exe") {
        $pythonCmd = "venv\Scripts\python.exe"
    }
    # Verify Python version compatibility (TensorFlow 2.15 requires Python >= 3.9 and < 3.13)
    & $pythonCmd -c "import sys; exit(0 if (3, 9) <= sys.version_info < (3, 13) else 1)"
    if ($LASTEXITCODE -ne 0) {
        $ver = & $pythonCmd -c "import sys; print(sys.version.split()[0])"
        Show-Fail "Incompatible Python version ($ver)! TensorFlow requires Python >= 3.9 and < 3.13. Please configure Python 3.10/3.11/3.12."
    }
    Run "pip install" { & $pythonCmd -m pip install -r requirements.txt }
    Show-Ok "Keras API dependencies installed"

    if (-not $SkipTests) {
        Show-Step "Running keras-api tests (pytest)"
        Run "pytest" { & $pythonCmd -m pytest test_main.py -v }
        Show-Ok "All keras-api tests passed"
    }
    Pop-Location
}

# --- Android APK (optional) ---------------------------------------------------

if ($Apk) {
    Show-Step "Building Android debug APK"
    Push-Location "$Root\frontend"
    if (-not (Test-Path "android")) {
        Show-Warn "android/ not found - running 'npx cap add android'"
        Run "cap add android" { npx cap add android }
    }
    Run "cap sync"          { npx cap sync android }
    Push-Location "android"
    Run "Gradle assembleDebug" { .\gradlew.bat assembleDebug }
    Pop-Location
    $apk = "android\app\build\outputs\apk\debug\app-debug.apk"
    if (Test-Path $apk) { Show-Ok "APK: frontend\$apk" }
    Pop-Location
}

# --- Start application --------------------------------------------------------

if ($Mode -eq "docker") {
    $composeArgs = @("compose")
    if ($Dev) { $composeArgs += @("-f", "docker-compose.yml", "-f", "docker-compose.dev.yml") }
    $composeArgs += "up", "--build"

    # Select which services to start
    switch ($Component) {
        "backend"  { $composeArgs += @("db", "backend", "keras-api") }
        "frontend" { $composeArgs += @("frontend") }
        # "all" starts everything (default docker compose behaviour)
    }

    Show-Step "Starting with Docker Compose$(if ($Dev) { ' [DEV mode]' })"
    Push-Location $Root
    & docker @composeArgs
    Pop-Location

} else {
    # native mode
    if ($RunBackend) {
        Show-Step "Starting backend - FastAPI (http://localhost:8000)"
        Start-Process powershell -ArgumentList "-NoExit", "-Command",
            "Set-Location '$Root\backend'; poetry run uvicorn app.main:app --reload --port 8000"

        Show-Step "Starting keras-api - FastAPI (http://localhost:8001)"
        Start-Process powershell -ArgumentList "-NoExit", "-Command",
            "Set-Location '$Root\keras-api'; if (Test-Path '.venv\Scripts\python.exe') { .venv\Scripts\python.exe -m uvicorn main:app --reload --port 8001 } elseif (Test-Path 'venv\Scripts\python.exe') { venv\Scripts\python.exe -m uvicorn main:app --reload --port 8001 } else { python -m uvicorn main:app --reload --port 8001 }"
    }

    if ($RunFrontend) {
        Show-Step "Starting frontend - Vite (https://localhost:5173)"
        Start-Process powershell -ArgumentList "-NoExit", "-Command",
            "Set-Location '$Root\frontend'; npm run dev"
    }

    Write-Host ""
    Write-Host "  Application running:" -ForegroundColor Green
    if ($RunFrontend) { Write-Host "    Frontend  ->  https://localhost:5173"     -ForegroundColor White }
    if ($RunBackend)  { Write-Host "    Backend   ->  http://localhost:8000"      -ForegroundColor White }
    if ($RunBackend)  { Write-Host "    API docs  ->  http://localhost:8000/docs" -ForegroundColor White }
    if ($RunBackend)  { Write-Host "    Keras API ->  http://localhost:8001"      -ForegroundColor White }
    Write-Host ""
    Write-Host "  To stop: close the terminal window(s) that opened." -ForegroundColor DarkGray
}
