"""
Servicio de favoritos: orquesta la lógica de negocio entre el router y el repositorio.
"""
from typing import List, Optional

from sqlalchemy.orm import Session

from app.infrastructure.repositories import favoritos_repo
from app.models.entities.listas_favoritos import ListaFavoritos
from app.models.entities.favoritos import Favorito


def get_listas(db: Session, user_id: str) -> List[ListaFavoritos]:
    return favoritos_repo.get_listas_by_user(db, user_id)


def get_lista_by_id(db: Session, lista_id: int, user_id: str) -> Optional[ListaFavoritos]:
    return favoritos_repo.get_lista_by_id(db, lista_id, user_id)


def create_lista(db: Session, user_id: str, nombre: str, icono: str = "Heart") -> ListaFavoritos:
    existente = favoritos_repo.get_lista_by_nombre(db, nombre, user_id)
    if existente:
        raise ValueError(f'Ya existe una lista de favoritos llamada "{nombre}".')
    return favoritos_repo.create_lista(db, user_id, nombre, icono)


def delete_lista(db: Session, lista_id: int, user_id: str) -> bool:
    return favoritos_repo.delete_lista(db, lista_id, user_id)


def update_lista(db: Session, lista_id: int, user_id: str, nombre: str) -> Optional[ListaFavoritos]:
    existente = favoritos_repo.get_lista_by_nombre(db, nombre, user_id)
    if existente and existente.id != lista_id:
        raise ValueError(f'Ya existe otra lista de favoritos llamada "{nombre}".')
    return favoritos_repo.update_lista(db, lista_id, user_id, nombre)


def get_favoritos(db: Session, lista_id: int) -> List[Favorito]:
    return favoritos_repo.get_favoritos_by_lista(db, lista_id)


def add_favorito(db: Session, lista_id: int, place_id: str) -> Favorito:
    existente = favoritos_repo.get_favorito_by_place(db, lista_id, place_id)
    if existente:
        raise ValueError("Este restaurante ya está en la lista de favoritos.")
    return favoritos_repo.add_favorito(db, lista_id, place_id)


def delete_favorito(db: Session, favorito_id: int, user_id: str) -> bool:
    return favoritos_repo.delete_favorito(db, favorito_id, user_id)
