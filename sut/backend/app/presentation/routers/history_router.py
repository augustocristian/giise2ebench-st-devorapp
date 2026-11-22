"""
Restaurant history router.

Endpoints (under /api/v1):
  GET    /history               - paginated history of the authenticated user
  POST   /history               - adds a restaurant to the history (201 + Location)
  GET    /history/popular       - globally most visited restaurants
  GET    /history/{entry_id}    - one history entry
  DELETE /history/{entry_id}    - deletes an entry
"""
from typing import Annotated, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Response
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.security import get_current_user
from app.infrastructure.database import get_db
from app.models.dtos.history_dto import HistoryEntryCreate
from app.models.entities.usuarios import Usuario
from app.services import history_service
from app.presentation.router_utils import get_firebase_uid as _get_uid, PaginationParams, page_envelope

router = APIRouter(prefix=f"{settings.API_V1_STR}/history", tags=["History"])

ENTRY_NOT_FOUND = "Entrada de historial no encontrada o no autorizada"


def _entry_dict(entry, details) -> dict:
    return {
        "id": entry.id,
        "user_id": entry.user_id,
        "place_id": entry.place_id,
        "accessed_at": entry.accessed_at,
        "restaurant": details
    }


@router.get("", summary="List the history of the authenticated user (paginated)")
async def get_history(
    current_user: Annotated[Usuario, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
    page: PaginationParams,
):
    """
    Return one page of history entries of the authenticated user, newest first,
    enriched with the restaurant details from Google Places.
    Envelope: `{items, total, limit, offset}`; `total` counts the stored entries.
    """
    uid = _get_uid(current_user)
    entries, total = history_service.get_history(db, uid, page.limit, page.offset)

    import asyncio
    from app.services.recommendation_service import recommendation_service

    # Fetch details of all restaurants in parallel
    tasks = [recommendation_service.get_place_details(entry.place_id) for entry in entries]
    details_list = await asyncio.gather(*tasks)

    # Merge history info with the restaurant details (skip entries whose restaurant is not found)
    results = [_entry_dict(entry, details) for entry, details in zip(entries, details_list) if details]
    return page_envelope(results, total, page)


@router.get("/popular", summary="Most visited restaurants (global)")
async def get_popular_history(
    db: Annotated[Session, Depends(get_db)],
    limit: Annotated[int, Query(ge=1, le=100)] = 5,
    location: Annotated[Optional[str], Query()] = None,
):
    """
    Return the globally most popular restaurants based on the history.
    If `location` is provided, filter the results so they are
    within ~30 km of it. Safe read, therefore GET with query parameters.
    """
    from app.services.recommendation_service import recommendation_service
    import asyncio

    # Take a top 20 to get a better sample for the geographic filter
    top_places = history_service.get_popular_places(db, limit=max(20, limit * 2))

    tasks = [recommendation_service.get_place_details(place_id) for place_id, _ in top_places]
    details_list = await asyncio.gather(*tasks)

    results = []
    for (place_id, visit_count), details in zip(top_places, details_list):
        if not details: continue
        details['visit_count'] = visit_count
        results.append(details)

    if location:
        lat, lng = await recommendation_service._geocode_location(location)
        if lat is not None and lng is not None:
            from app.services.recommendation_service import RecommendationService
            filtered_results = [
                r for r in results
                if r.get("latitude") is not None
                and r.get("longitude") is not None
                and RecommendationService._haversine(lat, lng, r["latitude"], r["longitude"]) <= 30.0
            ]
            results = filtered_results

    return results[:limit]

@router.post("", status_code=201, summary="Add a restaurant to the history")
async def add_to_history(
    data: HistoryEntryCreate,
    response: Response,
    current_user: Annotated[Usuario, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
):
    """
    Add a restaurant to the history and return the entry with its details.
    The `Location` header points to `/api/v1/history/{entry_id}`.
    """
    uid = _get_uid(current_user)
    entry = history_service.add_to_history(db, uid, data.place_id)

    from app.services.recommendation_service import recommendation_service
    details = await recommendation_service.get_place_details(entry.place_id)

    response.headers["Location"] = f"{settings.API_V1_STR}/history/{entry.id}"
    return _entry_dict(entry, details)


@router.get("/{entry_id}", summary="Get one history entry", responses={404: {"description": ENTRY_NOT_FOUND}})
async def get_history_entry(
    entry_id: int,
    current_user: Annotated[Usuario, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
):
    """Return one history entry of the authenticated user with its restaurant details."""
    uid = _get_uid(current_user)
    entry = history_service.get_history_entry(db, entry_id, uid)
    if not entry:
        raise HTTPException(status_code=404, detail=ENTRY_NOT_FOUND)

    from app.services.recommendation_service import recommendation_service
    details = await recommendation_service.get_place_details(entry.place_id)
    return _entry_dict(entry, details)


@router.delete("/{entry_id}", status_code=204, responses={404: {"description": ENTRY_NOT_FOUND}})
async def delete_from_history(
    entry_id: int,
    current_user: Annotated[Usuario, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
):
    """
    Delete a restaurant from the authenticated user's history.
    """
    uid = _get_uid(current_user)
    success = history_service.delete_from_history(db, entry_id, uid)
    if not success:
        raise HTTPException(status_code=404, detail=ENTRY_NOT_FOUND)
