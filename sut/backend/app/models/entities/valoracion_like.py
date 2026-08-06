from sqlalchemy import Column, Integer, String, ForeignKey, UniqueConstraint
from app.infrastructure.database import Base

class LikeValoracion(Base):
    """
    Entidad que rastrea qué usuario ha dado 'Me gusta' a qué valoración.
    Esto permite implementar la lógica de Like/Unlike y evitar duplicados.
    """
    __tablename__ = "likes_valoraciones"

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(String, nullable=False, index=True)
    valoracion_id = Column(Integer, ForeignKey("valoraciones.id", ondelete="CASCADE"), nullable=False, index=True)

    __table_args__ = (
        UniqueConstraint("user_id", "valoracion_id", name="uq_user_valoracion_like"),
    )

    def __repr__(self) -> str:
        return f"<LikeValoracion user_id={self.user_id!r} valoracion_id={self.valoracion_id}>"
