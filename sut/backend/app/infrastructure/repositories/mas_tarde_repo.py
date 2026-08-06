from typing import List

from sqlalchemy.orm import Session

from app.models.entities.mas_tarde import MasTarde
from app.infrastructure.repositories import restaurante_repo

def get_mas_tarde_by_user(db: Session, user_id: str) -> List[MasTarde]:
    """
    Devuelve todas las entradas de guardar para más tarde de un usuario.
    """
    return (
        db.query(MasTarde)
        .filter(MasTarde.user_id == user_id)
        .order_by(MasTarde.id.desc())
        .all()
    )


def add_mas_tarde_entry(db: Session, user_id: str, place_id: str) -> tuple[MasTarde, bool]:
    """
    Inserta una nueva entrada en guardar para más tarde si no existe ya para ese usuario y restaurante.
    Devuelve la entrada y un booleano indicando si ya existía.
    """
    restaurante_id = restaurante_repo.get_or_create_restaurante(db, place_id)
    
    # Verificamos si ya existe para evitar duplicados exactos
    existing = db.query(MasTarde).filter(
        MasTarde.user_id == user_id, 
        MasTarde.restaurante_id == restaurante_id
    ).first()
    
    if existing:
        return existing, True
        
    entry = MasTarde(
        user_id=user_id,
        restaurante_id=restaurante_id,
    )
    db.add(entry)
    db.commit()
    db.refresh(entry)
    return entry, False


def delete_mas_tarde_entry(db: Session, entry_id: int, user_id: str) -> bool:
    """
    Elimina una entrada de mas tarde por su ID si pertenece al usuario.
    """
    entry = db.query(MasTarde).filter(MasTarde.id == entry_id, MasTarde.user_id == user_id).first()
    if entry:
        db.delete(entry)
        db.commit()
        return True
    return False
