from sqlalchemy import Column, ForeignKey, Integer, String
from sqlalchemy.orm import relationship
from app.infrastructure.database import Base

class SavedForLater(Base):
    __tablename__ = "saved_for_later"

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(String, nullable=False, index=True)
    restaurant_id = Column(Integer, ForeignKey("restaurants.id"), nullable=False, index=True)

    # Relationship to easily access the place_id
    restaurant = relationship("Restaurant", lazy="joined")

    @property
    def place_id(self) -> str:
        return self.restaurant.place_id if self.restaurant else None

    def __repr__(self) -> str:
        return (
            f"<MasTarde id={self.id} user_id={self.user_id!r} "
            f"restaurant_id={self.restaurant_id}>"
        )
