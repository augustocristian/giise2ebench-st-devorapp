from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.orm import Session
from app.models.entities.restaurante import Restaurante

def get_or_create_restaurante(db: Session, place_id: str) -> int:
    """
    Asegura que el restaurante existe en la tabla `restaurantes` y devuelve su ID interno.
    Utiliza el patrón INSERT ... ON CONFLICT DO UPDATE para obtener siempre el ID.
    """
    stmt = insert(Restaurante).values(place_id=place_id)
    
    # Para que RETURNING id funcione en PostgreSQL incluso si ya existe,
    # realizamos un "SET ficticio" en lugar de DO NOTHING.
    stmt = stmt.on_conflict_do_update(
        index_elements=['place_id'],
        set_={'place_id': place_id}
    ).returning(Restaurante.id)
    
    result = db.execute(stmt)
    db.commit()
    res = result.scalar()
    if res is None:
        raise ValueError("No se pudo obtener el ID del restaurante tras la inserción.")
    return res

def get_restaurante_by_id(db: Session, restaurante_id: int) -> Restaurante | None:
    return db.query(Restaurante).filter(Restaurante.id == restaurante_id).first()

def get_restaurante_by_place_id(db: Session, place_id: str) -> Restaurante | None:
    return db.query(Restaurante).filter(Restaurante.place_id == place_id).first()
