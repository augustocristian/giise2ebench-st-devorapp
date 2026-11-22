from typing import Annotated, List

from fastapi import APIRouter, Depends, HTTPException, Response
from sqlalchemy.orm import Session

from app.core.security import get_current_user
from app.infrastructure.database import get_db
from app.models.dtos.favorites_dto import FavoriteListCreate, FavoriteListUpdate, FavoriteCreate
from app.models.entities.usuarios import Usuario
from app.services import favorites_service
from app.services.favorites_service import ConflictError
from app.core.config import settings
from app.presentation.router_utils import get_firebase_uid as _get_uid

router = APIRouter(prefix=f"{settings.API_V1_STR}/favorites", tags=["Favorites"])

LIST_NOT_FOUND_OR_UNAUTHORIZED = "Lista no encontrada o no autorizada"


# ── Listas ───────────────────────────────────────────────────────────────────

@router.get("/lists")
async def get_lists(
    current_user: Annotated[Usuario, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
):
    """Return all favorites lists of the authenticated user."""
    uid = _get_uid(current_user)
    return favorites_service.get_lists(db, uid)


@router.post("/lists", status_code=201, responses={
    409: {"description": "Ya existe una lista con ese nombre"},
    422: {"description": "Nombre de lista inválido"},
})
async def create_list(
    data: FavoriteListCreate,
    response: Response,
    current_user: Annotated[Usuario, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
):
    """Create a new favorites list."""
    uid = _get_uid(current_user)
    try:
        created = favorites_service.create_list(db, uid, data.name, data.icon)
    except ConflictError as e:
        raise HTTPException(status_code=409, detail=str(e))
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))
    response.headers["Location"] = f"{settings.API_V1_STR}/favorites/lists/{created.id}"
    return created


@router.delete("/lists/{list_id}", status_code=204, responses={404: {"description": LIST_NOT_FOUND_OR_UNAUTHORIZED}})
async def delete_list(
    list_id: int,
    current_user: Annotated[Usuario, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
):
    """Delete a favorites list and all the restaurants it contained."""
    uid = _get_uid(current_user)
    success = favorites_service.delete_list(db, list_id, uid)
    if not success:
        raise HTTPException(status_code=404, detail=LIST_NOT_FOUND_OR_UNAUTHORIZED)


@router.patch("/lists/{list_id}", responses={
    409: {"description": "Ya existe otra lista con ese nombre"},
    422: {"description": "Nombre de lista inválido"},
    404: {"description": LIST_NOT_FOUND_OR_UNAUTHORIZED}
})
async def update_list(
    list_id: int,
    data: FavoriteListUpdate,
    current_user: Annotated[Usuario, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
):
    """Update the name of a favorites list."""
    uid = _get_uid(current_user)
    try:
        favorites_list = favorites_service.update_list(db, list_id, uid, data.name)
        if not favorites_list:
            raise HTTPException(status_code=404, detail=LIST_NOT_FOUND_OR_UNAUTHORIZED)
        return favorites_list
    except ConflictError as e:
        raise HTTPException(status_code=409, detail=str(e))
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))


# ── Favorites of a list ───────────────────────────────────────────────────

@router.get("/lists/{list_id}", responses={404: {"description": LIST_NOT_FOUND_OR_UNAUTHORIZED}})
async def get_list_detail(
    list_id: int,
    current_user: Annotated[Usuario, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
):
    """
    Return the restaurants of a list, enriched with Google Places details.
    """
    uid = _get_uid(current_user)
    favorites_list = favorites_service.get_list_by_id(db, list_id, uid)
    if not favorites_list:
        raise HTTPException(status_code=404, detail=LIST_NOT_FOUND_OR_UNAUTHORIZED)

    favorites = favorites_service.get_favorites(db, list_id)

    import asyncio
    from app.services.recommendation_service import recommendation_service

    tasks = [recommendation_service.get_place_details(f.place_id) for f in favorites]
    details_list = await asyncio.gather(*tasks)

    results = []
    for fav, details in zip(favorites, details_list):
        if not details:
            continue
        results.append({
            "id": fav.id,
            "list_id": fav.list_id,
            "place_id": fav.place_id,
            "restaurant": details,
        })

    return {"list": favorites_list, "restaurants": results}


@router.post("/lists/{list_id}/restaurants", status_code=201, responses={
    409: {"description": "El restaurante ya se encuentra en la lista"},
    404: {"description": LIST_NOT_FOUND_OR_UNAUTHORIZED}
})
async def add_favorite(
    list_id: int,
    data: FavoriteCreate,
    response: Response,
    current_user: Annotated[Usuario, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
):
    """Add a restaurant to the given list."""
    uid = _get_uid(current_user)
    favorites_list = favorites_service.get_list_by_id(db, list_id, uid)
    if not favorites_list:
        raise HTTPException(status_code=404, detail=LIST_NOT_FOUND_OR_UNAUTHORIZED)

    try:
        fav = favorites_service.add_favorite(db, list_id, data.place_id)
    except ValueError as e:
        raise HTTPException(status_code=409, detail=str(e))

    response.headers["Location"] = f"{settings.API_V1_STR}/favorites/lists/{list_id}/restaurants/{fav.id}"
    from app.services.recommendation_service import recommendation_service
    details = await recommendation_service.get_place_details(fav.place_id)

    return {
        "id": fav.id,
        "list_id": fav.list_id,
        "place_id": fav.place_id,
        "restaurant": details,
    }


# ── Eliminar favorite ─────────────────────────────────────────────────────────

@router.delete("/lists/{list_id}/restaurants/{favorite_id}", status_code=204, responses={404: {"description": "Favorito no encontrado o no autorizado"}})
async def delete_favorite(
    list_id: int,
    favorite_id: int,
    current_user: Annotated[Usuario, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
):
    """Remove a restaurant from favorites, checking the user owns it."""
    uid = _get_uid(current_user)
    success = favorites_service.delete_favorite(db, list_id, favorite_id, uid)
    if not success:
        raise HTTPException(status_code=404, detail="Favorito no encontrado o no autorizado")
