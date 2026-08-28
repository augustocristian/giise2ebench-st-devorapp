FROM python:3.12-slim

# Create a non-privileged user and configure workdir
RUN useradd -u 10001 -m appuser

WORKDIR /app
RUN chown appuser:appuser /app

RUN pip install --no-cache-dir poetry

# Switch to non-root user
USER appuser

ENV POETRY_VIRTUALENVS_IN_PROJECT=true

COPY --chown=appuser:appuser pyproject.toml poetry.lock* README.md ./
RUN poetry install --no-root

# Copy source code (explicit list avoids including sensitive files)
COPY --chown=appuser:appuser gplaces_mock/ ./gplaces_mock/

RUN poetry install

EXPOSE 8002

HEALTHCHECK --interval=5s --timeout=3s --retries=12 --start-period=10s \
    CMD python -c "import sys,urllib.request; sys.exit(0 if urllib.request.urlopen('http://127.0.0.1:8002/health').status == 200 else 1)"

CMD ["poetry", "run", "uvicorn", "gplaces_mock.core:app", "--host", "0.0.0.0", "--port", "8002"]
