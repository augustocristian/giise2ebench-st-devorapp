from datetime import datetime, timezone
from typing import List, Optional, Tuple

from sqlalchemy import func
from sqlalchemy.orm import Session

from app.models.entities.history import History
from app.models.entities.restaurant import Restaurant
from app.infrastructure.repositories import restaurant_repo


def get_history_by_user(db: Session, user_id: str, limit: Optional[int] = None, offset: int = 0) -> List[History]:
    """
    Return the history entries of a user, newest first
    (one page when ``limit`` is given).
    """
    query = (
        db.query(History)
        .filter(History.user_id == user_id)
        .order_by(History.accessed_at.desc(), History.id.desc())
    )
    if limit is not None:
        query = query.offset(offset).limit(limit)
    return query.all()


def count_history_by_user(db: Session, user_id: str) -> int:
    """Return how many history entries a user has."""
    return db.query(History).filter(History.user_id == user_id).count()


def get_history_entry(db: Session, entry_id: int, user_id: str) -> Optional[History]:
    """Return one history entry if it belongs to the user."""
    return db.query(History).filter(History.id == entry_id, History.user_id == user_id).first()


def add_history_entry(db: Session, user_id: str, place_id: str) -> History:
    """
    Insert a new history entry with the current date and time.
    Ensure the restaurant exists in the central table.
    """
    restaurant_id = restaurant_repo.get_or_create_restaurant(db, place_id)
    
    entry = History(
        user_id=user_id,
        restaurant_id=restaurant_id,
        accessed_at=datetime.now(timezone.utc),
    )
    db.add(entry)
    db.commit()
    db.refresh(entry)
    return entry


def delete_history_entry(db: Session, entry_id: int, user_id: str) -> bool:
    """
    Delete a history entry by ID if it belongs to the user.
    """
    entry = db.query(History).filter(History.id == entry_id, History.user_id == user_id).first()
    if entry:
        db.delete(entry)
        db.commit()
        return True
    return False


def get_top_places(db: Session, limit: int = 5) -> List[Tuple[str, int]]:
    """
    Return the `limit` most visited place_ids globally.
    Needs a JOIN with the restaurants table to get the original place_id.
    """
    rows = (
        db.query(Restaurant.place_id, func.count(History.id).label("visit_count"))
        .join(History)
        .group_by(Restaurant.place_id)
        .order_by(func.count(History.id).desc())
        .limit(limit)
        .all()
    )
    return [(row.place_id, row.visit_count) for row in rows]

