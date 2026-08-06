from pydantic import BaseModel

class MasTardeCreate(BaseModel):
    """Body del POST /api/mas-tarde — sólo necesita el place_id."""
    place_id: str

class MasTardeResponse(BaseModel):
    """Respuesta serializada de una entrada de Guardar para más tarde."""
    id: int
    user_id: str
    place_id: str

    model_config = {"from_attributes": True}
