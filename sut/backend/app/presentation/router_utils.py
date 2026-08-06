"""
Utilidades compartidas entre los routers de la capa de presentación.

- get_firebase_uid: resuelve el Firebase UID a partir del usuario autenticado.
  Antes estaba duplicado como `_get_uid` en cada router.
"""
from app.models.entities.usuarios import Usuario


def get_firebase_uid(current_user: Usuario) -> str:
    """Resuelve el Firebase UID a partir del email del usuario autenticado.

    Args:
        current_user: Usuario cargado desde la cookie JWT por la dependencia
            ``get_current_user``.

    Returns:
        El UID de Firebase Auth correspondiente al usuario.
    """
    from firebase_admin import auth as fb_auth
    from app.infrastructure.firebase.firebase_admin import get_firebase_app
    get_firebase_app()
    return fb_auth.get_user_by_email(current_user.email).uid
