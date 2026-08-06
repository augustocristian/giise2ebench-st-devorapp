from datetime import datetime, timezone
from typing import List, Tuple

from sqlalchemy import func
from sqlalchemy.orm import Session

from app.models.entities.historial import Historial
from app.models.entities.restaurante import Restaurante
from app.infrastructure.repositories import restaurante_repo


def get_historial_by_user(db: Session, user_id: str) -> List[Historial]:
    """
    Devuelve todas las entradas del historial de un usuario,
    ordenadas de más reciente a más antigua.
    """
    return (
        db.query(Historial)
        .filter(Historial.user_id == user_id)
        .order_by(Historial.fecha_acceso.desc())
        .all()
    )


def add_historial_entry(db: Session, user_id: str, place_id: str) -> Historial:
    """
    Inserta una nueva entrada en el historial con la fecha y hora actuales.
    Asegura que el restaurante existe en la tabla central.
    """
    restaurante_id = restaurante_repo.get_or_create_restaurante(db, place_id)
    
    entry = Historial(
        user_id=user_id,
        restaurante_id=restaurante_id,
        fecha_acceso=datetime.now(timezone.utc),
    )
    db.add(entry)
    db.commit()
    db.refresh(entry)
    return entry


def delete_historial_entry(db: Session, entry_id: int, user_id: str) -> bool:
    """
    Elimina una entrada del historial por su ID si pertenece al usuario.
    """
    entry = db.query(Historial).filter(Historial.id == entry_id, Historial.user_id == user_id).first()
    if entry:
        db.delete(entry)
        db.commit()
        return True
    return False


def get_top_places(db: Session, limit: int = 5) -> List[Tuple[str, int]]:
    """
    Devuelve los `limit` place_id más visitados globalmente.
    Requiere JOIN con la tabla de restaurantes para obtener el place_id original.
    """
    rows = (
        db.query(Restaurante.place_id, func.count(Historial.id).label("visit_count"))
        .join(Historial)
        .group_by(Restaurante.place_id)
        .order_by(func.count(Historial.id).desc())
        .limit(limit)
        .all()
    )
    return [(row.place_id, row.visit_count) for row in rows]

