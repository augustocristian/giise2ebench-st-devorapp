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
    get_usuario_by_uid,
    get_uid_by_username,
    create_usuario,
    send_verification_email,
    send_password_reset_email,
    get_usuario_by_email,
    update_usuario_profile,
    update_usuario_email,
    update_usuario_password,
    delete_usuario_profile,
    delete_usuario_auth,
    send_email_change_verification,
)
from app.models.dtos.auth_dto import (
    RegisterRequest, ProfileUpdateRequest, EmailUpdateRequest, 
    PasswordUpdateRequest, LoginRequest
)
from sqlalchemy.orm import Session
from app.models.entities.listas_favoritos import ListaFavoritos
from app.models.entities.historial import Historial
from app.models.entities.mas_tarde import MasTarde
from app.models.entities.valoracion import Valoracion
from app.models.entities.valoracion_like import LikeValoracion

_EMAIL_REGEX = re.compile(r"^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$")
_PASSWORD_REGEX = re.compile(r"^(?=.*[A-Za-z])(?=.*\d).{8,}$")
_ERR_CREDENCIALES_INCORRECTAS = "Credenciales incorrectas"

def login(identifier: str, password: str) -> tuple[Usuario, str]:
    if not identifier or not password:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
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
                detail=_ERR_CREDENCIALES_INCORRECTAS,
            )

        try:
            user_record = fb_auth.get_user(uid)
            email = user_record.email
        except Exception:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail=_ERR_CREDENCIALES_INCORRECTAS,
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
            detail=_ERR_CREDENCIALES_INCORRECTAS,
        )

    user = get_usuario_by_uid(uid)
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
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="El email no tiene un formato válido",
        )
    if not _PASSWORD_REGEX.match(data.password):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="La contraseña debe tener al menos 8 caracteres, una letra y un número",
        )
    if not (3 <= len(data.username) <= 30):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="El username debe tener entre 3 y 30 caracteres",
        )

    user = create_usuario(
        email=data.email,
        password=data.password,
        username=data.username,
        nombre=data.nombre,
        apellidos=data.apellidos,
        ubicacion=data.ubicacion,
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
    # Verificamos si el usuario existe sin revelar al frontend si existe o no
    user = get_usuario_by_email(email)
    if user:
        send_password_reset_email(email)

def update_profile(uid: str, data: ProfileUpdateRequest) -> Usuario:
    # No se requiere contraseña para actualizar el perfil
    
    # 2. Actualizar en Firestore
    update_usuario_profile(uid, data.nombre, data.apellidos, data.ubicacion)
    
    # 3. Devolver usuario actualizado
    return get_usuario_by_uid(uid)

def update_email(uid: str, current_email: str, data: EmailUpdateRequest) -> None:
    # 1. Verificar formato del nuevo email
    if not _EMAIL_REGEX.match(data.new_email):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="El nuevo email no tiene un formato válido",
        )
    
    # 2. Verificar si el nuevo email ya está registrado
    if get_usuario_by_email(data.new_email) is not None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Este correo electrónico ya está en uso por otra cuenta",
        )
    
    # 3. Verificar si es usuario de Google
    try:
        user_record = fb_auth.get_user(uid)
        is_google_user = any(p.provider_id == 'google.com' for p in user_record.provider_data)
    except Exception:
        is_google_user = False
        
    if is_google_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Los usuarios registrados con Google no pueden cambiar su correo electrónico. Tu correo está vinculado a tu cuenta de Google."
        )
    
    # 4. Verificar contraseña actual
    verified_uid = verify_password_and_get_uid(current_email, data.password)
    if verified_uid != uid:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Contraseña actual incorrecta",
        )
    
    # 5. Enviar correo de verificación para cambio de email
    success = send_email_change_verification(current_email, data.password, data.new_email)
    if not success:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Error al enviar el correo de verificación para el cambio de email",
        )

def update_password(uid: str, email: str, data: PasswordUpdateRequest) -> None:
    # 1. Verificar formato de la nueva contraseña
    if not _PASSWORD_REGEX.match(data.new_password):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="La nueva contraseña debe tener al menos 8 caracteres, una letra y un número",
        )
    
    # 2. Verificar contraseña actual
    verified_uid = verify_password_and_get_uid(email, data.old_password)
    if verified_uid != uid:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Contraseña actual incorrecta",
        )
    
    # 3. Actualizar contraseña en Firebase Auth
    try:
        update_usuario_password(uid, data.new_password)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )


def delete_account(uid: str, db: Session) -> None:
    # La confirmación de identidad se hace en el frontend (campo "CONFIRMAR").
    # El usuario ya está autenticado mediante cookie de sesión.
    
    # 2. Eliminar datos de la base de datos relacional (SQL)
    try:
        # Deletions are cascaded where applicable, but we do them explicitly to be safe
        db.query(LikeValoracion).filter(LikeValoracion.user_id == uid).delete()
        db.query(Valoracion).filter(Valoracion.user_id == uid).delete()
        db.query(MasTarde).filter(MasTarde.user_id == uid).delete()
        db.query(Historial).filter(Historial.user_id == uid).delete()
        db.query(ListaFavoritos).filter(ListaFavoritos.user_id == uid).delete() # Cascades to favoritos
        db.commit()
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error al eliminar datos transaccionales: {str(e)}"
        )

    # 3. Eliminar de Firestore
    try:
        delete_usuario_profile(uid)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error al eliminar perfil de Firestore: {str(e)}"
        )

    # 4. Eliminar de Firebase Auth
    try:
        delete_usuario_auth(uid)
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
        raise HTTPException(status_code=400, detail="El token de Google no contiene email")
        
    nombre = idinfo.get('given_name', '')
    apellidos = idinfo.get('family_name', '')
    
    try:
        user_record = fb_auth.get_user_by_email(email)
        # Existe en Firebase Auth
        user = get_usuario_by_uid(user_record.uid)
        if not user:
            # Caso raro: existe en Auth pero no en Firestore
            raise HTTPException(status_code=404, detail="Perfil no encontrado")
            
        access_token = create_access_token(
            data={"sub": user_record.uid},
            expires_delta=timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES),
        )
        return {"require_username": False, "user": user, "access_token": access_token}
    except fb_auth.UserNotFoundError:
        # No existe, pedir username
        return {
            "require_username": True,
            "email": email,
            "nombre": nombre,
            "apellidos": apellidos
        }

def register_with_google(token: str, username: str, ubicacion: str = "") -> tuple[Usuario, str]:
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
        raise HTTPException(status_code=400, detail="El token de Google no contiene email")
        
    nombre = idinfo.get('given_name', '')
    apellidos = idinfo.get('family_name', '')

    if not (3 <= len(username) <= 30):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="El username debe tener entre 3 y 30 caracteres"
        )
    
    if get_uid_by_username(username) is not None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
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
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="El email ya está registrado"
        )
        
    uid = user_record.uid
    
    db_fs = get_firestore_client()
    db_fs.collection("usuarios").document(uid).set({
        "username": username,
        "nombre": nombre,
        "apellidos": apellidos,
        "ubicacion": ubicacion,
        "is_google": True,
    })
    
    user = get_usuario_by_uid(uid)
    
    access_token = create_access_token(
        data={"sub": uid},
        expires_delta=timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES),
    )
    return user, access_token


