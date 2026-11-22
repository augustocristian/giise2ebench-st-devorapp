from sqlalchemy import Column, Integer, String, ForeignKey, UniqueConstraint
from app.infrastructure.database import Base

class RatingLike(Base):
    """
    Entity that tracks which user liked which rating.
    It enables the Like/Unlike logic and prevents duplicates.
    """
    __tablename__ = "rating_likes"

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(String, nullable=False, index=True)
    rating_id = Column(Integer, ForeignKey("ratings.id", ondelete="CASCADE"), nullable=False, index=True)

    __table_args__ = (
        UniqueConstraint("user_id", "rating_id", name="uq_user_rating_like"),
    )

    def __repr__(self) -> str:
        return f"<RatingLike user_id={self.user_id!r} rating_id={self.rating_id}>"
