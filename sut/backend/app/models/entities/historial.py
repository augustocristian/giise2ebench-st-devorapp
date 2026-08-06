from sqlalchemy import Column, DateTime, ForeignKey, Integer, String
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.infrastructure.database import Base


class Historial(Base):
    __tablename__ = "historial"

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(String, nullable=False, index=True)
    restaurante_id = Column(Integer, ForeignKey("restaurantes.id"), nullable=False, index=True)
    fecha_acceso = Column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )

    # Relación para acceder fácilmente al place_id
    restaurante = relationship("Restaurante", lazy="joined")

    @property
    def place_id(self) -> str:
        return self.restaurante.place_id if self.restaurante else None

    def __repr__(self) -> str:
        return (
            f"<Historial id={self.id} user_id={self.user_id!r} "
            f"restaurante_id={self.restaurante_id} fecha_acceso={self.fecha_acceso}>"
        )
