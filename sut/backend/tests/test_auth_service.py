import pytest
from fastapi import HTTPException
from unittest.mock import patch, MagicMock

from app.services.auth_service import (
    login, register, check_email_verification, request_password_reset,
    update_profile, update_email, update_password, delete_account,
    login_with_google, register_with_google,
)
from app.models.dtos.auth_dto import (
    RegisterRequest, ProfileUpdateRequest, EmailUpdateRequest, PasswordUpdateRequest,
)
from app.models.entities.usuarios import Usuario

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

@pytest.fixture
def dummy_register_data():
    return RegisterRequest(
        email="test@test.com",
        password="Password1",
        username="testuser",
        nombre="Test",
        apellidos="User",
        ubicacion="Madrid",
    )

# --- TESTS DEL SERVICIO DE REGISTRO ---

def test_register_invalid_email(dummy_register_data):
    dummy_register_data.email = "invalid-email"
    with pytest.raises(HTTPException) as exc_info:
        register(dummy_register_data)
    assert exc_info.value.status_code == 400
    assert "formato válido" in exc_info.value.detail

def test_register_weak_password(dummy_register_data):
    dummy_register_data.password = "weak"  # noqa: S106 - test data, not a real credential
    with pytest.raises(HTTPException) as exc_info:
        register(dummy_register_data)
    assert exc_info.value.status_code == 400
    assert "al menos 8 caracteres" in exc_info.value.detail

def test_register_invalid_username_length(dummy_register_data):
    dummy_register_data.username = "ab" # Corto
    with pytest.raises(HTTPException) as exc_info:
        register(dummy_register_data)
    assert exc_info.value.status_code == 400
    assert "entre 3 y 30 caracteres" in exc_info.value.detail

@patch("app.services.auth_service.create_usuario")
@patch("app.services.auth_service.send_verification_email")
def test_register_success(mock_send_email, mock_create_usuario, dummy_register_data, dummy_usuario):
    mock_create_usuario.return_value = dummy_usuario
    
    result = register(dummy_register_data)
    
    assert result == dummy_usuario
    mock_create_usuario.assert_called_once()
    mock_send_email.assert_called_once_with("test@test.com", "Password1")

# --- TESTS DEL SERVICIO DE LOGIN ---

def test_login_missing_credentials():
    with pytest.raises(HTTPException) as exc_info:
        login("", "password")
    assert exc_info.value.status_code == 400
    assert "Faltan credenciales" in exc_info.value.detail

@patch("app.services.auth_service.get_uid_by_username")
def test_login_username_not_found(mock_get_uid):
    mock_get_uid.return_value = None
    with pytest.raises(HTTPException) as exc_info:
        login("not_an_email_or_user", "password")
    assert exc_info.value.status_code == 401
    assert "Credenciales incorrectas" in exc_info.value.detail

@patch("app.services.auth_service.fb_auth.get_user_by_email")
def test_login_email_not_verified(mock_fb_user):
    mock_user_record = MagicMock()
    mock_user_record.email_verified = False
    mock_fb_user.return_value = mock_user_record
    
    with pytest.raises(HTTPException) as exc_info:
        login("test@test.com", "password")
    assert exc_info.value.status_code == 403
    assert "Email no verificado" in exc_info.value.detail

@patch("app.services.auth_service.fb_auth.get_user_by_email")
@patch("app.services.auth_service.verify_password_and_get_uid")
def test_login_wrong_password(mock_verify, mock_fb_user):
    mock_user_record = MagicMock()
    mock_user_record.email_verified = True
    mock_fb_user.return_value = mock_user_record
    mock_verify.return_value = None
    
    with pytest.raises(HTTPException) as exc_info:
        login("test@test.com", "wrongpass")
    assert exc_info.value.status_code == 401
    assert "Credenciales incorrectas" in exc_info.value.detail

@patch("app.services.auth_service.fb_auth.get_user_by_email")
@patch("app.services.auth_service.verify_password_and_get_uid")
@patch("app.services.auth_service.get_usuario_by_uid")
@patch("app.services.auth_service.create_access_token")
def test_login_success(mock_create_token, mock_get_usuario, mock_verify, mock_fb_user, dummy_usuario):
    mock_user_record = MagicMock()
    mock_user_record.email_verified = True
    mock_fb_user.return_value = mock_user_record
    mock_verify.return_value = "dummy_id"
    mock_get_usuario.return_value = dummy_usuario
    mock_create_token.return_value = "fake_jwt"
    
    user, token = login("test@test.com", "Password1")
    
    assert user == dummy_usuario
    assert token == "fake_jwt"

# --- OTROS SERVICIOS ---

@patch("app.services.auth_service.fb_auth.get_user_by_email")
def test_check_email_verification_true(mock_fb_user):
    mock_user_record = MagicMock()
    mock_user_record.email_verified = True
    mock_fb_user.return_value = mock_user_record
    
    assert check_email_verification("test@test.com") is True

@patch("app.services.auth_service.get_usuario_by_email")
@patch("app.services.auth_service.send_password_reset_email")
def test_request_password_reset_success(mock_send_email, mock_get_user, dummy_usuario):
    mock_get_user.return_value = dummy_usuario
    
    request_password_reset("test@test.com")
    
    mock_send_email.assert_called_once_with("test@test.com")

@patch("app.services.auth_service.get_usuario_by_email")
@patch("app.services.auth_service.send_password_reset_email")
def test_request_password_reset_user_not_found(mock_send_email, mock_get_user):
    mock_get_user.return_value = None
    
    request_password_reset("notfound@test.com")
    
    mock_send_email.assert_not_called()


# ── update_profile ────────────────────────────────────────────────────────────

@patch("app.services.auth_service.update_usuario_profile")
@patch("app.services.auth_service.get_usuario_by_uid")
def test_update_profile_ok(mock_get, mock_update, dummy_usuario):
    mock_get.return_value = dummy_usuario
    data = ProfileUpdateRequest(nombre="Nuevo", apellidos="Apellido", ubicacion="Oviedo", password="pass")
    result = update_profile("dummy_id", data)
    mock_update.assert_called_once_with("dummy_id", "Nuevo", "Apellido", "Oviedo")
    assert result == dummy_usuario


# ── update_email ──────────────────────────────────────────────────────────────

def test_update_email_formato_invalido(dummy_usuario):
    data = EmailUpdateRequest(new_email="not-an-email", password="pass")
    with pytest.raises(HTTPException) as exc:
        update_email("uid", "old@test.com", data)
    assert exc.value.status_code == 400
    assert "formato válido" in exc.value.detail

@patch("app.services.auth_service.get_usuario_by_email")
def test_update_email_ya_en_uso(mock_get, dummy_usuario):
    mock_get.return_value = dummy_usuario  # Email ya existe
    data = EmailUpdateRequest(new_email="existe@test.com", password="pass")
    with pytest.raises(HTTPException) as exc:
        update_email("uid", "old@test.com", data)
    assert exc.value.status_code == 400
    assert "ya está en uso" in exc.value.detail

@patch("app.services.auth_service.get_usuario_by_email")
@patch("app.services.auth_service.fb_auth.get_user")
def test_update_email_usuario_google(mock_fb_get, mock_get_email):
    mock_get_email.return_value = None
    mock_provider = MagicMock()
    mock_provider.provider_id = "google.com"
    mock_record = MagicMock()
    mock_record.provider_data = [mock_provider]
    mock_fb_get.return_value = mock_record
    data = EmailUpdateRequest(new_email="nuevo@test.com", password="pass")
    with pytest.raises(HTTPException) as exc:
        update_email("uid", "old@test.com", data)
    assert exc.value.status_code == 400
    assert "Google" in exc.value.detail

@patch("app.services.auth_service.get_usuario_by_email")
@patch("app.services.auth_service.fb_auth.get_user")
@patch("app.services.auth_service.verify_password_and_get_uid")
def test_update_email_contrasena_incorrecta(mock_verify, mock_fb_get, mock_get_email):
    mock_get_email.return_value = None
    mock_record = MagicMock()
    mock_record.provider_data = []
    mock_fb_get.return_value = mock_record
    mock_verify.return_value = "otro_uid"  # UID diferente → contraseña incorrecta
    data = EmailUpdateRequest(new_email="nuevo@test.com", password="wrong")
    with pytest.raises(HTTPException) as exc:
        update_email("uid", "old@test.com", data)
    assert exc.value.status_code == 401

@patch("app.services.auth_service.get_usuario_by_email")
@patch("app.services.auth_service.fb_auth.get_user")
@patch("app.services.auth_service.verify_password_and_get_uid")
@patch("app.services.auth_service.send_email_change_verification")
def test_update_email_ok(mock_send, mock_verify, mock_fb_get, mock_get_email):
    mock_get_email.return_value = None
    mock_record = MagicMock()
    mock_record.provider_data = []
    mock_fb_get.return_value = mock_record
    mock_verify.return_value = "uid"
    mock_send.return_value = True
    data = EmailUpdateRequest(new_email="nuevo@test.com", password="pass")
    update_email("uid", "old@test.com", data)  # No debe lanzar excepción
    mock_send.assert_called_once()

@patch("app.services.auth_service.get_usuario_by_email")
@patch("app.services.auth_service.fb_auth.get_user")
@patch("app.services.auth_service.verify_password_and_get_uid")
@patch("app.services.auth_service.send_email_change_verification")
def test_update_email_fallo_envio(mock_send, mock_verify, mock_fb_get, mock_get_email):
    mock_get_email.return_value = None
    mock_record = MagicMock()
    mock_record.provider_data = []
    mock_fb_get.return_value = mock_record
    mock_verify.return_value = "uid"
    mock_send.return_value = False  # Fallo en el envío
    data = EmailUpdateRequest(new_email="nuevo@test.com", password="pass")
    with pytest.raises(HTTPException) as exc:
        update_email("uid", "old@test.com", data)
    assert exc.value.status_code == 400


# ── update_password ───────────────────────────────────────────────────────────

def test_update_password_nueva_debil():
    data = PasswordUpdateRequest(new_password="weak", old_password="old")
    with pytest.raises(HTTPException) as exc:
        update_password("uid", "e@test.com", data)
    assert exc.value.status_code == 400

@patch("app.services.auth_service.verify_password_and_get_uid")
def test_update_password_contrasena_incorrecta(mock_verify):
    mock_verify.return_value = "otro_uid"
    data = PasswordUpdateRequest(new_password="NewPass1", old_password="wrong")
    with pytest.raises(HTTPException) as exc:
        update_password("uid", "e@test.com", data)
    assert exc.value.status_code == 401

@patch("app.services.auth_service.verify_password_and_get_uid")
@patch("app.services.auth_service.update_usuario_password")
def test_update_password_ok(mock_update, mock_verify):
    mock_verify.return_value = "uid"
    data = PasswordUpdateRequest(new_password="NewPass1", old_password="old")
    update_password("uid", "e@test.com", data)
    mock_update.assert_called_once_with("uid", "NewPass1")

@patch("app.services.auth_service.verify_password_and_get_uid")
@patch("app.services.auth_service.update_usuario_password")
def test_update_password_error_firebase(mock_update, mock_verify):
    mock_verify.return_value = "uid"
    mock_update.side_effect = Exception("Firebase error")
    data = PasswordUpdateRequest(new_password="NewPass1", old_password="old")
    with pytest.raises(HTTPException) as exc:
        update_password("uid", "e@test.com", data)
    assert exc.value.status_code == 400


# ── delete_account ────────────────────────────────────────────────────────────

@patch("app.services.auth_service.delete_usuario_auth")
@patch("app.services.auth_service.delete_usuario_profile")
def test_delete_account_ok(mock_del_profile, mock_del_auth):
    db_mock = MagicMock()
    db_mock.query.return_value.filter.return_value.delete.return_value = None
    delete_account("uid", db_mock)
    mock_del_profile.assert_called_once_with("uid")
    mock_del_auth.assert_called_once_with("uid")

def test_delete_account_error_sql():
    db_mock = MagicMock()
    db_mock.query.return_value.filter.return_value.delete.side_effect = Exception("DB error")
    with pytest.raises(HTTPException) as exc:
        delete_account("uid", db_mock)
    assert exc.value.status_code == 500
    db_mock.rollback.assert_called_once()

@patch("app.services.auth_service.delete_usuario_profile")
def test_delete_account_error_firestore(mock_del_profile):
    mock_del_profile.side_effect = Exception("Firestore error")
    db_mock = MagicMock()
    db_mock.query.return_value.filter.return_value.delete.return_value = None
    with pytest.raises(HTTPException) as exc:
        delete_account("uid", db_mock)
    assert exc.value.status_code == 500

@patch("app.services.auth_service.delete_usuario_profile")
@patch("app.services.auth_service.delete_usuario_auth")
def test_delete_account_error_auth(mock_del_auth, mock_del_profile):
    mock_del_auth.side_effect = Exception("Auth error")
    db_mock = MagicMock()
    db_mock.query.return_value.filter.return_value.delete.return_value = None
    with pytest.raises(HTTPException) as exc:
        delete_account("uid", db_mock)
    assert exc.value.status_code == 500


# ── login_with_google ─────────────────────────────────────────────────────────

@patch("app.services.auth_service.httpx.get")
def test_login_with_google_token_invalido(mock_get):
    mock_resp = MagicMock()
    mock_resp.status_code = 401
    mock_get.return_value = mock_resp
    with pytest.raises(HTTPException) as exc:
        login_with_google("bad_token")
    assert exc.value.status_code == 401

@patch("app.services.auth_service.httpx.get")
@patch("app.services.auth_service.fb_auth.get_user_by_email")
@patch("app.services.auth_service.get_usuario_by_uid")
@patch("app.services.auth_service.create_access_token")
def test_login_with_google_usuario_existente(mock_token, mock_get_user, mock_fb, mock_http, dummy_usuario):
    mock_resp = MagicMock()
    mock_resp.status_code = 200
    mock_resp.json.return_value = {"email": "test@test.com", "given_name": "Test", "family_name": "User"}
    mock_http.return_value = mock_resp
    mock_fb_record = MagicMock()
    mock_fb_record.uid = "dummy_id"
    mock_fb.return_value = mock_fb_record
    mock_get_user.return_value = dummy_usuario
    mock_token.return_value = "tok"
    result = login_with_google("valid_token")
    assert result["require_username"] is False
    assert result["access_token"] == "tok"

@patch("app.services.auth_service.httpx.get")
@patch("app.services.auth_service.fb_auth.get_user_by_email")
def test_login_with_google_require_username(mock_fb, mock_http):
    mock_resp = MagicMock()
    mock_resp.status_code = 200
    mock_resp.json.return_value = {"email": "nuevo@test.com", "given_name": "Nuevo"}
    mock_http.return_value = mock_resp
    import sys
    UserNotFoundError = sys.modules["firebase_admin"].auth.UserNotFoundError
    mock_fb.side_effect = UserNotFoundError("not found")
    result = login_with_google("valid_token")
    assert result["require_username"] is True
    assert result["email"] == "nuevo@test.com"


# ── register_with_google ──────────────────────────────────────────────────────

@patch("app.services.auth_service.httpx.get")
def test_register_with_google_token_invalido(mock_http):
    mock_resp = MagicMock()
    mock_resp.status_code = 400
    mock_http.return_value = mock_resp
    with pytest.raises(HTTPException) as exc:
        register_with_google("bad", "user1")
    assert exc.value.status_code == 401

@patch("app.services.auth_service.httpx.get")
def test_register_with_google_username_corto(mock_http):
    mock_resp = MagicMock()
    mock_resp.status_code = 200
    mock_resp.json.return_value = {"email": "g@test.com"}
    mock_http.return_value = mock_resp
    with pytest.raises(HTTPException) as exc:
        register_with_google("tok", "ab")
    assert exc.value.status_code == 400

@patch("app.services.auth_service.httpx.get")
@patch("app.services.auth_service.get_uid_by_username")
def test_register_with_google_username_ya_existe(mock_uid, mock_http):
    mock_resp = MagicMock()
    mock_resp.status_code = 200
    mock_resp.json.return_value = {"email": "g@test.com"}
    mock_http.return_value = mock_resp
    mock_uid.return_value = "existing_uid"
    with pytest.raises(HTTPException) as exc:
        register_with_google("tok", "existinguser")
    assert exc.value.status_code == 400
    assert "username" in exc.value.detail.lower()
