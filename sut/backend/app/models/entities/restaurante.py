from sqlalchemy import Column, Integer, String
from app.infrastructure.database import Base

class Restaurante(Base):
    """
    Modelo ORM SQLAlchemy para la tabla `restaurantes`.
    Esta tabla sirve para agilizar las consultas usando IDs enteros
    en lugar de los place_id de Google Places en otras tablas.
    """
    __tablename__ = "restaurantes"

    id = Column(Integer, primary_key=True, autoincrement=True)
    place_id = Column(String, nullable=False, unique=True, index=True)

    def __repr__(self) -> str:
        return f"<Restaurante id={self.id} place_id={self.place_id!r}>"
