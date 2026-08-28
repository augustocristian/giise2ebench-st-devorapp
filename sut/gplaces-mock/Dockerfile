# ── Stage 1: builder — resolves and installs runtime dependencies into .venv ──
FROM python:3.12-slim AS builder

RUN pip install --no-cache-dir poetry

WORKDIR /app

ENV POETRY_VIRTUALENVS_IN_PROJECT=true \
    POETRY_NO_INTERACTION=1

# Runtime dependencies only (no pytest/flake8), and no project root yet so this
# layer is cached until pyproject.toml / poetry.lock change.
COPY pyproject.toml poetry.lock* README.md ./
RUN poetry install --only main --no-root

# ── Stage 2: runtime — just Python, the venv and the source (no poetry/pip cache) ──
FROM python:3.12-slim

# Create a non-privileged user and configure workdir
RUN useradd -u 10001 -m appuser

WORKDIR /app
RUN chown appuser:appuser /app

# Switch to non-root user
USER appuser

COPY --from=builder --chown=appuser:appuser /app/.venv ./.venv
ENV PATH="/app/.venv/bin:$PATH" \
    PYTHONUNBUFFERED=1

# Copy source code (explicit list avoids including sensitive files)
COPY --chown=appuser:appuser gplaces_mock/ ./gplaces_mock/

EXPOSE 8002

HEALTHCHECK --interval=5s --timeout=3s --retries=12 --start-period=10s \
    CMD python -c "import sys,urllib.request; sys.exit(0 if urllib.request.urlopen('http://127.0.0.1:8002/health').status == 200 else 1)"

CMD ["uvicorn", "gplaces_mock.core:app", "--host", "0.0.0.0", "--port", "8002"]
