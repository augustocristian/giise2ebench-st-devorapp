from sqlalchemy import Column, Integer, String

from app.infrastructure.database import Base


class ListaFavoritos(Base):
    __tablename__ = "listas_favoritos"

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(String, nullable=False, index=True)
    nombre = Column(String, nullable=False)
    icono = Column(String, nullable=False, default="Heart")

    def __repr__(self) -> str:
        return f"<ListaFavoritos id={self.id} user_id={self.user_id!r} nombre={self.nombre!r} icono={self.icono!r}>"
