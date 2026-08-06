from sqlalchemy import Column, Integer, String, ForeignKey, DateTime
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.infrastructure.database import Base

class Valoracion(Base):
    __tablename__ = "valoraciones"

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(String, nullable=False, index=True)
    restaurante_id = Column(Integer, ForeignKey("restaurantes.id"), nullable=False, index=True)
    calidad = Column(Integer, nullable=False, default=0)
    precio = Column(Integer, nullable=False, default=0)
    higiene = Column(Integer, nullable=False, default=0)
    trato = Column(Integer, nullable=False, default=0)
    comentario = Column(String, nullable=True)
    me_gustas = Column(Integer, nullable=False, default=0)
    fecha = Column(DateTime, server_default=func.now())

    # Relación para acceder fácilmente al place_id
    restaurante = relationship("Restaurante", lazy="joined")

    @property
    def place_id(self) -> str:
        return self.restaurante.place_id if self.restaurante else None

    def __repr__(self) -> str:
        return (
            f"<Valoracion id={self.id} user_id={self.user_id!r} "
            f"restaurante_id={self.restaurante_id} calidad={self.calidad}>"
        )
