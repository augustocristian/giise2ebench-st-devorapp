from sqlalchemy.orm import Session
from typing import List
from app.models.dtos.valoracion_dto import ValoracionCreate, ValoracionResponse, ValoracionPublicaResponse
from app.infrastructure.repositories import valoracion_repo


def _build_valoracion_publica(
    v,
    username: str,
    ha_dado_me_gusta: bool,
) -> ValoracionPublicaResponse:
    """Construye un ValoracionPublicaResponse a partir de la entidad y metadatos del usuario."""
    return ValoracionPublicaResponse(
        id=v.id,
        username=username,
        calidad=v.calidad,
        precio=v.precio,
        higiene=v.higiene,
        trato=v.trato,
        comentario=v.comentario,
        me_gustas=v.me_gustas or 0,
        ha_dado_me_gusta=ha_dado_me_gusta,
        fecha=v.fecha,
    )


def valorar_restaurante(db: Session, user_id: str, data: ValoracionCreate) -> ValoracionResponse:
    valoracion = valoracion_repo.crear_o_actualizar_valoracion(db, user_id, data)
    return ValoracionResponse.model_validate(valoracion)

def obtener_todas_mis_valoraciones(db: Session, user_id: str) -> List[ValoracionResponse]:
    valoraciones = valoracion_repo.obtener_todas_las_valoraciones_usuario(db, user_id)
    return [ValoracionResponse.model_validate(v) for v in valoraciones]

def obtener_mi_valoracion(db: Session, user_id: str, place_id: str) -> dict:
    valoracion = valoracion_repo.obtener_valoracion_usuario_por_place_id(db, user_id, place_id)
    if valoracion:
        return ValoracionResponse.model_validate(valoracion).model_dump()
    return {}

def eliminar_valoracion(db: Session, user_id: str, place_id: str) -> bool:
    return valoracion_repo.eliminar_valoracion(db, user_id, place_id)

def obtener_resenas_restaurante(db: Session, place_id: str, current_user_id: str = None) -> List[ValoracionPublicaResponse]:
    """Devuelve todas las reseñas de un restaurante enriquecidas con el username del autor y si el usuario actual le dio like."""
    from app.infrastructure.repositories import usuario_repo
    valoraciones = valoracion_repo.obtener_valoraciones_por_place_id(db, place_id)

    # Obtener IDs de valoraciones que el usuario actual ha likeado para marcarlas
    likes_usuario = set()
    if current_user_id:
        v_ids = [v.id for v in valoraciones]
        likes_usuario = valoracion_repo.obtener_ids_valoraciones_likeadas_por_usuario(db, current_user_id, v_ids)

    result = []
    for v in valoraciones:
        usuario = usuario_repo.get_usuario_by_uid(v.user_id)
        username = usuario.username if usuario else "Usuario desconocido"
        result.append(_build_valoracion_publica(v, username, v.id in likes_usuario))
    return result

def dar_me_gusta(db: Session, user_id: str, valoracion_id: int) -> ValoracionPublicaResponse | None:
    """Alterna (añade/quita) el 'me gusta' de un usuario a una valoración."""
    from app.infrastructure.repositories import usuario_repo
    valoracion = valoracion_repo.alternar_me_gusta(db, user_id, valoracion_id)
    if not valoracion:
        return None

    # Verificar si el like quedó activo tras el toggle
    ids_likeados = valoracion_repo.obtener_ids_valoraciones_likeadas_por_usuario(db, user_id, [valoracion_id])
    ha_quedado_like = valoracion_id in ids_likeados

    usuario = usuario_repo.get_usuario_by_uid(valoracion.user_id)
    username = usuario.username if usuario else "Usuario desconocido"
    return _build_valoracion_publica(valoracion, username, ha_quedado_like)
