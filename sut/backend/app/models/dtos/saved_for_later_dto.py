from pydantic import BaseModel

class SavedForLaterCreate(BaseModel):
    """Body of POST /api/saved-for-later: only needs the place_id."""
    place_id: str

class SavedForLaterResponse(BaseModel):
    """Serialized response of a Save for later entry."""
    id: int
    user_id: str
    place_id: str

    model_config = {"from_attributes": True}
