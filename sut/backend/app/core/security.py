from datetime import datetime, timedelta, timezone
from typing import Optional

import jwt
from fastapi import Cookie, Depends, HTTPException, status

from app.core.config import settings
from app.models.entities.usuarios import Usuario
from app.infrastructure.repositories.usuario_repo import get_usuario_by_uid


def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    """Genera un JWT firmado con PyJWT."""
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + (
        expires_delta or timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    )
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)


def get_current_user(
    access_token: Optional[str] = Cookie(default=None),
) -> Usuario:
    """
    Dependencia FastAPI: decodifica el JWT de la cookie y carga el usuario
    desde Firebase Firestore.
    """
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="No autenticado o token inválido",
    )
    if access_token is None:
        raise credentials_exception
    try:
        payload = jwt.decode(
            access_token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM]
        )
        user_id: str = payload.get("sub")
        if user_id is None:
            raise credentials_exception
    except jwt.ExpiredSignatureError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token expirado, vuelve a iniciar sesión",
        )
    except jwt.InvalidTokenError:
        raise credentials_exception

    user = get_usuario_by_uid(user_id)
    if user is None:
        raise credentials_exception
    return user
