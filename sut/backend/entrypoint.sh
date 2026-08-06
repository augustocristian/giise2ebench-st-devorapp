#!/bin/sh
set -e

echo "== Initializing database =="
set +e
poetry run python app/initialize_db.py
STATUS=$?
set -e

if [ $STATUS -eq 10 ]; then
    echo "== Empty database initialized, stamping migration head =="
    poetry run alembic stamp head
elif [ $STATUS -eq 0 ]; then
    echo "== Existing database found, running migrations =="
    poetry run alembic upgrade head
else
    echo "== Database initialization failed =="
    exit $STATUS
fi

echo "== Starting FastAPI server =="
exec poetry run uvicorn app.main:app --host 0.0.0.0 --port 8000
