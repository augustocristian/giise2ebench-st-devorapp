"""
Configuración de la sesión SQLAlchemy para PostgreSQL.
Proporciona `engine`, `SessionLocal` y el generador `get_db()` para
inyectarlo como dependencia FastAPI (Depends(get_db)).
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
    """Base declarativa compartida por todos los modelos SQLAlchemy."""
    pass


def get_db():
    """
    Dependencia FastAPI: abre una sesión de base de datos y la cierra
    al terminar la petición, aunque se produzca una excepción.
    """
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
