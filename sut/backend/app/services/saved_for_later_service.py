"""
Save for later service: orchestrates business logic between the router
and the repository.
"""
from typing import List, Optional

from sqlalchemy.orm import Session

from app.infrastructure.repositories import saved_for_later_repo
from app.models.entities.saved_for_later import SavedForLater


def get_save_for_later(db: Session, user_id: str, limit: int = 50, offset: int = 0) -> tuple[List[SavedForLater], int]:
    """Return one page of the user's Save for later list and the total number of entries."""
    entries = saved_for_later_repo.get_save_for_later_by_user(db, user_id, limit, offset)
    return entries, saved_for_later_repo.count_save_for_later_by_user(db, user_id)


def get_save_for_later_entry(db: Session, entry_id: int, user_id: str) -> Optional[SavedForLater]:
    """Return one entry if it belongs to the user."""
    return saved_for_later_repo.get_save_for_later_entry(db, entry_id, user_id)


def add_to_save_for_later(db: Session, user_id: str, place_id: str) -> tuple[SavedForLater, bool]:
    """Add a restaurant to the user's Save for later list."""
    return saved_for_later_repo.add_save_for_later_entry(db, user_id, place_id)


def delete_from_save_for_later(db: Session, entry_id: int, user_id: str) -> bool:
    """Delete a specific list entry."""
    return saved_for_later_repo.delete_save_for_later_entry(db, entry_id, user_id)
