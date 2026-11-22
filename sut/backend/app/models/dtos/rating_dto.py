from pydantic import BaseModel, Field
from datetime import datetime
from typing import Optional

class RatingUpsert(BaseModel):
    """Body of PUT /restaurants/{place_id}/rating (the place_id lives in the URL)."""
    quality: int = Field(ge=1, le=5)
    price: int = Field(ge=1, le=5)
    hygiene: int = Field(ge=1, le=5)
    service: int = Field(ge=1, le=5)
    comment: Optional[str] = None

class RatingBase(BaseModel):
    place_id: str
    quality: int = Field(ge=1, le=5)
    price: int = Field(ge=1, le=5)
    hygiene: int = Field(ge=1, le=5)
    service: int = Field(ge=1, le=5)
    comment: Optional[str] = None

class RatingResponse(RatingBase):
    id: int
    user_id: str
    likes: int = 0
    created_at: datetime

    model_config = {
        "from_attributes": True
    }

class PublicRatingResponse(BaseModel):
    """DTO that exposes a restaurant's reviews to all users."""
    id: int
    username: str
    quality: int
    price: int
    hygiene: int
    service: int
    comment: Optional[str] = None
    likes: int = 0
    liked_by_me: bool = False
    created_at: datetime

    model_config = {
        "from_attributes": True
    }

