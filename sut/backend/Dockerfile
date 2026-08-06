FROM python:3.12-slim

# Create a non-privileged user and configure workdir
RUN useradd -u 10001 -m appuser

WORKDIR /app
RUN chown appuser:appuser /app

RUN apt-get update && apt-get install -y --no-install-recommends \
        libpq-dev gcc libc6-dev dos2unix && \
    rm -rf /var/lib/apt/lists/*

RUN pip install --no-cache-dir poetry

# Switch to non-root user
USER appuser

ENV POETRY_VIRTUALENVS_IN_PROJECT=true

COPY --chown=appuser:appuser pyproject.toml poetry.lock* README.md ./
RUN poetry install --without dev --no-root

COPY --chown=appuser:appuser app/ ./app/
COPY --chown=appuser:appuser alembic/ ./alembic/
COPY --chown=appuser:appuser alembic.ini ./alembic.ini
COPY --chown=appuser:appuser entrypoint.sh ./entrypoint.sh
COPY --chown=appuser:appuser pyproject.toml firebase-service-account.jso[n]* ./

RUN poetry install --without dev && \
    dos2unix entrypoint.sh && chmod +x entrypoint.sh

EXPOSE 8000
CMD ["sh", "entrypoint.sh"]
