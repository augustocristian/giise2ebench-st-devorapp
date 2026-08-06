from pydantic import BaseModel
from typing import Optional


class Usuario(BaseModel):
    uid: Optional[str] = None
    username: str
    email: str
    nombre: str
    apellidos: str
    ubicacion: str
    is_google: bool = False
