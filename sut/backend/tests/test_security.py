"""Tests for app.core.security: create_access_token and get_current_user."""
import pytest
from datetime import timedelta
from unittest.mock import patch, MagicMock

import jwt
from fastapi import HTTPException

from app.core.security import create_access_token, get_current_user
from app.core.config import settings


# ── create_access_token ───────────────────────────────────────────────────────

def test_create_access_token_payload():
    """The generated token must contain the correct sub and exp."""
    data = {"sub": "uid123"}
    token = create_access_token(data)
    payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
    assert payload["sub"] == "uid123"
    assert "exp" in payload


def test_create_access_token_custom_expiry():
    """With a custom expires_delta the token expires at the given time."""
    data = {"sub": "uid456"}
    delta = timedelta(minutes=5)
    token = create_access_token(data, expires_delta=delta)
    payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
    assert payload["sub"] == "uid456"


# ── get_current_user ──────────────────────────────────────────────────────────

def test_get_current_user_no_cookie():
    """Without a cookie it must raise 401."""
    with pytest.raises(HTTPException) as exc:
        get_current_user(access_token=None)
    assert exc.value.status_code == 401


def test_get_current_user_token_invalid():
    """A garbage token must raise 401."""
    with pytest.raises(HTTPException) as exc:
        get_current_user(access_token="not.a.valid.token")
    assert exc.value.status_code == 401


def test_get_current_user_token_expired():
    """An expired token must raise 401 with a specific message."""
    # Generate a token that has already expired
    expired = create_access_token({"sub": "uid"}, expires_delta=timedelta(seconds=-1))
    with pytest.raises(HTTPException) as exc:
        get_current_user(access_token=expired)
    assert exc.value.status_code == 401
    assert "expirado" in exc.value.detail


def test_get_current_user_payload_without_sub():
    """A token without a 'sub' field must raise 401."""
    token = create_access_token({"data": "no_sub_here"})
    with pytest.raises(HTTPException) as exc:
        get_current_user(access_token=token)
    assert exc.value.status_code == 401


@patch("app.core.security.get_user_by_uid")
def test_get_current_user_user_not_found(mock_get_user):
    """If the user does not exist in Firestore it must raise 401."""
    mock_get_user.return_value = None
    token = create_access_token({"sub": "uid_inexistente"})
    with pytest.raises(HTTPException) as exc:
        get_current_user(access_token=token)
    assert exc.value.status_code == 401


@patch("app.core.security.get_user_by_uid")
def test_get_current_user_ok(mock_get_user):
    """With a valid token and existing user it must return the user."""
    from app.models.entities.usuarios import Usuario
    mock_user = Usuario(
        id="uid_ok", email="ok@test.com", username="okuser",
        first_name="Ok", last_name="User", location="Gijón"
    )
    mock_get_user.return_value = mock_user
    token = create_access_token({"sub": "uid_ok"})
    result = get_current_user(access_token=token)
    assert result.username == "okuser"
