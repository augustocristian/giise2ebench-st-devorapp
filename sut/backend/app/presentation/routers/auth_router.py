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

router = APIRouter(prefix=settings.API_V1_STR, tags=["Auth"])

SESSION_LOCATION = f"{settings.API_V1_STR}/sessions/current"


def _user_dict(user: Usuario) -> dict:
    """Build the user dict for authentication responses."""
    return {
        "username": user.username,
        "email": user.email,
        "first_name": user.first_name,
        "last_name": user.last_name,
        "location": user.location,
        "is_google": user.is_google,
    }


def _set_auth_cookie(response: Response, token: str) -> None:
    """Set the session cookie with the access JWT."""
    response.set_cookie(
        key="access_token",
        value=token,
        httponly=True,
        samesite="lax",
        secure=settings.COOKIE_SECURE,
        max_age=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
    )

@router.post(
    "/sessions",
    status_code=status.HTTP_201_CREATED,
    summary="Create a session (log in)",
    description="Authenticates with `identifier` (email or username) and `password`, sets the "
                "`access_token` cookie and answers 201 with `Location: /api/v1/sessions/current`.",
    responses={
        401: {"description": "Credenciales incorrectas"},
        403: {"description": "Email no verificado"},
        422: {"description": "Faltan credenciales"},
    },
)
def login(login_data: LoginRequest, response: Response):
    user, access_token = auth_service.login(login_data.identifier, login_data.password)
    _set_auth_cookie(response, access_token)
    response.headers["Location"] = SESSION_LOCATION
    return {"message": "Login exitoso", "user": _user_dict(user)}

@router.post(
    "/users",
    status_code=status.HTTP_201_CREATED,
    summary="Create a user account (register)",
    description="Creates the account and its default favorites list. Documented exception: the "
                "201 response carries NO `Location` header because the new account is only "
                "addressable by its owner as the singleton `/me`.",
    responses={
        409: {"description": "Username o email ya en uso"},
        422: {"description": "Email, contraseña o username inválidos"},
    },
)
def register(data: RegisterRequest, db: Annotated[Session, Depends(get_db)]):
    user = auth_service.register(data)
    
    from app.infrastructure.repositories.usuario_repo import get_uid_by_username
    uid = get_uid_by_username(user.username)
    if uid:
        try:
            from app.services import favorites_service
            favorites_service.create_list(db, uid, "Favoritos")
        except Exception as e:
            print(f"Error creating default favorites list for {user.username}: {e}")

    return {"message": "Cuenta creada correctamente", "user": _user_dict(user)}

@router.post(
    "/sessions/google",
    summary="Create a session with a Google token",
    description="Returns 200 and sets the cookie when the Google account is already registered; "
                "returns 202 with `require_username: true` (and no cookie) when the account "
                "still needs to be registered through `POST /users/google`.",
    responses={202: {"description": "La cuenta de Google necesita registro (require_username)"},
               401: {"description": "Token de Google inválido"}},
)
def login_with_google(data: GoogleLoginRequest, response: Response):
    result = auth_service.login_with_google(data.token)
    
    if result.get("require_username"):
        response.status_code = status.HTTP_202_ACCEPTED
        return {
            "require_username": True, 
            "email": result.get("email"), 
            "first_name": result.get("first_name"), 
            "last_name": result.get("last_name")
        }
    
    user = result["user"]
    access_token = result["access_token"]
    _set_auth_cookie(response, access_token)
    return {"message": "Login con Google exitoso", "user": _user_dict(user)}

@router.post(
    "/users/google",
    status_code=status.HTTP_201_CREATED,
    summary="Create a user account from a Google token",
    description="Creates the account, its default favorites list and the session cookie. Like "
                "`POST /users` it has no `Location` header (the account is only addressable as `/me`).",
    responses={409: {"description": "Username o email ya en uso"},
               422: {"description": "Username inválido"}},
)
def register_with_google(data: GoogleRegisterRequest, db: Annotated[Session, Depends(get_db)], response: Response):
    user, access_token = auth_service.register_with_google(data.token, data.username, data.location)
    
    from app.infrastructure.repositories.usuario_repo import get_uid_by_username
    uid = get_uid_by_username(user.username)
    if uid:
        try:
            from app.services import favorites_service
            favorites_service.create_list(db, uid, "Favoritos")
        except Exception as e:
            print(f"Error creating default favorites list for {user.username}: {e}")

    _set_auth_cookie(response, access_token)
    return {"message": "Cuenta creada correctamente con Google", "user": _user_dict(user)}


@router.delete(
    "/sessions/current",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="End the current session (log out)",
)
def logout(response: Response):
    response.delete_cookie(key="access_token")

@router.get("/me")
def get_me(current_user: Annotated[Usuario, Depends(get_current_user)]):
    return {
        "username": current_user.username,
        "email": current_user.email,
        "first_name": current_user.first_name,
        "last_name": current_user.last_name,
        "location": current_user.location,
        "is_google": current_user.is_google,
    }

@router.get("/email-verification", summary="Check whether an email is verified")
def check_verification(email: str):
    is_verified = auth_service.check_email_verification(email)
    return {"verified": is_verified}

@router.post(
    "/password-resets",
    status_code=status.HTTP_202_ACCEPTED,
    summary="Request a password reset email",
)
def password_reset(data: PasswordResetRequest):
    auth_service.request_password_reset(data.email)
    return {"message": "Si el correo está registrado, se enviará un enlace de recuperación."}

@router.get("/users/availability", summary="Check whether an email/username is taken")
def check_availability(email: str = "", username: str = ""):
    """
    Check whether an email and/or username are already in use.
    Returns { email_taken: bool, username_taken: bool }.
    Creates and modifies nothing.
    """
    from app.infrastructure.repositories.usuario_repo import get_uid_by_username, get_user_by_email

    email_taken = False
    username_taken = False

    if email:
        email_taken = get_user_by_email(email) is not None

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
            "first_name": user.first_name,
            "last_name": user.last_name,
            "location": user.location,
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

