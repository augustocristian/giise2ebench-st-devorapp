from datetime import datetime
from pydantic import BaseModel


class HistorialEntryCreate(BaseModel):
    """Body del POST /api/historial — sólo necesita el place_id."""
    place_id: str


class HistorialEntryResponse(BaseModel):
    """Respuesta serializada de una entrada del historial."""
    id: int
    user_id: str
    place_id: str
    fecha_acceso: datetime

    model_config = {"from_attributes": True}


class PopularPlacesRequest(BaseModel):
    """Body para solicitar lugares populares sin exponer ubicación en URL."""
    limit: int = 5
    location: str | None = None
