FROM python:3.12-slim

# Create a non-privileged user and configure workdir
RUN useradd -u 10001 -m appuser

WORKDIR /app
RUN chown appuser:appuser /app

# Install PostgreSQL runtime and build dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
        libpq-dev gcc && \
    rm -rf /var/lib/apt/lists/*

# Install requirements
COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

# Switch to non-root user
USER appuser

# Copy source code (explicit list avoids including sensitive files)
COPY --chown=appuser:appuser main.py ./
COPY --chown=appuser:appuser models/ ./models/
COPY --chown=appuser:appuser places_cache.json ./places_cache.json

EXPOSE 8001
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8001"]
