"""
Servicio de historial: orquesta la lógica de negocio entre el router
y el repositorio. Por ahora actúa como pass-through; aquí se añadirá
validación adicional cuando sea necesario.
"""
from typing import List, Tuple

from sqlalchemy.orm import Session

from app.infrastructure.repositories import historial_repo
from app.models.entities.historial import Historial


def get_historial(db: Session, user_id: str) -> List[Historial]:
    """Devuelve el historial completo del usuario."""
    return historial_repo.get_historial_by_user(db, user_id)


def add_to_historial(db: Session, user_id: str, place_id: str) -> Historial:
    """Añade un restaurante al historial del usuario."""
    return historial_repo.add_historial_entry(db, user_id, place_id)


def delete_from_historial(db: Session, entry_id: int, user_id: str) -> bool:
    """Elimina una entrada de historial específica."""
    return historial_repo.delete_historial_entry(db, entry_id, user_id)


def get_popular_places(db: Session, limit: int = 5) -> List[Tuple[str, int]]:
    """Devuelve los place_id más visitados globalmente con su número de visitas."""
    return historial_repo.get_top_places(db, limit)

