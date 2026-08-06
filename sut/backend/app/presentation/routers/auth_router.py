from fastapi import APIRouter, Response, status, Depends
from typing import Annotated
from app.models.dtos.auth_dto import (
    LoginRequest, RegisterRequest, PasswordResetRequest,
    ProfileUpdateRequest, EmailUpdateRequest, PasswordUpdateRequest,
    GoogleLoginRequest, GoogleRegisterRequest
)
from app.services import auth_service
from app.core.config import settings
from app.core.security import get_current_user
from app.models.entities.usuarios import Usuario
from sqlalchemy.orm import Session
from app.infrastructure.database import get_db

router = APIRouter(prefix="/api", tags=["Auth"])


def _user_dict(user: Usuario) -> dict:
    """Construye el dict de usuario para las respuestas de autenticación."""
    return {
        "username": user.username,
        "email": user.email,
        "nombre": user.nombre,
        "apellidos": user.apellidos,
        "ubicacion": user.ubicacion,
        "is_google": user.is_google,
    }


def _set_auth_cookie(response: Response, token: str) -> None:
    """Configura la cookie de sesión con el JWT de acceso."""
    response.set_cookie(
        key="access_token",
        value=token,
        httponly=True,
        samesite="lax",
        secure=True,
        max_age=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
    )

@router.post("/login")
def login(login_data: LoginRequest, response: Response):
    user, access_token = auth_service.login(login_data.identifier, login_data.password)
    _set_auth_cookie(response, access_token)
    return {"message": "Login exitoso", "user": _user_dict(user)}

@router.post("/register", status_code=status.HTTP_201_CREATED)
def register(data: RegisterRequest, db: Annotated[Session, Depends(get_db)]):
    user = auth_service.register(data)
    
    from app.infrastructure.repositories.usuario_repo import get_uid_by_username
    uid = get_uid_by_username(user.username)
    if uid:
        try:
            from app.services import favoritos_service
            favoritos_service.create_lista(db, uid, "Favoritos")
        except Exception as e:
            print(f"Error creating default favorites list for {user.username}: {e}")

    return {"message": "Cuenta creada correctamente", "user": _user_dict(user)}

@router.post("/auth/google")
def login_with_google(data: GoogleLoginRequest, response: Response):
    result = auth_service.login_with_google(data.token)
    
    if result.get("require_username"):
        response.status_code = status.HTTP_202_ACCEPTED
        return {
            "require_username": True, 
            "email": result.get("email"), 
            "nombre": result.get("nombre"), 
            "apellidos": result.get("apellidos")
        }
    
    user = result["user"]
    access_token = result["access_token"]
    _set_auth_cookie(response, access_token)
    return {"message": "Login con Google exitoso", "user": _user_dict(user)}

@router.post("/register/google", status_code=status.HTTP_201_CREATED)
def register_with_google(data: GoogleRegisterRequest, db: Annotated[Session, Depends(get_db)], response: Response):
    user, access_token = auth_service.register_with_google(data.token, data.username, data.ubicacion)
    
    from app.infrastructure.repositories.usuario_repo import get_uid_by_username
    uid = get_uid_by_username(user.username)
    if uid:
        try:
            from app.services import favoritos_service
            favoritos_service.create_lista(db, uid, "Favoritos")
        except Exception as e:
            print(f"Error creating default favorites list for {user.username}: {e}")

    _set_auth_cookie(response, access_token)
    return {"message": "Cuenta creada correctamente con Google", "user": _user_dict(user)}


@router.post("/logout")
def logout(response: Response):
    response.delete_cookie(key="access_token")
    return {"message": "Sesión cerrada"}

@router.get("/me")
def get_me(current_user: Annotated[Usuario, Depends(get_current_user)]):
    return {
        "username": current_user.username,
        "email": current_user.email,
        "nombre": current_user.nombre,
        "apellidos": current_user.apellidos,
        "ubicacion": current_user.ubicacion,
        "is_google": current_user.is_google,
    }

@router.get("/check-verification/{email}")
def check_verification(email: str):
    is_verified = auth_service.check_email_verification(email)
    return {"verified": is_verified}

@router.post("/password-reset")
def password_reset(data: PasswordResetRequest):
    auth_service.request_password_reset(data.email)
    return {"message": "Si el correo está registrado, se enviará un enlace de recuperación."}

@router.get("/check-availability")
def check_availability(email: str = "", username: str = ""):
    """
    Comprueba si un email y/o username ya están en uso.
    Devuelve { email_taken: bool, username_taken: bool }.
    No crea ni modifica nada.
    """
    from app.infrastructure.repositories.usuario_repo import get_uid_by_username, get_usuario_by_email

    email_taken = False
    username_taken = False

    if email:
        email_taken = get_usuario_by_email(email) is not None

    if username:
        username_taken = get_uid_by_username(username) is not None

    return {"email_taken": email_taken, "username_taken": username_taken}
    
@router.patch("/profile")
def update_profile(
    data: ProfileUpdateRequest,
    current_user: Annotated[Usuario, Depends(get_current_user)]
):
    user = auth_service.update_profile(current_user.uid, data)
    return {
        "message": "Perfil actualizado correctamente",
        "user": {
            "username": user.username,
            "email": user.email,
            "nombre": user.nombre,
            "apellidos": user.apellidos,
            "ubicacion": user.ubicacion,
        },
    }

@router.patch("/profile/email")
def update_email(
    data: EmailUpdateRequest,
    current_user: Annotated[Usuario, Depends(get_current_user)],
    response: Response
):
    auth_service.update_email(current_user.uid, current_user.email, data)
    return {"message": "Se ha enviado un correo de confirmación. Por favor, verifica tu nueva bandeja de entrada."}

@router.patch("/profile/password")
def update_password(
    data: PasswordUpdateRequest,
    current_user: Annotated[Usuario, Depends(get_current_user)]
):
    auth_service.update_password(current_user.uid, current_user.email, data)
    return {"message": "Contraseña actualizada correctamente"}

@router.delete("/profile")
def delete_account(
    password: str,
    current_user: Annotated[Usuario, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
    response: Response
):
    auth_service.delete_account(current_user.uid, db)
    response.delete_cookie(key="access_token")
    return {"message": "Cuenta eliminada permanentemente. Lamentamos verte partir."}

