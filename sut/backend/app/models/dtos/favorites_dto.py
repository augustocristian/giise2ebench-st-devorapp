from pydantic import BaseModel


class FavoriteListCreate(BaseModel):
    """Body of POST /api/favorites/lists."""
    name: str
    icon: str = "Heart"


class FavoriteListResponse(BaseModel):
    """Serialized response of a favorites list."""
    id: int
    user_id: str
    name: str
    icon: str = "Heart"

    model_config = {"from_attributes": True}


class FavoriteListUpdate(BaseModel):
    """Body of PATCH /api/favorites/lists/{list_id}."""
    name: str


class FavoriteCreate(BaseModel):
    """Body of POST /favorites/lists/{list_id}/restaurants."""
    place_id: str


class FavoriteResponse(BaseModel):
    """Serialized response of a favorite."""
    id: int
    list_id: int
    place_id: str

    model_config = {"from_attributes": True}
