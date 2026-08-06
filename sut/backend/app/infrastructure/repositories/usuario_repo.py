"""
Repositorio de usuarios usando Firebase Authentication + Firestore.

Cada usuario tiene:
  - Firebase Auth: gestiona email y contraseña (con hashing seguro)
  - Firestore colección 'usuarios/{uid}': almacena username, nombre, apellidos, ubicacion
"""
from typing import Optional

import httpx
from firebase_admin import auth as fb_auth
from firebase_admin.exceptions import FirebaseError
from fastapi import HTTPException, status
from app.core.config import settings
from app.models.entities.usuarios import Usuario
from app.infrastructure.firebase.firebase_admin import get_firebase_app, get_firestore_client


def verify_password_and_get_uid(email: str, password: str) -> Optional[str]:
    """
    Verifica las credenciales contra Firebase Authentication REST API.
    Devuelve el uid del usuario si son correctas, None en caso contrario.
    """
    get_firebase_app()
    url = (
        "https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword"
        f"?key={settings.FIREBASE_API_KEY}"
    )
    try:
        resp = httpx.post(
            url,
            json={"email": email, "password": password, "returnSecureToken": True},
            timeout=10.0,
        )
        if resp.status_code == 200:
            return resp.json().get("localId")  # localId == Firebase UID
        return None
    except httpx.RequestError:
        return None

def send_verification_email(email: str, password: str) -> bool:
    """
    Inicia sesión temporalmente para obtener un idToken y solicita el envío
    del correo de verificación nativo de Firebase mediante la REST API.
    """
    get_firebase_app()
    # 1. Obtener el idToken iniciando sesión
    login_url = (
        "https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword"
        f"?key={settings.FIREBASE_API_KEY}"
    )
    try:
        print(f"DEBUG: Authenticating with Firebase REST API for {email}...")
        login_resp = httpx.post(
            login_url,
            json={"email": email, "password": password, "returnSecureToken": True},
            timeout=10.0,
        )
        print(f"DEBUG: Login response status = {login_resp.status_code}")
        if login_resp.status_code != 200:
            print(f"DEBUG: Login response body = {login_resp.text}")
            return False
        
        id_token = login_resp.json().get("idToken")
        if not id_token:
            print("DEBUG: idToken was empty!")
            return False

        # 2. Solicitar el correo de verificación
        print("DEBUG: Requesting verification email...")
        verify_url = (
            "https://identitytoolkit.googleapis.com/v1/accounts:sendOobCode"
            f"?key={settings.FIREBASE_API_KEY}"
        )
        verify_resp = httpx.post(
            verify_url,
            json={"requestType": "VERIFY_EMAIL", "idToken": id_token},
            timeout=10.0,
        )
        print(f"DEBUG: Verification response status = {verify_resp.status_code}")
        if verify_resp.status_code != 200:
            print(f"DEBUG: Verification response body = {verify_resp.text}")
        return verify_resp.status_code == 200
    except httpx.RequestError as e:
        print(f"DEBUG: RequestError fetching Firebase API: {e}")
        return False

def send_email_change_verification(email: str, password: str, new_email: str) -> bool:
    """
    Inicia sesión temporalmente para obtener un idToken y solicita el envío
    del correo de verificación para cambio de email mediante la REST API.
    """
    get_firebase_app()
    login_url = (
        "https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword"
        f"?key={settings.FIREBASE_API_KEY}"
    )
    try:
        login_resp = httpx.post(
            login_url,
            json={"email": email, "password": password, "returnSecureToken": True},
            timeout=10.0,
        )
        if login_resp.status_code != 200:
            return False
        
        id_token = login_resp.json().get("idToken")
        if not id_token:
            return False

        verify_url = (
            "https://identitytoolkit.googleapis.com/v1/accounts:sendOobCode"
            f"?key={settings.FIREBASE_API_KEY}"
        )
        verify_resp = httpx.post(
            verify_url,
            json={
                "requestType": "VERIFY_AND_CHANGE_EMAIL",
                "idToken": id_token,
                "newEmail": new_email
            },
            timeout=10.0,
        )
        return verify_resp.status_code == 200
    except httpx.RequestError:
        return False


def send_password_reset_email(email: str) -> bool:
    """
    Envía un correo de recuperación de contraseña nativo de Firebase al usuario.
    """
    get_firebase_app()
    url = (
        "https://identitytoolkit.googleapis.com/v1/accounts:sendOobCode"
        f"?key={settings.FIREBASE_API_KEY}"
    )
    try:
        resp = httpx.post(
            url,
            json={"requestType": "PASSWORD_RESET", "email": email},
            timeout=10.0,
        )
        return resp.status_code == 200
    except httpx.RequestError:
        return False

def get_usuario_by_uid(uid: str) -> Optional[Usuario]:
    """
    Obtiene un Usuario combinando datos de Firebase Auth y Firestore.
    El campo 'username' se lee del documento Firestore; si no existe, usa el uid.
    """
    get_firebase_app()
    try:
        user_record = fb_auth.get_user(uid)
    except Exception:
        return None

    db = get_firestore_client()
    doc = db.collection("usuarios").document(uid).get()
    profile: dict = doc.to_dict() or {}

    is_google = profile.get("is_google", False)

    return Usuario(
        uid=uid,
        username=profile.get("username", uid),
        email=user_record.email or "",
        nombre=profile.get("nombre", ""),
        apellidos=profile.get("apellidos", ""),
        ubicacion=profile.get("ubicacion", ""),
        is_google=is_google,
    )


def get_usuario_by_email(email: str) -> Optional[Usuario]:
    """Obtiene un Usuario a partir de su email usando Firebase Auth."""
    get_firebase_app()
    try:
        user_record = fb_auth.get_user_by_email(email)
        return get_usuario_by_uid(user_record.uid)
    except Exception:
        return None


def get_uid_by_username(username: str) -> Optional[str]:
    """
    Busca en Firestore el uid de un usuario a partir de su username.
    Necesario para permitir login con nombre de usuario en lugar de email.
    """
    get_firebase_app()
    db = get_firestore_client()
    docs = (
        db.collection("usuarios")
        .where("username", "==", username)
        .limit(1)
        .get()
    )
    for doc in docs:
        return doc.id  # el ID del documento es el Firebase UID
    return None


def create_usuario(
    email: str,
    password: str,
    username: str,
    nombre: str,
    apellidos: str,
    ubicacion: Optional[str] = None,
) -> Usuario:
    """
    Crea un nuevo usuario en Firebase Auth y su documento de perfil en Firestore.
    Lanza HTTPException con el código y mensaje adecuados si algo falla.
    """

    get_firebase_app()

    if get_uid_by_username(username) is not None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Ese username ya está en uso",
        )

    try:
        user_record = fb_auth.create_user(
            email=email,
            password=password,
            display_name=username,
        )
    except fb_auth.EmailAlreadyExistsError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="El email ya está registrado",
        )
    except FirebaseError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Error al crear el usuario: {e.message}",
        )

    uid = user_record.uid
    db = get_firestore_client()
    db.collection("usuarios").document(uid).set({
        "username": username,
        "nombre": nombre,
        "apellidos": apellidos,
        "ubicacion": ubicacion,
        "is_google": False,
    })

    return Usuario(
        username=username,
        email=email,
        nombre=nombre,
        apellidos=apellidos,
        ubicacion=ubicacion,
    )

def update_usuario_profile(uid: str, nombre: str, apellidos: str, ubicacion: str) -> None:
    """Actualiza el nombre, apellidos y ubicación en Firestore."""
    get_firebase_app()
    db = get_firestore_client()
    db.collection("usuarios").document(uid).update({
        "nombre": nombre,
        "apellidos": apellidos,
        "ubicacion": ubicacion,
    })

def update_usuario_email(uid: str, new_email: str) -> None:
    """Actualiza el email en Firebase Auth y lo marca como verificado."""
    get_firebase_app()
    fb_auth.update_user(uid, email=new_email, email_verified=True)

def update_usuario_password(uid: str, new_password: str) -> None:
    """Actualiza la contraseña en Firebase Auth."""
    get_firebase_app()
    fb_auth.update_user(uid, password=new_password)

def delete_usuario_profile(uid: str) -> None:
    """Elimina el perfil del usuario en Firestore."""
    get_firebase_app()
    db = get_firestore_client()
    db.collection("usuarios").document(uid).delete()

def delete_usuario_auth(uid: str) -> None:
    """Elimina al usuario de Firebase Authentication."""
    get_firebase_app()
    fb_auth.delete_user(uid)
