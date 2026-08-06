from sqlalchemy import Column, ForeignKey, Integer, String
from sqlalchemy.orm import relationship

from app.infrastructure.database import Base


class Favorito(Base):
    __tablename__ = "favoritos"

    id = Column(Integer, primary_key=True, autoincrement=True)
    lista_id = Column(Integer, ForeignKey("listas_favoritos.id", ondelete="CASCADE"), nullable=False, index=True)
    restaurante_id = Column(Integer, ForeignKey("restaurantes.id"), nullable=False, index=True)

    # Relación para acceder fácilmente al place_id
    restaurante = relationship("Restaurante", lazy="joined")

    @property
    def place_id(self) -> str:
        return self.restaurante.place_id if self.restaurante else None

    def __repr__(self) -> str:
        return f"<Favorito id={self.id} lista_id={self.lista_id} restaurante_id={self.restaurante_id}>"
