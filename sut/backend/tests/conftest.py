import sys
import unittest.mock as mock

# Firebase mock must be installed in sys.modules BEFORE app.main is imported.
# app/main.py calls get_firebase_app() at module level, which would try to read
# firebase-service-account.json. Replacing the real module with a MagicMock
# makes credentials.Certificate() and initialize_app() no-ops for tests.
_fb = mock.MagicMock()
# Firebase exception classes must be real exceptions so they can be caught with `except`
_fb.UserNotFoundError = type("UserNotFoundError", (Exception,), {})
_fb.EmailAlreadyExistsError = type("EmailAlreadyExistsError", (Exception,), {})
_fb.FirebaseError = type("FirebaseError", (Exception,), {})
_fb.auth = mock.MagicMock()
_fb.auth.UserNotFoundError = _fb.UserNotFoundError
_fb.auth.EmailAlreadyExistsError = _fb.EmailAlreadyExistsError
_fb.exceptions = mock.MagicMock()
_fb.exceptions.FirebaseError = _fb.FirebaseError
for _mod in ("firebase_admin", "firebase_admin.credentials",
             "firebase_admin.firestore", "firebase_admin.auth",
             "firebase_admin.exceptions"):
    sys.modules.setdefault(_mod, _fb)

import pytest
from httpx import AsyncClient, ASGITransport
from app.main import app
from app.models.entities.usuarios import Usuario


@pytest.fixture(scope="session")
def anyio_backend():
    return "asyncio"


@pytest.fixture(scope="function")
async def async_client():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=ASGITransport(app=app), base_url="https://test") as client:
        yield client


@pytest.fixture
def dummy_user():
    """Usuario autenticado reutilizable en todos los test files."""
    return Usuario(
        id="test_uid",
        email="test@test.com",
        username="testuser",
        nombre="Test",
        apellidos="User",
        ubicacion="Madrid",
    )
