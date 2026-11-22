"""
Favorites service: orchestrates business logic between the router and the repository.
"""
from typing import List, Optional

from sqlalchemy.orm import Session

from app.infrastructure.repositories import favorites_repo
from app.models.entities.favorite_lists import FavoriteList
from app.models.entities.favorites import Favorite


class ConflictError(ValueError):
    """The requested change collides with an existing resource (maps to HTTP 409)."""


def _validate_name(name: str) -> None:
    if not name or not name.strip():
        raise ValueError("El nombre de la lista no puede estar vacío.")


def get_lists(db: Session, user_id: str) -> List[FavoriteList]:
    return favorites_repo.get_lists_by_user(db, user_id)


def get_list_by_id(db: Session, list_id: int, user_id: str) -> Optional[FavoriteList]:
    return favorites_repo.get_list_by_id(db, list_id, user_id)


def create_list(db: Session, user_id: str, name: str, icon: str = "Heart") -> FavoriteList:
    _validate_name(name)
    existing_entry = favorites_repo.get_list_by_name(db, name, user_id)
    if existing_entry:
        raise ConflictError(f'Ya existe una lista de favoritos llamada "{name}".')
    return favorites_repo.create_list(db, user_id, name, icon)


def delete_list(db: Session, list_id: int, user_id: str) -> bool:
    return favorites_repo.delete_list(db, list_id, user_id)


def update_list(db: Session, list_id: int, user_id: str, name: str) -> Optional[FavoriteList]:
    _validate_name(name)
    existing_entry = favorites_repo.get_list_by_name(db, name, user_id)
    if existing_entry and existing_entry.id != list_id:
        raise ConflictError(f'Ya existe otra lista de favoritos llamada "{name}".')
    return favorites_repo.update_list(db, list_id, user_id, name)


def get_favorites(db: Session, list_id: int) -> List[Favorite]:
    return favorites_repo.get_favorites_by_list(db, list_id)


def add_favorite(db: Session, list_id: int, place_id: str) -> Favorite:
    existing_entry = favorites_repo.get_favorite_by_place(db, list_id, place_id)
    if existing_entry:
        raise ConflictError("Este restaurante ya está en la lista de favoritos.")
    return favorites_repo.add_favorite(db, list_id, place_id)


def delete_favorite(db: Session, list_id: int, favorite_id: int, user_id: str) -> bool:
    return favorites_repo.delete_favorite(db, list_id, favorite_id, user_id)
