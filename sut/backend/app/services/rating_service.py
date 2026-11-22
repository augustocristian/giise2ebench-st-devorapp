from sqlalchemy.orm import Session
from typing import List
from app.models.dtos.rating_dto import RatingUpsert, RatingResponse, PublicRatingResponse
from app.infrastructure.repositories import rating_repo


def _build_public_review(
    v,
    username: str,
    already_liked: bool,
) -> PublicRatingResponse:
    """Build a PublicRatingResponse from the entity and user metadata."""
    return PublicRatingResponse(
        id=v.id,
        username=username,
        quality=v.quality,
        price=v.price,
        hygiene=v.hygiene,
        service=v.service,
        comment=v.comment,
        likes=v.likes or 0,
        liked_by_me=already_liked,
        created_at=v.created_at,
    )


def rate_restaurant(db: Session, user_id: str, place_id: str, data: RatingUpsert) -> tuple[RatingResponse, bool]:
    """Create or replace the user's review. Return (review, created)."""
    review, created = rating_repo.create_or_update_review(db, user_id, place_id, data)
    return RatingResponse.model_validate(review), created

def get_all_my_reviews(db: Session, user_id: str, limit: int = 50, offset: int = 0) -> tuple[List[RatingResponse], int]:
    reviews = rating_repo.get_all_user_reviews(db, user_id, limit, offset)
    total = rating_repo.count_user_reviews(db, user_id)
    return [RatingResponse.model_validate(v) for v in reviews], total

def get_my_review(db: Session, user_id: str, place_id: str) -> dict:
    review = rating_repo.get_user_review_by_place_id(db, user_id, place_id)
    if review:
        return RatingResponse.model_validate(review).model_dump()
    return {}

def delete_review(db: Session, user_id: str, place_id: str) -> bool:
    return rating_repo.delete_review(db, user_id, place_id)

def get_restaurant_reviews(
    db: Session, place_id: str, current_user_id: str = None, limit: int = 50, offset: int = 0
) -> tuple[List[PublicRatingResponse], int]:
    """Return one page of a restaurant's reviews (enriched with the author's username and whether
    the current user liked them) and the total number of reviews."""
    from app.infrastructure.repositories import usuario_repo
    reviews = rating_repo.get_reviews_by_place_id(db, place_id, limit, offset)
    total = rating_repo.count_reviews_by_place_id(db, place_id)

    # Get the IDs of reviews the current user has liked, to flag them
    user_likes = set()
    if current_user_id:
        v_ids = [v.id for v in reviews]
        user_likes = rating_repo.get_liked_review_ids_by_user(db, current_user_id, v_ids)

    result = []
    for v in reviews:
        user_obj = usuario_repo.get_user_by_uid(v.user_id)
        username = user_obj.username if user_obj else "Usuario desconocido"
        result.append(_build_public_review(v, username, v.id in user_likes))
    return result, total

def _public_review_after_like_change(db: Session, user_id: str, rating_id: int, review) -> PublicRatingResponse:
    from app.infrastructure.repositories import usuario_repo
    liked_ids = rating_repo.get_liked_review_ids_by_user(db, user_id, [rating_id])
    user_obj = usuario_repo.get_user_by_uid(review.user_id)
    username = user_obj.username if user_obj else "Usuario desconocido"
    return _build_public_review(review, username, rating_id in liked_ids)


def like_review(db: Session, user_id: str, rating_id: int) -> PublicRatingResponse | None:
    """Add the user's like to a review (idempotent). Return None if the review does not exist."""
    review = rating_repo.add_like(db, user_id, rating_id)
    if not review:
        return None
    return _public_review_after_like_change(db, user_id, rating_id, review)


def unlike_review(db: Session, user_id: str, rating_id: int) -> bool:
    """Remove the user's like from a review (idempotent). Return False if the review does not exist."""
    return rating_repo.remove_like(db, user_id, rating_id) is not None
