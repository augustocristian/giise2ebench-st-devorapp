"""
Router for restaurants saved for later.

Endpoints:
  GET    /api/v1/saved-for-later             - paginated list
  POST   /api/v1/saved-for-later             - adds a restaurant (201 + Location, or 200 if already saved)
  GET    /api/v1/saved-for-later/{entry_id}  - one entry
  DELETE /api/v1/saved-for-later/{entry_id}  - deletes an entry
"""
from typing import Annotated, List
import asyncio

from fastapi import APIRouter, Depends, HTTPException, Response
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.security import get_current_user
from app.infrastructure.database import get_db
from app.models.dtos.saved_for_later_dto import SavedForLaterCreate, SavedForLaterResponse
from app.models.entities.usuarios import Usuario
from app.services import saved_for_later_service
from app.services.recommendation_service import recommendation_service
from app.presentation.router_utils import get_firebase_uid as _get_uid, PaginationParams, page_envelope

router = APIRouter(prefix=f"{settings.API_V1_STR}/saved-for-later", tags=["Saved For Later"])


ENTRY_NOT_FOUND = "Entrada no encontrada o no autorizada"


def _entry_dict(entry, details, already_saved=None) -> dict:
    data = {
        "id": entry.id,
        "user_id": entry.user_id,
        "place_id": entry.place_id,
        "restaurant": details,
    }
    if already_saved is not None:
        data["already_saved"] = already_saved
    return data


@router.get("", summary="List the saved-for-later restaurants (paginated)")
async def get_save_for_later(
    current_user: Annotated[Usuario, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
    page: PaginationParams,
):
    """
    Return one page of the user's Save for later entries, enriched with
    Google Places details. Envelope: `{items, total, limit, offset}`.
    """
    uid = _get_uid(current_user)
    entries, total = saved_for_later_service.get_save_for_later(db, uid, page.limit, page.offset)

    # Fetch details of all restaurants in parallel
    tasks = [recommendation_service.get_place_details(entry.place_id) for entry in entries]
    details_list = await asyncio.gather(*tasks)

    results = [_entry_dict(entry, details) for entry, details in zip(entries, details_list) if details]
    return page_envelope(results, total, page)


@router.post("", status_code=201, summary="Save a restaurant for later", responses={
    200: {"description": "El restaurante ya estaba guardado: se devuelve la entrada existente (already_saved=true), sin Location"},
})
async def add_to_save_for_later(
    data: SavedForLaterCreate,
    response: Response,
    current_user: Annotated[Usuario, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
):
    """
    Add a restaurant to Save for later. A new entry answers 201 with
    `Location: /api/v1/saved-for-later/{entry_id}`; if it was already saved the existing
    entry is returned with 200 and `already_saved: true`.
    """
    uid = _get_uid(current_user)
    entry, already_saved = saved_for_later_service.add_to_save_for_later(db, uid, data.place_id)

    details = await recommendation_service.get_place_details(entry.place_id)

    if already_saved:
        response.status_code = 200
    else:
        response.headers["Location"] = f"{settings.API_V1_STR}/saved-for-later/{entry.id}"
    return _entry_dict(entry, details, already_saved)


@router.get("/{entry_id}", summary="Get one saved-for-later entry", responses={404: {"description": ENTRY_NOT_FOUND}})
async def get_save_for_later_entry(
    entry_id: int,
    current_user: Annotated[Usuario, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
):
    """Return one Save for later entry of the authenticated user with its restaurant details."""
    uid = _get_uid(current_user)
    entry = saved_for_later_service.get_save_for_later_entry(db, entry_id, uid)
    if not entry:
        raise HTTPException(status_code=404, detail=ENTRY_NOT_FOUND)
    details = await recommendation_service.get_place_details(entry.place_id)
    return _entry_dict(entry, details)


@router.delete("/{entry_id}", status_code=204, responses={404: {"description": ENTRY_NOT_FOUND}})
async def delete_from_save_for_later(
    entry_id: int,
    current_user: Annotated[Usuario, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
):
    """
    Remove a restaurant from the authenticated user's Save for later.
    """
    uid = _get_uid(current_user)
    success = saved_for_later_service.delete_from_save_for_later(db, entry_id, uid)
    if not success:
        raise HTTPException(status_code=404, detail=ENTRY_NOT_FOUND)
