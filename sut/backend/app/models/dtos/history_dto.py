from datetime import datetime
from pydantic import BaseModel


class HistoryEntryCreate(BaseModel):
    """Body of POST /api/history: only needs the place_id."""
    place_id: str


class HistoryEntryResponse(BaseModel):
    """Serialized response of a history entry."""
    id: int
    user_id: str
    place_id: str
    accessed_at: datetime

    model_config = {"from_attributes": True}
