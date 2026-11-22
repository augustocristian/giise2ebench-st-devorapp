from datetime import datetime, timezone
from typing import List, Optional

from sqlalchemy.orm import Session

from app.models.entities.favorite_lists import FavoriteList
from app.models.entities.favorites import Favorite
from app.infrastructure.repositories import restaurant_repo


# ── Listas ───────────────────────────────────────────────────────────────────

def get_lists_by_user(db: Session, user_id: str) -> List[FavoriteList]:
    """Return all favorites lists of a user."""
    return db.query(FavoriteList).filter(FavoriteList.user_id == user_id).all()


def get_list_by_id(db: Session, list_id: int, user_id: str) -> Optional[FavoriteList]:
    """Get a list by ID, checking it belongs to the user."""
    return db.query(FavoriteList).filter(
        FavoriteList.id == list_id,
        FavoriteList.user_id == user_id
    ).first()


def get_list_by_name(db: Session, name: str, user_id: str) -> Optional[FavoriteList]:
    """Get a list by name, checking it belongs to the user."""
    return db.query(FavoriteList).filter(
        FavoriteList.name == name,
        FavoriteList.user_id == user_id
    ).first()


def delete_list(db: Session, list_id: int, user_id: str) -> bool:
    """Delete a list and all its favorites, checking the user owns it."""
    favorites_list = get_list_by_id(db, list_id, user_id)
    if not favorites_list:
        return False
    
    # Delete favorites tied to the list
    db.query(Favorite).filter(Favorite.list_id == list_id).delete(synchronize_session=False)
    
    # Delete the list
    db.delete(favorites_list)
    db.commit()
    return True


def create_list(db: Session, user_id: str, name: str, icon: str = "Heart") -> FavoriteList:
    """Create a new favorites list for the user."""
    favorites_list = FavoriteList(user_id=user_id, name=name, icon=icon)
    db.add(favorites_list)
    db.commit()
    db.refresh(favorites_list)
    return favorites_list


def update_list(db: Session, list_id: int, user_id: str, name: str) -> Optional[FavoriteList]:
    """Update the name of a favorites list."""
    favorites_list = get_list_by_id(db, list_id, user_id)
    if not favorites_list:
        return None
    favorites_list.name = name
    db.commit()
    db.refresh(favorites_list)
    return favorites_list


# ── Favoritos ─────────────────────────────────────────────────────────────────

def get_favorites_by_list(db: Session, list_id: int) -> List[Favorite]:
    """Return the favorites of a list, newest first."""
    return (
        db.query(Favorite)
        .filter(Favorite.list_id == list_id)
        .order_by(Favorite.id.desc())
        .all()
    )


def get_favorite_by_place(db: Session, list_id: int, place_id: str) -> Optional[Favorite]:
    """Return a favorite by list and place_id."""
    restaurant = restaurant_repo.get_restaurant_by_place_id(db, place_id)
    if not restaurant:
        return None
        
    return db.query(Favorite).filter(
        Favorite.list_id == list_id,
        Favorite.restaurant_id == restaurant.id
    ).first()


def add_favorite(db: Session, list_id: int, place_id: str) -> Favorite:
    """Add a restaurant to a favorites list."""
    restaurant_id = restaurant_repo.get_or_create_restaurant(db, place_id)
    
    fav = Favorite(
        list_id=list_id,
        restaurant_id=restaurant_id,
    )
    db.add(fav)
    db.commit()
    db.refresh(fav)
    return fav


def delete_favorite(db: Session, list_id: int, favorite_id: int, user_id: str) -> bool:
    """
    Delete a favorite of the given list, checking the list belongs to the user.
    """
    favorites_list = get_list_by_id(db, list_id, user_id)
    if not favorites_list:
        return False
    fav = db.query(Favorite).filter(Favorite.id == favorite_id, Favorite.list_id == list_id).first()
    if not fav:
        return False
    db.delete(fav)
    db.commit()
    return True
