from typing import List, Optional

from sqlalchemy.orm import Session

from app.models.entities.saved_for_later import SavedForLater
from app.infrastructure.repositories import restaurant_repo

def get_save_for_later_by_user(db: Session, user_id: str, limit: Optional[int] = None, offset: int = 0) -> List[SavedForLater]:
    """
    Return the Save for later entries of a user, newest first
    (one page when ``limit`` is given).
    """
    query = (
        db.query(SavedForLater)
        .filter(SavedForLater.user_id == user_id)
        .order_by(SavedForLater.id.desc())
    )
    if limit is not None:
        query = query.offset(offset).limit(limit)
    return query.all()


def count_save_for_later_by_user(db: Session, user_id: str) -> int:
    """Return how many Save for later entries a user has."""
    return db.query(SavedForLater).filter(SavedForLater.user_id == user_id).count()


def get_save_for_later_entry(db: Session, entry_id: int, user_id: str) -> Optional[SavedForLater]:
    """Return one entry if it belongs to the user."""
    return db.query(SavedForLater).filter(
        SavedForLater.id == entry_id, SavedForLater.user_id == user_id
    ).first()


def add_save_for_later_entry(db: Session, user_id: str, place_id: str) -> tuple[SavedForLater, bool]:
    """
    Insert a new Save for later entry unless one already exists for that user and restaurant.
    Return the entry and a boolean telling whether it already existed.
    """
    restaurant_id = restaurant_repo.get_or_create_restaurant(db, place_id)
    
    # Check for an existing entry to avoid exact duplicates
    existing = db.query(SavedForLater).filter(
        SavedForLater.user_id == user_id, 
        SavedForLater.restaurant_id == restaurant_id
    ).first()
    
    if existing:
        return existing, True
        
    entry = SavedForLater(
        user_id=user_id,
        restaurant_id=restaurant_id,
    )
    db.add(entry)
    db.commit()
    db.refresh(entry)
    return entry, False


def delete_save_for_later_entry(db: Session, entry_id: int, user_id: str) -> bool:
    """
    Delete a Save for later entry by ID if it belongs to the user.
    """
    entry = db.query(SavedForLater).filter(SavedForLater.id == entry_id, SavedForLater.user_id == user_id).first()
    if entry:
        db.delete(entry)
        db.commit()
        return True
    return False
