"""Tests para app.core.security: create_access_token y get_current_user."""
import pytest
from datetime import timedelta
from unittest.mock import patch, MagicMock

import jwt
from fastapi import HTTPException

from app.core.security import create_access_token, get_current_user
from app.core.config import settings


# ── create_access_token ───────────────────────────────────────────────────────

def test_create_access_token_payload():
    """El token generado debe contener el sub y exp correctos."""
    data = {"sub": "uid123"}
    token = create_access_token(data)
    payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
    assert payload["sub"] == "uid123"
    assert "exp" in payload


def test_create_access_token_custom_expiry():
    """Con expires_delta personalizado el token expira en el tiempo indicado."""
    data = {"sub": "uid456"}
    delta = timedelta(minutes=5)
    token = create_access_token(data, expires_delta=delta)
    payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
    assert payload["sub"] == "uid456"


# ── get_current_user ──────────────────────────────────────────────────────────

def test_get_current_user_sin_cookie():
    """Sin cookie debe elevar 401."""
    with pytest.raises(HTTPException) as exc:
        get_current_user(access_token=None)
    assert exc.value.status_code == 401


def test_get_current_user_token_invalido():
    """Token basura debe elevar 401."""
    with pytest.raises(HTTPException) as exc:
        get_current_user(access_token="not.a.valid.token")
    assert exc.value.status_code == 401


def test_get_current_user_token_expirado():
    """Token expirado debe elevar 401 con mensaje específico."""
    # Generar un token que ya expiró
    expired = create_access_token({"sub": "uid"}, expires_delta=timedelta(seconds=-1))
    with pytest.raises(HTTPException) as exc:
        get_current_user(access_token=expired)
    assert exc.value.status_code == 401
    assert "expirado" in exc.value.detail


def test_get_current_user_payload_sin_sub():
    """Token sin campo 'sub' debe elevar 401."""
    token = create_access_token({"data": "no_sub_here"})
    with pytest.raises(HTTPException) as exc:
        get_current_user(access_token=token)
    assert exc.value.status_code == 401


@patch("app.core.security.get_usuario_by_uid")
def test_get_current_user_usuario_no_encontrado(mock_get_user):
    """Si el usuario no existe en Firestore debe elevar 401."""
    mock_get_user.return_value = None
    token = create_access_token({"sub": "uid_inexistente"})
    with pytest.raises(HTTPException) as exc:
        get_current_user(access_token=token)
    assert exc.value.status_code == 401


@patch("app.core.security.get_usuario_by_uid")
def test_get_current_user_ok(mock_get_user):
    """Con token válido y usuario existente debe devolver el usuario."""
    from app.models.entities.usuarios import Usuario
    mock_user = Usuario(
        id="uid_ok", email="ok@test.com", username="okuser",
        nombre="Ok", apellidos="User", ubicacion="Gijón"
    )
    mock_get_user.return_value = mock_user
    token = create_access_token({"sub": "uid_ok"})
    result = get_current_user(access_token=token)
    assert result.username == "okuser"
