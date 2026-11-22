from sqlalchemy import Column, Integer, String, ForeignKey, DateTime
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.infrastructure.database import Base

class Rating(Base):
    __tablename__ = "ratings"

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(String, nullable=False, index=True)
    restaurant_id = Column(Integer, ForeignKey("restaurants.id"), nullable=False, index=True)
    quality = Column(Integer, nullable=False, default=0)
    price = Column(Integer, nullable=False, default=0)
    hygiene = Column(Integer, nullable=False, default=0)
    service = Column(Integer, nullable=False, default=0)
    comment = Column(String, nullable=True)
    likes = Column(Integer, nullable=False, default=0)
    created_at = Column(DateTime, server_default=func.now())

    # Relationship to easily access the place_id
    restaurant = relationship("Restaurant", lazy="joined")

    @property
    def place_id(self) -> str:
        return self.restaurant.place_id if self.restaurant else None

    def __repr__(self) -> str:
        return (
            f"<Rating id={self.id} user_id={self.user_id!r} "
            f"restaurant_id={self.restaurant_id} quality={self.quality}>"
        )
