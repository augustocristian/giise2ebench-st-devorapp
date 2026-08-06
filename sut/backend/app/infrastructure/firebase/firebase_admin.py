"""
Inicialización del Firebase Admin SDK.
Se inicializa una sola vez en caliente (lazy singleton).
"""
from __future__ import annotations

import firebase_admin

from firebase_admin import credentials, firestore, auth

from app.core.config import settings

_app: firebase_admin.App | None = None


def get_firebase_app() -> firebase_admin.App:
    """Devuelve la app Firebase (la inicializa si no existe)."""
    global _app
    if _app is None:
        cred = credentials.Certificate(settings.FIREBASE_SERVICE_ACCOUNT_PATH)
        _app = firebase_admin.initialize_app(cred)
    return _app


def get_firestore_client():
    """Devuelve el cliente de Firestore ya inicializado."""
    get_firebase_app()
    return firestore.client()


def get_auth_client():
    """Devuelve el módulo auth de Firebase Admin ya inicializado."""
    get_firebase_app()
    return auth
