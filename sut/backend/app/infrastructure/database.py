"""
SQLAlchemy session configuration for PostgreSQL.
Provides `engine`, `SessionLocal` and the `get_db()` generator to
inject it as a FastAPI dependency (Depends(get_db)).
"""
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, DeclarativeBase

from app.core.config import settings


engine = create_engine(settings.DATABASE_URL)

SessionLocal = sessionmaker(
    autocommit=False,
    autoflush=False,
    bind=engine,
)


class Base(DeclarativeBase):
    """Declarative base shared by all SQLAlchemy models."""
    pass


def get_db():
    """
    FastAPI dependency: open a database session and close it
    when the request ends, even if an exception is raised.
    """
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
