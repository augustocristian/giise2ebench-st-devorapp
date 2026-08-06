"""
Router de los restaurantes guardados para más tarde.

Endpoints:
  GET  /api/mas-tarde  — devuelve lo guardado para más tarde
  POST /api/mas-tarde  — añade un restaurante
  DELETE /api/mas-tarde/{entry_id} — elimina una entrada
"""
from typing import Annotated, List
import asyncio

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.security import get_current_user
from app.infrastructure.database import get_db
from app.models.dtos.mas_tarde_dto import MasTardeCreate, MasTardeResponse
from app.models.entities.usuarios import Usuario
from app.services import mas_tarde_service
from app.services.recommendation_service import recommendation_service
from app.presentation.router_utils import get_firebase_uid as _get_uid

router = APIRouter(prefix="/api/mas-tarde", tags=["Mas Tarde"])


@router.get("")
async def get_mas_tarde(
    current_user: Annotated[Usuario, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
):
    """
    Devuelve todas las entradas de guardar para más tarde del usuario,
    enriquecidas con los detalles de Google Places.
    """
    uid = _get_uid(current_user)
    entries = mas_tarde_service.get_mas_tarde(db, uid)
    
    # Obtenemos detalles de todos los restaurantes en paralelo
    tasks = [recommendation_service.get_place_details(entry.place_id) for entry in entries]
    details_list = await asyncio.gather(*tasks)
    
    results = []
    for entry, details in zip(entries, details_list):
        if not details: continue
        results.append({
            "id": entry.id,
            "user_id": entry.user_id,
            "place_id": entry.place_id,
            "restaurant": details
        })
    
    return results


@router.post("", status_code=201)
async def add_to_mas_tarde(
    data: MasTardeCreate,
    current_user: Annotated[Usuario, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
):
    """
    Añade un restaurante a guardar para más tarde.
    """
    uid = _get_uid(current_user)
    entry, already_saved = mas_tarde_service.add_to_mas_tarde(db, uid, data.place_id)
    
    details = await recommendation_service.get_place_details(entry.place_id)
    
    return {
        "id": entry.id,
        "user_id": entry.user_id,
        "place_id": entry.place_id,
        "restaurant": details,
        "already_saved": already_saved
    }


@router.delete("/{entry_id}", status_code=204, responses={404: {"description": "Entrada no encontrada o no autorizada"}})
async def delete_from_mas_tarde(
    entry_id: int,
    current_user: Annotated[Usuario, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
):
    """
    Elimina un restaurante de guardar para más tarde del usuario autenticado.
    """
    uid = _get_uid(current_user)
    success = mas_tarde_service.delete_from_mas_tarde(db, entry_id, uid)
    if not success:
        raise HTTPException(status_code=404, detail="Entrada no encontrada o no autorizada")
