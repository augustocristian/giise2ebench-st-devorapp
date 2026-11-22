from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Response
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.security import get_current_user
from app.infrastructure.database import get_db
from app.models.dtos.rating_dto import RatingUpsert, RatingResponse, PublicRatingResponse
from app.models.entities.usuarios import Usuario
from app.services import rating_service
from app.presentation.router_utils import get_firebase_uid as _get_uid, PaginationParams, page_envelope


router = APIRouter(prefix=settings.API_V1_STR, tags=["Ratings"])

RATING_NOT_FOUND = "Valoración no encontrada"


@router.put(
    "/restaurants/{place_id}/rating",
    response_model=RatingResponse,
    status_code=201,
    summary="Create or replace the rating of the current user for a restaurant",
    responses={200: {"description": "La valoración ya existía y se ha reemplazado (sin Location)"}},
)
async def rate_restaurant(
    place_id: str,
    data: RatingUpsert,
    response: Response,
    current_user: Annotated[Usuario, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
):
    """
    Idempotent upsert of the current user's review of a restaurant. Answers 201 with
    `Location: /api/v1/restaurants/{place_id}/rating` when the rating is created
    and 200 when an existing one is replaced.
    """
    uid = _get_uid(current_user)
    rating, created = rating_service.rate_restaurant(db, uid, place_id, data)
    if created:
        response.headers["Location"] = f"{settings.API_V1_STR}/restaurants/{place_id}/rating"
    else:
        response.status_code = 200
    return rating


@router.get("/restaurants/{place_id}/rating", summary="Get the rating of the current user for a restaurant")
async def get_my_review(
    place_id: str,
    current_user: Annotated[Usuario, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
):
    """
    Get the review the current user gave to a restaurant.
    Return an empty object if there is no review.
    """
    uid = _get_uid(current_user)
    return rating_service.get_my_review(db, uid, place_id)


@router.delete(
    "/restaurants/{place_id}/rating",
    status_code=204,
    summary="Delete the rating of the current user for a restaurant",
    responses={404: {"description": "Valoración no encontrada o no autorizada"}},
)
async def delete_review(
    place_id: str,
    current_user: Annotated[Usuario, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
):
    """
    Delete a user's review of a restaurant.
    """
    uid = _get_uid(current_user)
    success = rating_service.delete_review(db, uid, place_id)
    if not success:
        raise HTTPException(status_code=404, detail="Valoración no encontrada o no autorizada")


@router.get("/restaurants/{place_id}/ratings", summary="List the public ratings of a restaurant (paginated)")
async def get_restaurant_reviews(
    place_id: str,
    current_user: Annotated[Usuario, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
    page: PaginationParams,
):
    """
    Return one page of the reviews of a restaurant (from all users), most liked first,
    including username, scores, comment and likes. Envelope: `{items, total, limit, offset}`.
    """
    uid = _get_uid(current_user)
    items, total = rating_service.get_restaurant_reviews(db, place_id, uid, page.limit, page.offset)
    return page_envelope(items, total, page)


@router.get("/ratings", summary="List the own ratings of the current user (paginated)")
async def get_all_my_reviews(
    current_user: Annotated[Usuario, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
    page: PaginationParams,
):
    """
    Get one page of the current user's reviews with the restaurant details
    fetched from Google Places. Envelope: `{items, total, limit, offset}`.
    """
    uid = _get_uid(current_user)
    reviews, total = rating_service.get_all_my_reviews(db, uid, page.limit, page.offset)

    import asyncio
    from app.services.recommendation_service import recommendation_service

    tasks = [recommendation_service.get_place_details(v.place_id) for v in reviews]
    details_list = await asyncio.gather(*tasks)

    results = []
    for val, details in zip(reviews, details_list):
        if not details: continue
        results.append({
            "id": val.id,
            "place_id": val.place_id,
            "quality": val.quality,
            "price": val.price,
            "hygiene": val.hygiene,
            "service": val.service,
            "comment": val.comment,
            "created_at": val.created_at,
            "restaurant": details
        })

    return page_envelope(results, total, page)


@router.post(
    "/ratings/{rating_id}/likes",
    response_model=PublicRatingResponse,
    summary="Like a rating (idempotent)",
    responses={404: {"description": RATING_NOT_FOUND}},
)
async def like_review(
    rating_id: int,
    current_user: Annotated[Usuario, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
):
    """
    Add the current user's like to a review. Idempotent: liking an already liked review
    answers 200 with the unchanged public rating (no Location: the like is not addressable).
    """
    uid = _get_uid(current_user)
    result = rating_service.like_review(db, uid, rating_id)
    if not result:
        raise HTTPException(status_code=404, detail=RATING_NOT_FOUND)
    return result


@router.delete(
    "/ratings/{rating_id}/likes",
    status_code=204,
    summary="Remove the like of the current user from a rating (idempotent)",
    responses={404: {"description": RATING_NOT_FOUND}},
)
async def unlike_review(
    rating_id: int,
    current_user: Annotated[Usuario, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
):
    """Remove the current user's like. Idempotent: answers 204 even if there was no like."""
    uid = _get_uid(current_user)
    if not rating_service.unlike_review(db, uid, rating_id):
        raise HTTPException(status_code=404, detail=RATING_NOT_FOUND)
