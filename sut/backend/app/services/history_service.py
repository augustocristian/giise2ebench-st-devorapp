"""
History service: orchestrates business logic between the router
and the repository. For now it is a pass-through; extra
validation will be added here when needed.
"""
from typing import List, Optional, Tuple

from sqlalchemy.orm import Session

from app.infrastructure.repositories import history_repo
from app.models.entities.history import History


def get_history(db: Session, user_id: str, limit: int = 50, offset: int = 0) -> Tuple[List[History], int]:
    """Return one page of the user's history and the total number of entries."""
    entries = history_repo.get_history_by_user(db, user_id, limit, offset)
    return entries, history_repo.count_history_by_user(db, user_id)


def get_history_entry(db: Session, entry_id: int, user_id: str) -> Optional[History]:
    """Return one history entry if it belongs to the user."""
    return history_repo.get_history_entry(db, entry_id, user_id)


def add_to_history(db: Session, user_id: str, place_id: str) -> History:
    """Add a restaurant to the user's history."""
    return history_repo.add_history_entry(db, user_id, place_id)


def delete_from_history(db: Session, entry_id: int, user_id: str) -> bool:
    """Delete a specific history entry."""
    return history_repo.delete_history_entry(db, entry_id, user_id)


def get_popular_places(db: Session, limit: int = 5) -> List[Tuple[str, int]]:
    """Return the globally most visited place_ids with their visit counts."""
    return history_repo.get_top_places(db, limit)

