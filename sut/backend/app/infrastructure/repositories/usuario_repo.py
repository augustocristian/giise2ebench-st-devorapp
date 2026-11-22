"""
User repository using Firebase Authentication + Firestore.

Each user has:
  - Firebase Auth: manages email and password (with secure hashing)
  - Firestore collection 'users/{uid}': stores username, first_name, last_name, location
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
    Verify the credentials against the Firebase Authentication REST API.
    Return the user's uid if they are correct, otherwise None.
    """
    get_firebase_app()
    url = (
        f"{settings.FIREBASE_AUTH_BASE_URL}/accounts:signInWithPassword"
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
    Sign in temporarily to get an idToken and request sending
    Firebase's native verification email through the REST API.
    """
    get_firebase_app()
    # 1. Get the idToken by signing in
    login_url = (
        f"{settings.FIREBASE_AUTH_BASE_URL}/accounts:signInWithPassword"
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

        # 2. Request the verification email
        print("DEBUG: Requesting verification email...")
        verify_url = (
            f"{settings.FIREBASE_AUTH_BASE_URL}/accounts:sendOobCode"
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
    Sign in temporarily to get an idToken and request sending
    the verification email for an email change through the REST API.
    """
    get_firebase_app()
    login_url = (
        f"{settings.FIREBASE_AUTH_BASE_URL}/accounts:signInWithPassword"
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
            f"{settings.FIREBASE_AUTH_BASE_URL}/accounts:sendOobCode"
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
    Send Firebase's native password recovery email to the user.
    """
    get_firebase_app()
    url = (
        f"{settings.FIREBASE_AUTH_BASE_URL}/accounts:sendOobCode"
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

def get_user_by_uid(uid: str) -> Optional[Usuario]:
    """
    Get a Usuario combining Firebase Auth and Firestore data.
    The 'username' field is read from the Firestore document; if missing, the uid is used.
    """
    get_firebase_app()
    try:
        user_record = fb_auth.get_user(uid)
    except Exception:
        return None

    db = get_firestore_client()
    doc = db.collection("users").document(uid).get()
    profile: dict = doc.to_dict() or {}

    is_google = profile.get("is_google", False)

    return Usuario(
        uid=uid,
        username=profile.get("username", uid),
        email=user_record.email or "",
        first_name=profile.get("first_name", ""),
        last_name=profile.get("last_name", ""),
        location=profile.get("location", ""),
        is_google=is_google,
    )


def get_user_by_email(email: str) -> Optional[Usuario]:
    """Get a Usuario by email using Firebase Auth."""
    get_firebase_app()
    try:
        user_record = fb_auth.get_user_by_email(email)
        return get_user_by_uid(user_record.uid)
    except Exception:
        return None


def get_uid_by_username(username: str) -> Optional[str]:
    """
    Look up a user's uid in Firestore from their username.
    Needed to allow login with a username instead of an email.
    """
    get_firebase_app()
    db = get_firestore_client()
    docs = (
        db.collection("users")
        .where("username", "==", username)
        .limit(1)
        .get()
    )
    for doc in docs:
        return doc.id  # the document ID is the Firebase UID
    return None


def create_user(
    email: str,
    password: str,
    username: str,
    first_name: str,
    last_name: str,
    location: Optional[str] = None,
) -> Usuario:
    """
    Create a new user in Firebase Auth and its profile document in Firestore.
    Raise HTTPException with the appropriate code and message on failure.
    """

    get_firebase_app()

    if get_uid_by_username(username) is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
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
            status_code=status.HTTP_409_CONFLICT,
            detail="El email ya está registrado",
        )
    except FirebaseError as e:
        raise HTTPException(
            status_code=422,
            detail=f"Error al crear el usuario: {e.message}",
        )

    uid = user_record.uid
    db = get_firestore_client()
    db.collection("users").document(uid).set({
        "username": username,
        "first_name": first_name,
        "last_name": last_name,
        "location": location,
        "is_google": False,
    })

    return Usuario(
        username=username,
        email=email,
        first_name=first_name,
        last_name=last_name,
        location=location,
    )

def update_user_profile(uid: str, first_name: str, last_name: str, location: str) -> None:
    """Update first name, last name and location in Firestore."""
    get_firebase_app()
    db = get_firestore_client()
    db.collection("users").document(uid).update({
        "first_name": first_name,
        "last_name": last_name,
        "location": location,
    })

def update_user_email(uid: str, new_email: str) -> None:
    """Update the email in Firebase Auth and mark it as verified."""
    get_firebase_app()
    fb_auth.update_user(uid, email=new_email, email_verified=True)

def update_user_password(uid: str, new_password: str) -> None:
    """Update the password in Firebase Auth."""
    get_firebase_app()
    fb_auth.update_user(uid, password=new_password)

def delete_user_profile(uid: str) -> None:
    """Delete the user profile from Firestore."""
    get_firebase_app()
    db = get_firestore_client()
    db.collection("users").document(uid).delete()

def delete_user_auth(uid: str) -> None:
    """Delete the user from Firebase Authentication."""
    get_firebase_app()
    fb_auth.delete_user(uid)
