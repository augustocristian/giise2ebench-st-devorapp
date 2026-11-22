"""
Utilities shared by the presentation layer routers.

- get_firebase_uid: resolves the Firebase UID from the authenticated user.
  Previously duplicated as `_get_uid` in every router.
"""
from typing import Annotated, Any, List

from fastapi import Depends, Query

from app.models.entities.usuarios import Usuario

DEFAULT_PAGE_LIMIT = 50
MAX_PAGE_LIMIT = 100


class Pagination:
    """``limit``/``offset`` query parameters shared by every paginated collection."""

    def __init__(
        self,
        limit: Annotated[int, Query(ge=1, le=MAX_PAGE_LIMIT, description="Page size (max 100)")] = DEFAULT_PAGE_LIMIT,
        offset: Annotated[int, Query(ge=0, description="Number of items to skip")] = 0,
    ):
        self.limit = limit
        self.offset = offset


PaginationParams = Annotated[Pagination, Depends()]


def page_envelope(items: List[Any], total: int, page: Pagination) -> dict:
    """Build the ``{items, total, limit, offset}`` response envelope."""
    return {"items": items, "total": total, "limit": page.limit, "offset": page.offset}


def get_firebase_uid(current_user: Usuario) -> str:
    """Resolve the Firebase UID from the authenticated user's email.

    Args:
        current_user: Usuario loaded from the JWT cookie by the dependency
            ``get_current_user``.

    Returns:
        The Firebase Auth UID of the user.
    """
    from firebase_admin import auth as fb_auth
    from app.infrastructure.firebase.firebase_admin import get_firebase_app
    get_firebase_app()
    return fb_auth.get_user_by_email(current_user.email).uid
