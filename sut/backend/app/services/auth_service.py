import re
from datetime import timedelta
import httpx
from app.infrastructure.firebase.firebase_admin import get_firestore_client
from fastapi import HTTPException, status
from app.core.config import settings
from app.core.security import create_access_token
from app.models.entities.usuarios import Usuario
from firebase_admin import auth as fb_auth
from app.infrastructure.repositories.usuario_repo import (
    verify_password_and_get_uid,
    get_user_by_uid,
    get_uid_by_username,
    create_user,
    send_verification_email,
    send_password_reset_email,
    get_user_by_email,
    update_user_profile,
    update_user_email,
    update_user_password,
    delete_user_profile,
    delete_user_auth,
    send_email_change_verification,
)
from app.models.dtos.auth_dto import (
    RegisterRequest, ProfileUpdateRequest, EmailUpdateRequest, 
    PasswordUpdateRequest, LoginRequest
)
from sqlalchemy.orm import Session
from app.models.entities.favorite_lists import FavoriteList
from app.models.entities.history import History
from app.models.entities.saved_for_later import SavedForLater
from app.models.entities.rating import Rating
from app.models.entities.rating_like import RatingLike

_EMAIL_REGEX = re.compile(r"^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$")
_PASSWORD_REGEX = re.compile(r"^(?=.*[A-Za-z])(?=.*\d).{8,}$")
_ERR_INCORRECT_CREDENTIALS = "Credenciales incorrectas"

def login(identifier: str, password: str) -> tuple[Usuario, str]:
    if not identifier or not password:
        raise HTTPException(
            status_code=422,
            detail="Faltan credenciales",
        )

    is_email = bool(_EMAIL_REGEX.match(identifier))

    if is_email:
        email = identifier
    else:
        uid = get_uid_by_username(identifier)
        if uid is None:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail=_ERR_INCORRECT_CREDENTIALS,
            )

        try:
            user_record = fb_auth.get_user(uid)
            email = user_record.email
        except Exception:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail=_ERR_INCORRECT_CREDENTIALS,
            )

    try:
        user_record = fb_auth.get_user_by_email(email)
        if not settings.SKIP_EMAIL_VERIFICATION and not user_record.email_verified:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Email no verificado. Por favor, revisa tu bandeja de entrada.",
            )
    except fb_auth.UserNotFoundError:
        pass

    uid = verify_password_and_get_uid(email, password)
    if uid is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=_ERR_INCORRECT_CREDENTIALS,
        )

    user = get_user_by_uid(uid)
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Usuario no encontrado en la base de datos",
        )

    access_token = create_access_token(
        data={"sub": uid},
        expires_delta=timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES),
    )
    return user, access_token


def register(data: RegisterRequest) -> Usuario:
    if not _EMAIL_REGEX.match(data.email):
        raise HTTPException(
            status_code=422,
            detail="El email no tiene un formato válido",
        )
    if not _PASSWORD_REGEX.match(data.password):
        raise HTTPException(
            status_code=422,
            detail="La contraseña debe tener al menos 8 caracteres, una letra y un número",
        )
    if not (3 <= len(data.username) <= 30):
        raise HTTPException(
            status_code=422,
            detail="El username debe tener entre 3 y 30 caracteres",
        )

    user = create_user(
        email=data.email,
        password=data.password,
        username=data.username,
        first_name=data.first_name,
        last_name=data.last_name,
        location=data.location,
    )
    
    send_verification_email(data.email, data.password)
    
    return user

def check_email_verification(email: str) -> bool:
    try:
        user_record = fb_auth.get_user_by_email(email)
        return user_record.email_verified
    except fb_auth.UserNotFoundError:
        return False

def request_password_reset(email: str) -> None:
    # Check whether the user exists without revealing it to the frontend
    user = get_user_by_email(email)
    if user:
        send_password_reset_email(email)

def update_profile(uid: str, data: ProfileUpdateRequest) -> Usuario:
    # No password is required to update the profile
    
    # 2. Update in Firestore
    update_user_profile(uid, data.first_name, data.last_name, data.location)
    
    # 3. Return the updated user
    return get_user_by_uid(uid)

def update_email(uid: str, current_email: str, data: EmailUpdateRequest) -> None:
    # 1. Validate the new email format
    if not _EMAIL_REGEX.match(data.new_email):
        raise HTTPException(
            status_code=422,
            detail="El nuevo email no tiene un formato válido",
        )
    
    # 2. Check whether the new email is already registered
    if get_user_by_email(data.new_email) is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Este correo electrónico ya está en uso por otra cuenta",
        )
    
    # 3. Check whether it is a Google user
    try:
        user_record = fb_auth.get_user(uid)
        is_google_user = any(p.provider_id == 'google.com' for p in user_record.provider_data)
    except Exception:
        is_google_user = False
        
    if is_google_user:
        raise HTTPException(
            status_code=422,
            detail="Los usuarios registrados con Google no pueden cambiar su correo electrónico. Tu correo está vinculado a tu cuenta de Google."
        )
    
    # 4. Verify the current password
    verified_uid = verify_password_and_get_uid(current_email, data.password)
    if verified_uid != uid:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Contraseña actual incorrecta",
        )
    
    # 5. Send the verification email for the email change
    success = send_email_change_verification(current_email, data.password, data.new_email)
    if not success:
        raise HTTPException(
            status_code=422,
            detail="Error al enviar el correo de verificación para el cambio de email",
        )

def update_password(uid: str, email: str, data: PasswordUpdateRequest) -> None:
    # 1. Validate the new password format
    if not _PASSWORD_REGEX.match(data.new_password):
        raise HTTPException(
            status_code=422,
            detail="La nueva contraseña debe tener al menos 8 caracteres, una letra y un número",
        )
    
    # 2. Verify the current password
    verified_uid = verify_password_and_get_uid(email, data.old_password)
    if verified_uid != uid:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Contraseña actual incorrecta",
        )
    
    # 3. Update the password in Firebase Auth
    try:
        update_user_password(uid, data.new_password)
    except Exception as e:
        raise HTTPException(
            status_code=422,
            detail=str(e),
        )


def delete_account(uid: str, db: Session) -> None:
    # Identity confirmation is done in the frontend ("CONFIRMAR" field).
    # The user is already authenticated via the session cookie.
    
    # 2. Delete data from the relational database (SQL)
    try:
        # Deletions are cascaded where applicable, but we do them explicitly to be safe
        db.query(RatingLike).filter(RatingLike.user_id == uid).delete()
        db.query(Rating).filter(Rating.user_id == uid).delete()
        db.query(SavedForLater).filter(SavedForLater.user_id == uid).delete()
        db.query(History).filter(History.user_id == uid).delete()
        db.query(FavoriteList).filter(FavoriteList.user_id == uid).delete() # Cascades to favorites
        db.commit()
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error al eliminar datos transaccionales: {str(e)}"
        )

    # 3. Delete from Firestore
    try:
        delete_user_profile(uid)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error al eliminar perfil de Firestore: {str(e)}"
        )

    # 4. Delete from Firebase Auth
    try:
        delete_user_auth(uid)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error al eliminar de Firebase Auth: {str(e)}"
        )

def login_with_google(token: str) -> dict:
    url = "https://www.googleapis.com/oauth2/v3/userinfo"
    headers = {"Authorization": f"Bearer {token}"}
    try:
        resp = httpx.get(url, headers=headers, timeout=10.0)
        if resp.status_code != 200:
            raise ValueError("Token inválido")
        idinfo = resp.json()
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token de Google inválido"
        )
    
    email = idinfo.get('email')
    if not email:
        raise HTTPException(status_code=422, detail="El token de Google no contiene email")
        
    first_name = idinfo.get('given_name', '')
    last_name = idinfo.get('family_name', '')
    
    try:
        user_record = fb_auth.get_user_by_email(email)
        # Exists in Firebase Auth
        user = get_user_by_uid(user_record.uid)
        if not user:
            # Rare case: exists in Auth but not in Firestore
            raise HTTPException(status_code=404, detail="Perfil no encontrado")
            
        access_token = create_access_token(
            data={"sub": user_record.uid},
            expires_delta=timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES),
        )
        return {"require_username": False, "user": user, "access_token": access_token}
    except fb_auth.UserNotFoundError:
        # Does not exist, ask for a username
        return {
            "require_username": True,
            "email": email,
            "first_name": first_name,
            "last_name": last_name
        }

def register_with_google(token: str, username: str, location: str = "") -> tuple[Usuario, str]:
    url = "https://www.googleapis.com/oauth2/v3/userinfo"
    headers = {"Authorization": f"Bearer {token}"}
    try:
        resp = httpx.get(url, headers=headers, timeout=10.0)
        if resp.status_code != 200:
            raise ValueError("Token inválido")
        idinfo = resp.json()
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token de Google inválido"
        )
    
    email = idinfo.get('email')
    if not email:
        raise HTTPException(status_code=422, detail="El token de Google no contiene email")
        
    first_name = idinfo.get('given_name', '')
    last_name = idinfo.get('family_name', '')

    if not (3 <= len(username) <= 30):
        raise HTTPException(
            status_code=422,
            detail="El username debe tener entre 3 y 30 caracteres"
        )
    
    if get_uid_by_username(username) is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Ese username ya está en uso"
        )
    
    try:
        user_record = fb_auth.create_user(
            email=email,
            display_name=username,
            email_verified=True
        )
    except fb_auth.EmailAlreadyExistsError:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="El email ya está registrado"
        )
        
    uid = user_record.uid
    
    db_fs = get_firestore_client()
    db_fs.collection("users").document(uid).set({
        "username": username,
        "first_name": first_name,
        "last_name": last_name,
        "location": location,
        "is_google": True,
    })
    
    user = get_user_by_uid(uid)
    
    access_token = create_access_token(
        data={"sub": uid},
        expires_delta=timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES),
    )
    return user, access_token


