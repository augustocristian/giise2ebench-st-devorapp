"""
Servicio de guardar para más tarde: orquesta la lógica de negocio entre el router
y el repositorio.
"""
from typing import List

from sqlalchemy.orm import Session

from app.infrastructure.repositories import mas_tarde_repo
from app.models.entities.mas_tarde import MasTarde


def get_mas_tarde(db: Session, user_id: str) -> List[MasTarde]:
    """Devuelve la lista completa de guardados para más tarde del usuario."""
    return mas_tarde_repo.get_mas_tarde_by_user(db, user_id)


def add_to_mas_tarde(db: Session, user_id: str, place_id: str) -> tuple[MasTarde, bool]:
    """Añade un restaurante a la lista de guardar para más tarde del usuario."""
    return mas_tarde_repo.add_mas_tarde_entry(db, user_id, place_id)


def delete_from_mas_tarde(db: Session, entry_id: int, user_id: str) -> bool:
    """Elimina una entrada de la lista específica."""
    return mas_tarde_repo.delete_mas_tarde_entry(db, entry_id, user_id)
