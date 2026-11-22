from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.orm import Session
from app.models.entities.restaurant import Restaurant

def get_or_create_restaurant(db: Session, place_id: str) -> int:
    """
    Ensure the restaurant exists in the `restaurants` table and return its internal ID.
    Uses the INSERT ... ON CONFLICT DO UPDATE pattern so the ID is always returned.
    """
    stmt = insert(Restaurant).values(place_id=place_id)
    
    # So RETURNING id works in PostgreSQL even if the row exists,
    # do a dummy SET instead of DO NOTHING.
    stmt = stmt.on_conflict_do_update(
        index_elements=['place_id'],
        set_={'place_id': place_id}
    ).returning(Restaurant.id)
    
    result = db.execute(stmt)
    db.commit()
    res = result.scalar()
    if res is None:
        raise ValueError("Could not get the restaurant ID after the insert.")
    return res

def get_restaurant_by_id(db: Session, restaurant_id: int) -> Restaurant | None:
    return db.query(Restaurant).filter(Restaurant.id == restaurant_id).first()

def get_restaurant_by_place_id(db: Session, place_id: str) -> Restaurant | None:
    return db.query(Restaurant).filter(Restaurant.place_id == place_id).first()
