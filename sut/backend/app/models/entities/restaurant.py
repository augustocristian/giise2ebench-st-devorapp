from sqlalchemy import Column, Integer, String
from app.infrastructure.database import Base

class Restaurant(Base):
    """
    SQLAlchemy ORM model for the `restaurants` table.
    This table speeds up queries by using integer IDs
    instead of Google Places place_ids in other tables.
    """
    __tablename__ = "restaurants"

    id = Column(Integer, primary_key=True, autoincrement=True)
    place_id = Column(String, nullable=False, unique=True, index=True)

    def __repr__(self) -> str:
        return f"<Restaurant id={self.id} place_id={self.place_id!r}>"
