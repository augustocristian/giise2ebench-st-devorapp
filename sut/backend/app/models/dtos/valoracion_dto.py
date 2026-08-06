from pydantic import BaseModel, Field
from datetime import datetime
from typing import Optional

class ValoracionBase(BaseModel):
    place_id: str
    calidad: int = Field(ge=1, le=5)
    precio: int = Field(ge=1, le=5)
    higiene: int = Field(ge=1, le=5)
    trato: int = Field(ge=1, le=5)
    comentario: Optional[str] = None

class ValoracionCreate(ValoracionBase):
    pass

class ValoracionResponse(ValoracionBase):
    id: int
    user_id: str
    me_gustas: int = 0
    fecha: datetime

    model_config = {
        "from_attributes": True
    }

class ValoracionPublicaResponse(BaseModel):
    """DTO para exponer las reseñas de un restaurante a todos los usuarios."""
    id: int
    username: str
    calidad: int
    precio: int
    higiene: int
    trato: int
    comentario: Optional[str] = None
    me_gustas: int = 0
    ha_dado_me_gusta: bool = False
    fecha: datetime

    model_config = {
        "from_attributes": True
    }

