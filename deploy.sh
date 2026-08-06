#!/usr/bin/env bash
# EPI-DevorApp — local deployment script for Linux / macOS.
# Mirrors every stage of the GitLab CI pipeline.
#
# Usage:
#   ./deploy.sh [options]
#
# Options:
#   --mode docker|native   docker (default) or native host processes
#   --component all|backend|frontend   which parts to run (default: all)
#   --dev                  docker mode: use dev overlay (hot reload, volumes)
#   --skip-tests           skip pytest + vitest (lint still runs)
#   --apk                  build a debug APK after frontend build
#   --stop                 stop Docker Compose services and exit
#   -h|--help              show this help

set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/sut" && pwd)"

# ─── Defaults ─────────────────────────────────────────────────────────────────
MODE="docker"
COMPONENT="all"
DEV=false
SKIP_TESTS=false
BUILD_APK=false
STOP=false

# ─── Argument parsing ─────────────────────────────────────────────────────────
while [[ $# -gt 0 ]]; do
    case "$1" in
        --mode)       MODE="$2";      shift 2 ;;
        --component)  COMPONENT="$2"; shift 2 ;;
        --dev)        DEV=true;       shift ;;
        --skip-tests) SKIP_TESTS=true; shift ;;
        --apk)        BUILD_APK=true; shift ;;
        --stop)       STOP=true;      shift ;;
        -h|--help)    sed -n '2,15p' "$0" | sed 's/^# //'; exit 0 ;;
        *) echo "Unknown option: $1"; exit 1 ;;
    esac
done

[[ "$MODE"      =~ ^(docker|native)$           ]] || { echo "--mode must be docker|native"; exit 1; }
[[ "$COMPONENT" =~ ^(all|backend|frontend)$    ]] || { echo "--component must be all|backend|frontend"; exit 1; }

RUN_BACKEND=false;  [[ "$COMPONENT" =~ ^(all|backend)$  ]] && RUN_BACKEND=true
RUN_FRONTEND=false; [[ "$COMPONENT" =~ ^(all|frontend)$ ]] && RUN_FRONTEND=true

# ─── Colours ──────────────────────────────────────────────────────────────────
CYAN='\033[0;36m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; RED='\033[0;31m'; NC='\033[0m'
step() { echo -e "\n${CYAN}══ $* ══${NC}"; }
ok()   { echo -e "  ${GREEN}✔ $*${NC}"; }
warn() { echo -e "  ${YELLOW}⚠ $*${NC}"; }
fail() { echo -e "\n${RED}  ✖ $*${NC}\n"; exit 1; }
need() {
    local cmd="$1"
    local hint="$2"
    command -v "$cmd" &>/dev/null || fail "$cmd not found. $hint"
}
run()  { local d="$1"; shift; "$@" || fail "$d failed"; }

# ─── Stop ─────────────────────────────────────────────────────────────────────

if $STOP; then
    step "Stopping Docker Compose services"
    cd "$ROOT"
    docker compose down --remove-orphans
    ok "All services stopped"
    exit 0
fi

# ─── Prerequisites ────────────────────────────────────────────────────────────

step "Checking prerequisites"

if [[ "$MODE" == "docker" ]]; then
    need docker "Install from https://docs.docker.com/engine/install"
    docker info &>/dev/null || fail "Docker daemon not running"
    ok "$(docker --version)"
fi

if $RUN_FRONTEND || { $RUN_BACKEND && ! $SKIP_TESTS; }; then
    need node "Install Node.js 22+ via https://nodejs.org or nvm"
    need npm  "Comes with Node.js"
    ok "Node.js $(node --version)  npm $(npm --version)"
fi

if $RUN_BACKEND; then
    need poetry "Install: pip install poetry  or  pipx install poetry"
    ok "$(poetry --version)"
fi

if $BUILD_APK; then
    need java "Install JDK 17+ from https://adoptium.net"
    [[ -n "${ANDROID_HOME:-}" ]] || fail "ANDROID_HOME is not set"
    ok "$(java -version 2>&1 | head -1)"
    ok "Android SDK at $ANDROID_HOME"
fi

# ─── Frontend pipeline ────────────────────────────────────────────────────────

if $RUN_FRONTEND; then
    step "Installing frontend dependencies"
    cd "$ROOT/frontend"
    run "npm ci" npm ci
    ok "node_modules ready"

    step "Linting frontend (ESLint)"
    run "ESLint" npm run lint
    ok "Lint passed"

    if ! $SKIP_TESTS; then
        step "Running frontend tests (Vitest)"
        run "Vitest" npm run test
        ok "All frontend tests passed"
    fi

    step "Building frontend (Vite → dist/)"
    run "Vite build" npm run build
    ok "dist/ generated"
    cd "$ROOT"
fi

# ─── Backend pipeline ─────────────────────────────────────────────────────────

if $RUN_BACKEND; then
    step "Installing backend dependencies (Poetry)"
    cd "$ROOT/backend"
    run "poetry install" poetry install --with dev
    ok "Backend dependencies installed"

    if ! $SKIP_TESTS; then
        step "Running backend tests (pytest)"
        run "pytest" poetry run pytest tests/ -v
        ok "All backend tests passed"
    fi
    cd "$ROOT"

    step "Installing keras-api dependencies (pip)"
    cd "$ROOT/keras-api"
    if [[ ! -d ".venv" && ! -d "venv" ]]; then
        step "Creating virtual environment (.venv)..."
        python3 -m venv .venv || python -m venv .venv || fail "Failed to create virtual environment"
    fi
    PYTHON_CMD="python3"
    if [[ -f ".venv/bin/python" ]]; then
        PYTHON_CMD="./.venv/bin/python"
    elif [[ -f ".venv/Scripts/python" ]]; then
        PYTHON_CMD="./.venv/Scripts/python"
    elif [[ -f "venv/bin/python" ]]; then
        PYTHON_CMD="./venv/bin/python"
    elif [[ -f "venv/Scripts/python" ]]; then
        PYTHON_CMD="./venv/Scripts/python"
    fi
    # Verify Python version compatibility (TensorFlow 2.15 requires Python >= 3.9 and < 3.13)
    if ! $PYTHON_CMD -c "import sys; exit(0 if (3, 9) <= sys.version_info < (3, 13) else 1)" &>/dev/null; then
        fail "Incompatible Python version ($($PYTHON_CMD -c 'import sys; print(sys.version.split()[0])'))! TensorFlow requires Python >= 3.9 and < 3.13. Please configure Python 3.10/3.11/3.12."
    fi
    run "pip install" $PYTHON_CMD -m pip install -r requirements.txt
    ok "Keras API dependencies installed"

    if ! $SKIP_TESTS; then
        step "Running keras-api tests (pytest)"
        run "pytest" $PYTHON_CMD -m pytest test_main.py -v
        ok "All keras-api tests passed"
    fi
    cd "$ROOT"
fi

# ─── Android APK (optional) ───────────────────────────────────────────────────

if $BUILD_APK; then
    step "Building Android debug APK"
    cd "$ROOT/frontend"
    if [[ ! -d "android" ]]; then
        warn "android/ not found — running 'npx cap add android'"
        run "cap add android" npx cap add android
    fi
    run "cap sync"          npx cap sync android
    cd android
    run "Gradle assembleDebug" ./gradlew assembleDebug
    cd "$ROOT/frontend"
    APK="android/app/build/outputs/apk/debug/app-debug.apk"
    [[ -f "$APK" ]] && ok "APK: frontend/$APK"
    cd "$ROOT"
fi

# ─── Start application ────────────────────────────────────────────────────────

if [[ "$MODE" == "docker" ]]; then
    COMPOSE_CMD="docker compose"
    if $DEV; then
        COMPOSE_CMD="docker compose -f docker-compose.yml -f docker-compose.dev.yml"
    fi

    SERVICES=""
    case "$COMPONENT" in
        backend)  SERVICES="db backend keras-api" ;;
        frontend) SERVICES="frontend" ;;
        # all: no explicit service list → starts everything
        *) SERVICES="" ;;
    esac

    step "Starting with Docker Compose$(if $DEV; then echo ' [DEV mode]'; fi)"
    cd "$ROOT"
    # shellcheck disable=SC2086
    $COMPOSE_CMD up --build $SERVICES

else
    # native mode — launch background processes
    declare -a PIDS=()

    if $RUN_BACKEND; then
        step "Starting backend — FastAPI (http://localhost:8000)"
        cd "$ROOT/backend"
        poetry run uvicorn app.main:app --reload --port 8000 &
        PIDS+=($!)
        cd "$ROOT"

        step "Starting keras-api — FastAPI (http://localhost:8001)"
        cd "$ROOT/keras-api"
        PYTHON_CMD="python3"
        if [[ -f ".venv/bin/python" ]]; then
            PYTHON_CMD="./.venv/bin/python"
        elif [[ -f ".venv/Scripts/python" ]]; then
            PYTHON_CMD="./.venv/Scripts/python"
        elif [[ -f "venv/bin/python" ]]; then
            PYTHON_CMD="./venv/bin/python"
        elif [[ -f "venv/Scripts/python" ]]; then
            PYTHON_CMD="./venv/Scripts/python"
        fi
        $PYTHON_CMD -m uvicorn main:app --reload --port 8001 &
        PIDS+=($!)
        cd "$ROOT"
    fi

    if $RUN_FRONTEND; then
        step "Starting frontend — Vite (https://localhost:5173)"
        cd "$ROOT/frontend"
        npm run dev &
        PIDS+=($!)
        cd "$ROOT"
    fi

    echo ""
    echo -e "  ${GREEN}Application running:${NC}"
    $RUN_FRONTEND && echo    "    Frontend  →  https://localhost:5173"
    $RUN_BACKEND  && echo    "    Backend   →  http://localhost:8000"
    $RUN_BACKEND  && echo    "    API docs  →  http://localhost:8000/docs"
    $RUN_BACKEND  && echo    "    Keras API →  http://localhost:8001"
    echo ""
    echo -e "  Press ${YELLOW}Ctrl+C${NC} to stop."

    trap 'kill "${PIDS[@]}" 2>/dev/null; exit 0' INT TERM
    wait "${PIDS[@]}"
fi
