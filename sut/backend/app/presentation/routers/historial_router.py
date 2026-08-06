"""
Router del historial de restaurantes.

Endpoints:
  GET  /api/historial  — devuelve el historial del usuario autenticado
  POST /api/historial  — añade un restaurante al historial
"""
from typing import Annotated, List

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.security import get_current_user
from app.infrastructure.database import get_db
from app.models.dtos.historial_dto import HistorialEntryCreate, HistorialEntryResponse, PopularPlacesRequest
from app.models.entities.usuarios import Usuario
from app.services import historial_service
from app.presentation.router_utils import get_firebase_uid as _get_uid

router = APIRouter(prefix="/api/historial", tags=["Historial"])


@router.get("")
async def get_historial(
    current_user: Annotated[Usuario, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
):
    """
    Devuelve todas las entradas del historial del usuario autenticado,
    enriquecidas con los detalles del restaurante desde Google Places.
    """
    uid = _get_uid(current_user)
    entries = historial_service.get_historial(db, uid)
    
    import asyncio
    from app.services.recommendation_service import recommendation_service
    
    # Obtenemos detalles de todos los restaurantes en paralelo
    tasks = [recommendation_service.get_place_details(entry.place_id) for entry in entries]
    details_list = await asyncio.gather(*tasks)
    
    # Combinamos la info del historial con los detalles del restaurante
    results = []
    for entry, details in zip(entries, details_list):
        if not details: continue # Omitir si no se encuentra
        results.append({
            "id": entry.id,
            "user_id": entry.user_id,
            "place_id": entry.place_id,
            "fecha_acceso": entry.fecha_acceso,
            "restaurant": details
        })
    
    return results


@router.post("/populares")
async def get_popular_historial(
    data: PopularPlacesRequest,
    db: Annotated[Session, Depends(get_db)],
):
    """
    Devuelve los restaurantes más populares globalmente en base al historial.
    Si se proporciona una ubicación, filtra los resultados para que estén
    a un máximo de ~30 km de la misma.
    """
    from app.services.recommendation_service import recommendation_service
    import asyncio
    import math

    # Para tener mejor muestra para el filtro geográfico, cogemos un top 20
    top_places = historial_service.get_popular_places(db, limit=max(20, data.limit * 2))
    
    tasks = [recommendation_service.get_place_details(place_id) for place_id, _ in top_places]
    details_list = await asyncio.gather(*tasks)
    
    results = []
    for (place_id, visit_count), details in zip(top_places, details_list):
        if not details: continue
        details['visit_count'] = visit_count
        results.append(details)
        
    if data.location:
        lat, lng = await recommendation_service._geocode_location(data.location)
        if lat is not None and lng is not None:
            from app.services.recommendation_service import RecommendationService
            filtered_results = [
                r for r in results
                if r.get("latitude") is not None
                and r.get("longitude") is not None
                and RecommendationService._haversine(lat, lng, r["latitude"], r["longitude"]) <= 30.0
            ]
            results = filtered_results
            
    return results[:data.limit]

@router.post("", status_code=201)
async def add_to_historial(
    data: HistorialEntryCreate,
    current_user: Annotated[Usuario, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
):
    """
    Añade un restaurante al historial y devuelve la entrada con sus detalles.
    """
    uid = _get_uid(current_user)
    entry = historial_service.add_to_historial(db, uid, data.place_id)
    
    from app.services.recommendation_service import recommendation_service
    details = await recommendation_service.get_place_details(entry.place_id)
    
    return {
        "id": entry.id,
        "user_id": entry.user_id,
        "place_id": entry.place_id,
        "fecha_acceso": entry.fecha_acceso,
        "restaurant": details
    }


@router.delete("/{entry_id}", status_code=204, responses={404: {"description": "Entrada de historial no encontrada o no autorizada"}})
async def delete_from_historial(
    entry_id: int,
    current_user: Annotated[Usuario, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
):
    """
    Elimina un restaurante del historial del usuario autenticado.
    """
    uid = _get_uid(current_user)
    success = historial_service.delete_from_historial(db, entry_id, uid)
    if not success:
        raise HTTPException(status_code=404, detail="Entrada de historial no encontrada o no autorizada")
