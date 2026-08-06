import pytest
from unittest.mock import patch, MagicMock
from app.models.entities.usuarios import Usuario

# --- TESTS DEL ENRUTADOR (Mockeando el Servicio) ---

@pytest.fixture
def mock_auth_service():
    with patch("app.presentation.routers.auth_router.auth_service") as mock_service:
        yield mock_service

@pytest.fixture
def dummy_usuario():
    return Usuario(
        id="dummy_id",
        email="test@test.com",
        username="testuser",
        nombre="Test",
        apellidos="User",
        ubicacion="Madrid",
    )

@pytest.mark.asyncio
async def test_login_success(async_client, mock_auth_service, dummy_usuario):
    # Setup mock
    mock_auth_service.login.return_value = (dummy_usuario, "fake_token")

    # Ejecutar request
    response = await async_client.post(
        "/api/login",
        json={"identifier": "test@test.com", "password": "Password1"}
    )

    # Validaciones
    assert response.status_code == 200
    assert response.json() == {
        "message": "Login exitoso",
        "user": {
            "username": "testuser",
            "email": "test@test.com",
            "nombre": "Test",
            "apellidos": "User",
            "ubicacion": "Madrid",
            "is_google": False,
        }
    }
    # Verifica que se setea la cookie
    assert "access_token" in response.cookies
    assert response.cookies["access_token"] == "fake_token"


@pytest.mark.asyncio
async def test_register_success(async_client, mock_auth_service, dummy_usuario):
    mock_auth_service.register.return_value = dummy_usuario

    response = await async_client.post(
        "/api/register",
        json={
            "email": "test@test.com",
            "password": "Password1",
            "username": "testuser",
            "nombre": "Test",
            "apellidos": "User",
            "ubicacion": "Madrid",
        }
    )

    assert response.status_code == 201
    assert response.json() == {
        "message": "Cuenta creada correctamente",
        "user": {
            "username": "testuser",
            "email": "test@test.com",
            "nombre": "Test",
            "apellidos": "User",
            "ubicacion": "Madrid",
            "is_google": False,
        }
    }
    mock_auth_service.register.assert_called_once()


@pytest.mark.asyncio
async def test_logout(async_client):
    # Inyectar cookie falsa para simular sesión activa
    async_client.cookies.set("access_token", "fake_token")

    response = await async_client.post("/api/logout")

    assert response.status_code == 200
    assert response.json() == {"message": "Sesión cerrada"}
    
    # httpx no borra automáticamente la cookie del jar local si el Max-Age=0
    # Por lo tanto, verificamos que el servidor envia la cabecera Set-Cookie borrándola
    set_cookie_header = response.headers.get("set-cookie")
    assert set_cookie_header is not None
    assert "access_token=\"\"" in set_cookie_header or "access_token=;" in set_cookie_header
    assert "Max-Age=0" in set_cookie_header or "expires=" in set_cookie_header.lower()


@pytest.mark.asyncio
async def test_get_me(async_client, dummy_usuario):
    from app.main import app
    from app.core.security import get_current_user
    
    # Sobrescribimos la dependencia get_current_user en la app de FastAPI
    app.dependency_overrides[get_current_user] = lambda: dummy_usuario

    response = await async_client.get("/api/me")

    # Limpiamos las dependencias
    app.dependency_overrides.clear()
    
    assert response.status_code == 200
    assert response.json() == {
        "username": "testuser",
        "email": "test@test.com",
        "nombre": "Test",
        "apellidos": "User",
        "ubicacion": "Madrid",
        "is_google": False,
    }


@pytest.mark.asyncio
async def test_check_verification(async_client, mock_auth_service):
    mock_auth_service.check_email_verification.return_value = True

    response = await async_client.get("/api/check-verification/test@test.com")

    assert response.status_code == 200
    assert response.json() == {"verified": True}
    mock_auth_service.check_email_verification.assert_called_once_with("test@test.com")


@pytest.mark.asyncio
async def test_password_reset(async_client, mock_auth_service):
    mock_auth_service.request_password_reset.return_value = None

    response = await async_client.post(
        "/api/password-reset",
        json={"email": "test@test.com"}
    )

    assert response.status_code == 200
    assert response.json() == {"message": "Si el correo está registrado, se enviará un enlace de recuperación."}
    mock_auth_service.request_password_reset.assert_called_once_with("test@test.com")


# ── Google Auth Endpoints ─────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_login_with_google_require_username(async_client, mock_auth_service):
    """Cuando el usuario no existe, el endpoint devuelve 202 con require_username=True."""
    mock_auth_service.login_with_google.return_value = {
        "require_username": True,
        "email": "nuevo@google.com",
        "nombre": "Nuevo",
        "apellidos": "User",
    }
    response = await async_client.post("/api/auth/google", json={"token": "google_token"})
    assert response.status_code == 202
    data = response.json()
    assert data["require_username"] is True
    assert data["email"] == "nuevo@google.com"


@pytest.mark.asyncio
async def test_login_with_google_success(async_client, mock_auth_service, dummy_usuario):
    """Cuando el usuario ya existe, el endpoint devuelve 200 con user y access_token."""
    mock_auth_service.login_with_google.return_value = {
        "require_username": False,
        "user": dummy_usuario,
        "access_token": "google_jwt",
    }
    response = await async_client.post("/api/auth/google", json={"token": "google_token"})
    assert response.status_code == 200
    data = response.json()
    assert data["message"] == "Login con Google exitoso"
    assert data["user"]["username"] == "testuser"
    assert "access_token" in response.cookies


@pytest.mark.asyncio
async def test_register_with_google_success(async_client, mock_auth_service, dummy_usuario):
    """register_with_google debe devolver 201 con usuario y establecer cookie."""
    mock_auth_service.register_with_google.return_value = (dummy_usuario, "google_jwt")
    response = await async_client.post(
        "/api/register/google",
        json={"token": "google_token", "username": "newuser", "ubicacion": "Gijón"}
    )
    assert response.status_code == 201
    data = response.json()
    assert data["message"] == "Cuenta creada correctamente con Google"
    assert "access_token" in response.cookies


# ── Check Availability ────────────────────────────────────────────────────────

@pytest.mark.asyncio
@patch("app.infrastructure.repositories.usuario_repo.get_uid_by_username", return_value=None)
@patch("app.infrastructure.repositories.usuario_repo.get_usuario_by_email", return_value=None)
async def test_check_availability_libre(mock_email, mock_uid, async_client):
    response = await async_client.get("/api/check-availability?email=libre@test.com&username=libre")
    assert response.status_code == 200
    data = response.json()
    assert data["email_taken"] is False
    assert data["username_taken"] is False


@pytest.mark.asyncio
@patch("app.infrastructure.repositories.usuario_repo.get_uid_by_username", return_value="existing_uid")
@patch("app.infrastructure.repositories.usuario_repo.get_usuario_by_email", return_value=MagicMock())
async def test_check_availability_tomado(mock_email, mock_uid, async_client):
    response = await async_client.get("/api/check-availability?email=taken@test.com&username=taken")
    assert response.status_code == 200
    data = response.json()
    assert data["email_taken"] is True
    assert data["username_taken"] is True


# ── Profile Endpoints ─────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_update_profile_endpoint(async_client, mock_auth_service, dummy_usuario):
    from app.main import app
    from app.core.security import get_current_user
    updated = dummy_usuario
    mock_auth_service.update_profile.return_value = updated
    app.dependency_overrides[get_current_user] = lambda: dummy_usuario

    response = await async_client.patch(
        "/api/profile",
        json={"nombre": "Nuevo", "apellidos": "Apellido", "ubicacion": "Oviedo", "password": "pass"}
    )
    app.dependency_overrides.clear()
    assert response.status_code == 200
    assert "Perfil actualizado" in response.json()["message"]


@pytest.mark.asyncio
async def test_update_email_endpoint(async_client, mock_auth_service, dummy_usuario):
    from app.main import app
    from app.core.security import get_current_user
    mock_auth_service.update_email.return_value = None
    app.dependency_overrides[get_current_user] = lambda: dummy_usuario

    response = await async_client.patch(
        "/api/profile/email",
        json={"new_email": "nuevo@test.com", "password": "pass"}
    )
    app.dependency_overrides.clear()
    assert response.status_code == 200
    assert "correo de confirmación" in response.json()["message"]


@pytest.mark.asyncio
async def test_update_password_endpoint(async_client, mock_auth_service, dummy_usuario):
    from app.main import app
    from app.core.security import get_current_user
    mock_auth_service.update_password.return_value = None
    app.dependency_overrides[get_current_user] = lambda: dummy_usuario

    response = await async_client.patch(
        "/api/profile/password",
        json={"new_password": "NewPass1", "old_password": "OldPass1"}
    )
    app.dependency_overrides.clear()
    assert response.status_code == 200
    assert "Contraseña actualizada" in response.json()["message"]


@pytest.mark.asyncio
async def test_delete_account_endpoint(async_client, mock_auth_service, dummy_usuario):
    from app.main import app
    from app.core.security import get_current_user
    mock_auth_service.delete_account.return_value = None
    app.dependency_overrides[get_current_user] = lambda: dummy_usuario

    response = await async_client.delete("/api/profile?password=mypass")
    app.dependency_overrides.clear()
    assert response.status_code == 200
    assert "eliminada" in response.json()["message"]


@pytest.mark.asyncio
async def test_login_success(async_client, mock_auth_service, dummy_usuario):
    # Setup mock
    mock_auth_service.login.return_value = (dummy_usuario, "fake_token")

    # Ejecutar request
    response = await async_client.post(
        "/api/login",
        json={"identifier": "test@test.com", "password": "Password1"}
    )

    # Validaciones
    assert response.status_code == 200
    assert response.json() == {
        "message": "Login exitoso",
        "user": {
            "username": "testuser",
            "email": "test@test.com",
            "nombre": "Test",
            "apellidos": "User",
            "ubicacion": "Madrid",
            "is_google": False,
        }
    }
    # Verifica que se setea la cookie
    assert "access_token" in response.cookies
    assert response.cookies["access_token"] == "fake_token"


@pytest.mark.asyncio
async def test_register_success(async_client, mock_auth_service, dummy_usuario):
    mock_auth_service.register.return_value = dummy_usuario

    response = await async_client.post(
        "/api/register",
        json={
            "email": "test@test.com",
            "password": "Password1",
            "username": "testuser",
            "nombre": "Test",
            "apellidos": "User",
            "ubicacion": "Madrid",
        }
    )

    assert response.status_code == 201
    assert response.json() == {
        "message": "Cuenta creada correctamente",
        "user": {
            "username": "testuser",
            "email": "test@test.com",
            "nombre": "Test",
            "apellidos": "User",
            "ubicacion": "Madrid",
            "is_google": False,
        }
    }
    mock_auth_service.register.assert_called_once()


@pytest.mark.asyncio
async def test_logout(async_client):
    # Inyectar cookie falsa para simular sesión activa
    async_client.cookies.set("access_token", "fake_token")

    response = await async_client.post("/api/logout")

    assert response.status_code == 200
    assert response.json() == {"message": "Sesión cerrada"}
    
    # httpx no borra automáticamente la cookie del jar local si el Max-Age=0
    # Por lo tanto, verificamos que el servidor envia la cabecera Set-Cookie borrándola
    set_cookie_header = response.headers.get("set-cookie")
    assert set_cookie_header is not None
    assert "access_token=\"\"" in set_cookie_header or "access_token=;" in set_cookie_header
    assert "Max-Age=0" in set_cookie_header or "expires=" in set_cookie_header.lower()


@pytest.mark.asyncio
async def test_get_me(async_client, dummy_usuario):
    from app.main import app
    from app.core.security import get_current_user
    
    # Sobrescribimos la dependencia get_current_user en la app de FastAPI
    app.dependency_overrides[get_current_user] = lambda: dummy_usuario

    response = await async_client.get("/api/me")

    # Limpiamos las dependencias
    app.dependency_overrides.clear()
    
    assert response.status_code == 200
    assert response.json() == {
        "username": "testuser",
        "email": "test@test.com",
        "nombre": "Test",
        "apellidos": "User",
        "ubicacion": "Madrid",
        "is_google": False,
    }


@pytest.mark.asyncio
async def test_check_verification(async_client, mock_auth_service):
    mock_auth_service.check_email_verification.return_value = True

    response = await async_client.get("/api/check-verification/test@test.com")

    assert response.status_code == 200
    assert response.json() == {"verified": True}
    mock_auth_service.check_email_verification.assert_called_once_with("test@test.com")


@pytest.mark.asyncio
async def test_password_reset(async_client, mock_auth_service):
    mock_auth_service.request_password_reset.return_value = None

    response = await async_client.post(
        "/api/password-reset",
        json={"email": "test@test.com"}
    )

    assert response.status_code == 200
    assert response.json() == {"message": "Si el correo está registrado, se enviará un enlace de recuperación."}
    mock_auth_service.request_password_reset.assert_called_once_with("test@test.com")
