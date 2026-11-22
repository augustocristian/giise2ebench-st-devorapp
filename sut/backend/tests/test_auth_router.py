import pytest
from unittest.mock import patch, MagicMock
from app.models.entities.usuarios import Usuario

# --- ROUTER TESTS (service mocked) ---

@pytest.fixture
def mock_auth_service():
    with patch("app.presentation.routers.auth_router.auth_service") as mock_service:
        yield mock_service

@pytest.fixture
def dummy_user_entity():
    return Usuario(
        id="dummy_id",
        email="test@test.com",
        username="testuser",
        first_name="Test",
        last_name="User",
        location="Madrid",
    )

@pytest.mark.asyncio
async def test_login_success(async_client, mock_auth_service, dummy_user_entity):
    # Setup mock
    mock_auth_service.login.return_value = (dummy_user_entity, "fake_token")

    # Ejecutar request
    response = await async_client.post(
        "/api/v1/sessions",
        json={"identifier": "test@test.com", "password": "Password1"}
    )

    # Validaciones
    assert response.status_code == 201
    assert response.headers["location"] == "/api/v1/sessions/current"
    assert response.json() == {
        "message": "Login exitoso",
        "user": {
            "username": "testuser",
            "email": "test@test.com",
            "first_name": "Test",
            "last_name": "User",
            "location": "Madrid",
            "is_google": False,
        }
    }
    # Check that the cookie is set
    assert "access_token" in response.cookies
    assert response.cookies["access_token"] == "fake_token"


@pytest.mark.asyncio
async def test_register_success(async_client, mock_auth_service, dummy_user_entity):
    mock_auth_service.register.return_value = dummy_user_entity

    response = await async_client.post(
        "/api/v1/users",
        json={
            "email": "test@test.com",
            "password": "Password1",
            "username": "testuser",
            "first_name": "Test",
            "last_name": "User",
            "location": "Madrid",
        }
    )

    assert response.status_code == 201
    assert "location" not in response.headers  # documented exception: account only addressable as /me
    assert response.json() == {
        "message": "Cuenta creada correctamente",
        "user": {
            "username": "testuser",
            "email": "test@test.com",
            "first_name": "Test",
            "last_name": "User",
            "location": "Madrid",
            "is_google": False,
        }
    }
    mock_auth_service.register.assert_called_once()


@pytest.mark.asyncio
async def test_logout(async_client):
    # Inject a fake cookie to simulate an active session
    async_client.cookies.set("access_token", "fake_token")

    response = await async_client.delete("/api/v1/sessions/current")

    assert response.status_code == 204
    assert response.content == b""
    
    # httpx does not automatically drop the cookie from the local jar when Max-Age=0
    # So we check that the server sends a Set-Cookie header clearing it
    set_cookie_header = response.headers.get("set-cookie")
    assert set_cookie_header is not None
    assert "access_token=\"\"" in set_cookie_header or "access_token=;" in set_cookie_header
    assert "Max-Age=0" in set_cookie_header or "expires=" in set_cookie_header.lower()


@pytest.mark.asyncio
async def test_get_me(async_client, dummy_user_entity):
    from app.main import app
    from app.core.security import get_current_user
    
    # Override the get_current_user dependency in the FastAPI app
    app.dependency_overrides[get_current_user] = lambda: dummy_user_entity

    response = await async_client.get("/api/v1/me")

    # Clean up the dependency overrides
    app.dependency_overrides.clear()
    
    assert response.status_code == 200
    assert response.json() == {
        "username": "testuser",
        "email": "test@test.com",
        "first_name": "Test",
        "last_name": "User",
        "location": "Madrid",
        "is_google": False,
    }


@pytest.mark.asyncio
async def test_check_verification(async_client, mock_auth_service):
    mock_auth_service.check_email_verification.return_value = True

    response = await async_client.get("/api/v1/email-verification?email=test@test.com")

    assert response.status_code == 200
    assert response.json() == {"verified": True}
    mock_auth_service.check_email_verification.assert_called_once_with("test@test.com")


@pytest.mark.asyncio
async def test_password_reset(async_client, mock_auth_service):
    mock_auth_service.request_password_reset.return_value = None

    response = await async_client.post(
        "/api/v1/password-resets",
        json={"email": "test@test.com"}
    )

    assert response.status_code == 202
    assert response.json() == {"message": "Si el correo está registrado, se enviará un enlace de recuperación."}
    mock_auth_service.request_password_reset.assert_called_once_with("test@test.com")


# ── Google Auth Endpoints ─────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_login_with_google_require_username(async_client, mock_auth_service):
    """When the user does not exist, the endpoint returns 202 with require_username=True."""
    mock_auth_service.login_with_google.return_value = {
        "require_username": True,
        "email": "nuevo@google.com",
        "first_name": "Nuevo",
        "last_name": "User",
    }
    response = await async_client.post("/api/v1/sessions/google", json={"token": "google_token"})
    assert response.status_code == 202
    data = response.json()
    assert data["require_username"] is True
    assert data["email"] == "nuevo@google.com"


@pytest.mark.asyncio
async def test_login_with_google_success(async_client, mock_auth_service, dummy_user_entity):
    """When the user already exists, the endpoint returns 200 with user and access_token."""
    mock_auth_service.login_with_google.return_value = {
        "require_username": False,
        "user": dummy_user_entity,
        "access_token": "google_jwt",
    }
    response = await async_client.post("/api/v1/sessions/google", json={"token": "google_token"})
    assert response.status_code == 200
    data = response.json()
    assert data["message"] == "Login con Google exitoso"
    assert data["user"]["username"] == "testuser"
    assert "access_token" in response.cookies


@pytest.mark.asyncio
async def test_register_with_google_success(async_client, mock_auth_service, dummy_user_entity):
    """register_with_google must return 201 with the user and set the cookie."""
    mock_auth_service.register_with_google.return_value = (dummy_user_entity, "google_jwt")
    response = await async_client.post(
        "/api/v1/users/google",
        json={"token": "google_token", "username": "newuser", "location": "Gijón"}
    )
    assert response.status_code == 201
    data = response.json()
    assert data["message"] == "Cuenta creada correctamente con Google"
    assert "access_token" in response.cookies


# ── Check Availability ────────────────────────────────────────────────────────

@pytest.mark.asyncio
@patch("app.infrastructure.repositories.usuario_repo.get_uid_by_username", return_value=None)
@patch("app.infrastructure.repositories.usuario_repo.get_user_by_email", return_value=None)
async def test_check_availability_libre(mock_email, mock_uid, async_client):
    response = await async_client.get("/api/v1/users/availability?email=libre@test.com&username=libre")
    assert response.status_code == 200
    data = response.json()
    assert data["email_taken"] is False
    assert data["username_taken"] is False


@pytest.mark.asyncio
@patch("app.infrastructure.repositories.usuario_repo.get_uid_by_username", return_value="existing_uid")
@patch("app.infrastructure.repositories.usuario_repo.get_user_by_email", return_value=MagicMock())
async def test_check_availability_tomado(mock_email, mock_uid, async_client):
    response = await async_client.get("/api/v1/users/availability?email=taken@test.com&username=taken")
    assert response.status_code == 200
    data = response.json()
    assert data["email_taken"] is True
    assert data["username_taken"] is True


# ── Profile Endpoints ─────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_update_profile_endpoint(async_client, mock_auth_service, dummy_user_entity):
    from app.main import app
    from app.core.security import get_current_user
    updated = dummy_user_entity
    mock_auth_service.update_profile.return_value = updated
    app.dependency_overrides[get_current_user] = lambda: dummy_user_entity

    response = await async_client.patch(
        "/api/v1/profile",
        json={"first_name": "Nuevo", "last_name": "Apellido", "location": "Oviedo", "password": "pass"}
    )
    app.dependency_overrides.clear()
    assert response.status_code == 200
    assert "Perfil actualizado" in response.json()["message"]


@pytest.mark.asyncio
async def test_update_email_endpoint(async_client, mock_auth_service, dummy_user_entity):
    from app.main import app
    from app.core.security import get_current_user
    mock_auth_service.update_email.return_value = None
    app.dependency_overrides[get_current_user] = lambda: dummy_user_entity

    response = await async_client.patch(
        "/api/v1/profile/email",
        json={"new_email": "nuevo@test.com", "password": "pass"}
    )
    app.dependency_overrides.clear()
    assert response.status_code == 200
    assert "correo de confirmación" in response.json()["message"]


@pytest.mark.asyncio
async def test_update_password_endpoint(async_client, mock_auth_service, dummy_user_entity):
    from app.main import app
    from app.core.security import get_current_user
    mock_auth_service.update_password.return_value = None
    app.dependency_overrides[get_current_user] = lambda: dummy_user_entity

    response = await async_client.patch(
        "/api/v1/profile/password",
        json={"new_password": "NewPass1", "old_password": "OldPass1"}
    )
    app.dependency_overrides.clear()
    assert response.status_code == 200
    assert "Contraseña actualizada" in response.json()["message"]


@pytest.mark.asyncio
async def test_delete_account_endpoint(async_client, mock_auth_service, dummy_user_entity):
    from app.main import app
    from app.core.security import get_current_user
    mock_auth_service.delete_account.return_value = None
    app.dependency_overrides[get_current_user] = lambda: dummy_user_entity

    response = await async_client.delete("/api/v1/profile?password=mypass")
    app.dependency_overrides.clear()
    assert response.status_code == 200
    assert "eliminada" in response.json()["message"]


# ── New in the REST redesign ───────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_old_unversioned_routes_are_gone(async_client):
    """Clean break: the old verb-based routes must not exist anymore."""
    assert (await async_client.post("/api/login", json={"identifier": "a", "password": "b"})).status_code == 404
    assert (await async_client.post("/api/logout")).status_code == 404
    assert (await async_client.post("/api/register", json={})).status_code == 404


@pytest.mark.asyncio
async def test_check_verification_requires_email_query(async_client):
    response = await async_client.get("/api/v1/email-verification")
    assert response.status_code == 422


@pytest.mark.asyncio
async def test_register_duplicate_returns_409(async_client, mock_auth_service):
    from fastapi import HTTPException
    mock_auth_service.register.side_effect = HTTPException(status_code=409, detail="El email ya está registrado")
    response = await async_client.post("/api/v1/users", json={
        "email": "test@test.com", "password": "Password1", "username": "testuser",
        "first_name": "Test", "last_name": "User", "location": "Madrid",
    })
    assert response.status_code == 409
    assert response.json()["detail"] == "El email ya está registrado"


@pytest.mark.asyncio
async def test_register_validation_error_returns_422(async_client, mock_auth_service):
    from fastapi import HTTPException
    mock_auth_service.register.side_effect = HTTPException(status_code=422, detail="El email no tiene un formato válido")
    response = await async_client.post("/api/v1/users", json={
        "email": "bad", "password": "Password1", "username": "testuser",
        "first_name": "Test", "last_name": "User", "location": "Madrid",
    })
    assert response.status_code == 422


@pytest.mark.asyncio
async def test_register_with_google_duplicate_returns_409(async_client, mock_auth_service):
    from fastapi import HTTPException
    mock_auth_service.register_with_google.side_effect = HTTPException(status_code=409, detail="Ese username ya está en uso")
    response = await async_client.post(
        "/api/v1/users/google", json={"token": "t", "username": "dup", "location": ""}
    )
    assert response.status_code == 409


@pytest.mark.asyncio
async def test_login_with_google_require_username_sets_no_cookie(async_client, mock_auth_service):
    mock_auth_service.login_with_google.return_value = {
        "require_username": True, "email": "n@g.com", "first_name": "N", "last_name": "U",
    }
    response = await async_client.post("/api/v1/sessions/google", json={"token": "t"})
    assert response.status_code == 202
    assert "access_token" not in response.cookies


@pytest.mark.asyncio
async def test_openapi_documents_exceptions(async_client):
    response = await async_client.get("/openapi.json")
    assert response.status_code == 200
    paths = response.json()["paths"]
    assert "NO `Location`" in paths["/api/v1/users"]["post"]["description"]
    assert "Documented REST exception" in paths["/api/v1/recommendations/search"]["post"]["description"]
    assert "/api/v1/sessions" in paths and "/api/v1/users/availability" in paths
    assert not any(not path.startswith("/api/v1") for path in paths if path.startswith("/api"))
