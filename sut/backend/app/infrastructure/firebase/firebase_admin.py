"""
Firebase Admin SDK initialization.
Initialized once, lazily (lazy singleton).
"""
from __future__ import annotations

import os

import firebase_admin
from google.auth.credentials import AnonymousCredentials

from firebase_admin import credentials, firestore, auth

from app.core.config import settings

_app: firebase_admin.App | None = None


class _EmulatorCredential(credentials.Base):
    """Keyless credential for the Firebase emulators, which ignore authentication."""

    def get_credential(self):
        return AnonymousCredentials()


def _using_emulator() -> bool:
    return bool(
        os.getenv("FIREBASE_AUTH_EMULATOR_HOST") or os.getenv("FIRESTORE_EMULATOR_HOST")
    )


def get_firebase_app() -> firebase_admin.App:
    """Return the Firebase app (initializing it if missing)."""
    global _app
    if _app is None:
        if _using_emulator():
            _app = firebase_admin.initialize_app(
                _EmulatorCredential(), {"projectId": settings.FIREBASE_PROJECT_ID}
            )
        else:
            cred = credentials.Certificate(settings.FIREBASE_SERVICE_ACCOUNT_PATH)
            _app = firebase_admin.initialize_app(cred)
    return _app


def get_firestore_client():
    """Return the already initialized Firestore client."""
    get_firebase_app()
    return firestore.client()


def get_auth_client():
    """Return the already initialized Firebase Admin auth module."""
    get_firebase_app()
    return auth
