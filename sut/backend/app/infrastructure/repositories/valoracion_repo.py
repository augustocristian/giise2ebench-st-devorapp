from sqlalchemy.orm import Session
from typing import List, Set
from app.models.entities.valoracion import Valoracion
from app.models.entities.valoracion_like import LikeValoracion
from app.models.entities.restaurante import Restaurante
from app.models.dtos.valoracion_dto import ValoracionCreate
from app.infrastructure.repositories import restaurante_repo

def crear_o_actualizar_valoracion(db: Session, user_id: str, data: ValoracionCreate) -> Valoracion:
    restaurante_id = restaurante_repo.get_or_create_restaurante(db, data.place_id)
    
    valoracion = db.query(Valoracion).filter(
        Valoracion.user_id == user_id,
        Valoracion.restaurante_id == restaurante_id
    ).first()

    if valoracion:
        valoracion.calidad = data.calidad
        valoracion.precio = data.precio
        valoracion.higiene = data.higiene
        valoracion.trato = data.trato
        valoracion.comentario = data.comentario
    else:
        valoracion = Valoracion(
            user_id=user_id,
            restaurante_id=restaurante_id,
            calidad=data.calidad,
            precio=data.precio,
            higiene=data.higiene,
            trato=data.trato,
            comentario=data.comentario,
            me_gustas=0,
        )
        db.add(valoracion)
    
    db.commit()
    db.refresh(valoracion)
    return valoracion

def obtener_todas_las_valoraciones_usuario(db: Session, user_id: str) -> List[Valoracion]:
    return db.query(Valoracion).filter(
        Valoracion.user_id == user_id
    ).order_by(Valoracion.id.desc()).all()

def obtener_valoracion_usuario_por_place_id(db: Session, user_id: str, place_id: str) -> Valoracion | None:
    restaurante = restaurante_repo.get_restaurante_by_place_id(db, place_id)
    if not restaurante:
        return None
        
    return db.query(Valoracion).filter(
        Valoracion.user_id == user_id,
        Valoracion.restaurante_id == restaurante.id
    ).first()

def eliminar_valoracion(db: Session, user_id: str, place_id: str) -> bool:
    restaurante = restaurante_repo.get_restaurante_by_place_id(db, place_id)
    if not restaurante:
        return False
        
    valoracion = db.query(Valoracion).filter(
        Valoracion.user_id == user_id,
        Valoracion.restaurante_id == restaurante.id
    ).first()
    
    if valoracion:
        db.delete(valoracion)
        db.commit()
        return True
    return False

def obtener_valoraciones_por_place_id(db: Session, place_id: str) -> List[Valoracion]:
    """Devuelve todas las reseñas de un restaurante ordenadas por me_gustas desc."""
    restaurante = restaurante_repo.get_restaurante_by_place_id(db, place_id)
    if not restaurante:
        return []
        
    return db.query(Valoracion).filter(
        Valoracion.restaurante_id == restaurante.id
    ).order_by(Valoracion.me_gustas.desc(), Valoracion.id.desc()).all()

def alternar_me_gusta(db: Session, user_id: str, valoracion_id: int) -> Valoracion | None:
    """
    Si el usuario ya dio like, lo quita. Si no, lo añade.
    Actualiza el contador 'me_gustas' de la valoración.
    """
    valoracion = db.query(Valoracion).filter(Valoracion.id == valoracion_id).first()
    if not valoracion:
        return None

    like_existente = db.query(LikeValoracion).filter(
        LikeValoracion.user_id == user_id,
        LikeValoracion.valoracion_id == valoracion_id
    ).first()

    if like_existente:
        # Quitar like
        db.delete(like_existente)
        valoracion.me_gustas = max(0, (valoracion.me_gustas or 0) - 1)
    else:
        # Añadir like
        nuevo_like = LikeValoracion(user_id=user_id, valoracion_id=valoracion_id)
        db.add(nuevo_like)
        valoracion.me_gustas = (valoracion.me_gustas or 0) + 1

    db.commit()
    db.refresh(valoracion)
    return valoracion

def obtener_ids_valoraciones_likeadas_por_usuario(db: Session, user_id: str, valoracion_ids: List[int]) -> Set[int]:
    """Devuelve un conjunto con los IDs de las valoraciones a las que el usuario ha dado like."""
    likes = db.query(LikeValoracion.valoracion_id).filter(
        LikeValoracion.user_id == user_id,
        LikeValoracion.valoracion_id.in_(valoracion_ids)
    ).all()
    return {l[0] for l in likes}
