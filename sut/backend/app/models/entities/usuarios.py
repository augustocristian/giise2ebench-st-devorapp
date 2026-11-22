from pydantic import BaseModel
from typing import Optional


class Usuario(BaseModel):
    uid: Optional[str] = None
    username: str
    email: str
    first_name: str
    last_name: str
    location: str
    is_google: bool = False
