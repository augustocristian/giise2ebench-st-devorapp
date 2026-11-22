from sqlalchemy import Column, Integer, String

from app.infrastructure.database import Base


class FavoriteList(Base):
    __tablename__ = "favorite_lists"

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(String, nullable=False, index=True)
    name = Column(String, nullable=False)
    icon = Column(String, nullable=False, default="Heart")

    def __repr__(self) -> str:
        return f"<FavoriteList id={self.id} user_id={self.user_id!r} name={self.name!r} icon={self.icon!r}>"
