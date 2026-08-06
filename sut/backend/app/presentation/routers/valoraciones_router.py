from typing import Annotated, List

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.security import get_current_user
from app.infrastructure.database import get_db
from app.models.dtos.valoracion_dto import ValoracionCreate, ValoracionResponse, ValoracionPublicaResponse
from app.models.entities.usuarios import Usuario
from app.services import valoracion_service
from app.presentation.router_utils import get_firebase_uid as _get_uid


router = APIRouter(prefix="/api/valoraciones", tags=["Valoraciones"])


@router.post("", response_model=ValoracionResponse, status_code=201)
async def valorar_restaurante(
    data: ValoracionCreate,
    current_user: Annotated[Usuario, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
):
    """
    Crea o actualiza la valoración de un usuario para un restaurante.
    """
    uid = _get_uid(current_user)
    return valoracion_service.valorar_restaurante(db, uid, data)


@router.get("", )
async def obtener_todas_mis_valoraciones(
    current_user: Annotated[Usuario, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
):
    """
    Obtiene todas las valoraciones del usuario actual y adjunta
    los detalles del restaurante obtenidos de Google Places.
    """
    uid = _get_uid(current_user)
    valoraciones = valoracion_service.obtener_todas_mis_valoraciones(db, uid)
    
    import asyncio
    from app.services.recommendation_service import recommendation_service
    
    tasks = [recommendation_service.get_place_details(v.place_id) for v in valoraciones]
    details_list = await asyncio.gather(*tasks)
    
    results = []
    for val, details in zip(valoraciones, details_list):
        if not details: continue
        results.append({
            "id": val.id,
            "place_id": val.place_id,
            "calidad": val.calidad,
            "precio": val.precio,
            "higiene": val.higiene,
            "trato": val.trato,
            "comentario": val.comentario,
            "fecha": val.fecha,
            "restaurant": details
        })
    
    return results


@router.get("/restaurante/{place_id}", response_model=List[ValoracionPublicaResponse])
async def obtener_resenas_restaurante(
    place_id: str,
    current_user: Annotated[Usuario, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
):
    """
    Devuelve todas las reseñas de un restaurante (de todos los usuarios),
    incluyendo username, puntuaciones, comentario y me_gustas.
    """
    uid = _get_uid(current_user)
    return valoracion_service.obtener_resenas_restaurante(db, place_id, uid)


@router.post("/{valoracion_id}/like", response_model=ValoracionPublicaResponse, responses={404: {"description": "Valoración no encontrada"}})
async def dar_me_gusta(
    valoracion_id: int,
    current_user: Annotated[Usuario, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
):
    """
    Alterna el 'me gusta' de una valoración por parte del usuario actual.
    """
    uid = _get_uid(current_user)
    result = valoracion_service.dar_me_gusta(db, uid, valoracion_id)
    if not result:
        raise HTTPException(status_code=404, detail="Valoración no encontrada")
    return result


@router.get("/{place_id}")
async def obtener_mi_valoracion(
    place_id: str,
    current_user: Annotated[Usuario, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
):
    """
    Obtiene la valoración que el usuario actual le ha dado a un restaurante.
    Devuelve un objeto vacío si no hay valoración.
    """
    uid = _get_uid(current_user)
    return valoracion_service.obtener_mi_valoracion(db, uid, place_id)

@router.delete("/{place_id}", status_code=204, responses={404: {"description": "Valoración no encontrada o no autorizada"}})
async def eliminar_valoracion(
    place_id: str,
    current_user: Annotated[Usuario, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
):
    """
    Elimina la valoración de un usuario para un restaurante.
    """
    uid = _get_uid(current_user)
    success = valoracion_service.eliminar_valoracion(db, uid, place_id)
    if not success:
        raise HTTPException(status_code=404, detail="Valoración no encontrada o no autorizada")

