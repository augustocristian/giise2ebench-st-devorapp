from sqlalchemy.orm import Session
from typing import List, Optional, Set, Tuple
from app.models.entities.rating import Rating
from app.models.entities.rating_like import RatingLike
from app.models.entities.restaurant import Restaurant
from app.models.dtos.rating_dto import RatingUpsert
from app.infrastructure.repositories import restaurant_repo

def create_or_update_review(db: Session, user_id: str, place_id: str, data: RatingUpsert) -> Tuple[Rating, bool]:
    """Upsert the user's review of a restaurant. Return (review, created)."""
    restaurant_id = restaurant_repo.get_or_create_restaurant(db, place_id)
    
    review = db.query(Rating).filter(
        Rating.user_id == user_id,
        Rating.restaurant_id == restaurant_id
    ).first()

    created = review is None
    if review:
        review.quality = data.quality
        review.price = data.price
        review.hygiene = data.hygiene
        review.service = data.service
        review.comment = data.comment
    else:
        review = Rating(
            user_id=user_id,
            restaurant_id=restaurant_id,
            quality=data.quality,
            price=data.price,
            hygiene=data.hygiene,
            service=data.service,
            comment=data.comment,
            likes=0,
        )
        db.add(review)
    
    db.commit()
    db.refresh(review)
    return review, created

def get_all_user_reviews(db: Session, user_id: str, limit: Optional[int] = None, offset: int = 0) -> List[Rating]:
    query = db.query(Rating).filter(
        Rating.user_id == user_id
    ).order_by(Rating.id.desc())
    if limit is not None:
        query = query.offset(offset).limit(limit)
    return query.all()

def count_user_reviews(db: Session, user_id: str) -> int:
    return db.query(Rating).filter(Rating.user_id == user_id).count()

def get_user_review_by_place_id(db: Session, user_id: str, place_id: str) -> Rating | None:
    restaurant = restaurant_repo.get_restaurant_by_place_id(db, place_id)
    if not restaurant:
        return None
        
    return db.query(Rating).filter(
        Rating.user_id == user_id,
        Rating.restaurant_id == restaurant.id
    ).first()

def delete_review(db: Session, user_id: str, place_id: str) -> bool:
    restaurant = restaurant_repo.get_restaurant_by_place_id(db, place_id)
    if not restaurant:
        return False
        
    review = db.query(Rating).filter(
        Rating.user_id == user_id,
        Rating.restaurant_id == restaurant.id
    ).first()
    
    if review:
        db.delete(review)
        db.commit()
        return True
    return False

def get_reviews_by_place_id(db: Session, place_id: str, limit: Optional[int] = None, offset: int = 0) -> List[Rating]:
    """Return the reviews of a restaurant ordered by likes desc (one page when ``limit`` is given)."""
    restaurant = restaurant_repo.get_restaurant_by_place_id(db, place_id)
    if not restaurant:
        return []

    query = db.query(Rating).filter(
        Rating.restaurant_id == restaurant.id
    ).order_by(Rating.likes.desc(), Rating.id.desc())
    if limit is not None:
        query = query.offset(offset).limit(limit)
    return query.all()

def count_reviews_by_place_id(db: Session, place_id: str) -> int:
    restaurant = restaurant_repo.get_restaurant_by_place_id(db, place_id)
    if not restaurant:
        return 0
    return db.query(Rating).filter(Rating.restaurant_id == restaurant.id).count()

def add_like(db: Session, user_id: str, rating_id: int) -> Rating | None:
    """
    Add the user's like to a review (idempotent: no change if it already exists).
    Keep the review's 'likes' counter in sync. Return None if the review does not exist.
    """
    review = db.query(Rating).filter(Rating.id == rating_id).first()
    if not review:
        return None

    existing_like = db.query(RatingLike).filter(
        RatingLike.user_id == user_id,
        RatingLike.rating_id == rating_id
    ).first()

    if not existing_like:
        db.add(RatingLike(user_id=user_id, rating_id=rating_id))
        review.likes = (review.likes or 0) + 1
        db.commit()
        db.refresh(review)
    return review


def remove_like(db: Session, user_id: str, rating_id: int) -> Rating | None:
    """
    Remove the user's like from a review (idempotent: no change if there is none).
    Return None if the review does not exist.
    """
    review = db.query(Rating).filter(Rating.id == rating_id).first()
    if not review:
        return None

    existing_like = db.query(RatingLike).filter(
        RatingLike.user_id == user_id,
        RatingLike.rating_id == rating_id
    ).first()

    if existing_like:
        db.delete(existing_like)
        review.likes = max(0, (review.likes or 0) - 1)
        db.commit()
        db.refresh(review)
    return review

def get_liked_review_ids_by_user(db: Session, user_id: str, rating_ids: List[int]) -> Set[int]:
    """Return the set of review IDs the user has liked."""
    likes = db.query(RatingLike.rating_id).filter(
        RatingLike.user_id == user_id,
        RatingLike.rating_id.in_(rating_ids)
    ).all()
    return {l[0] for l in likes}
