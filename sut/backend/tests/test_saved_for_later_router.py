"""Tests for the /api/v1/saved-for-later router."""
import pytest
from httpx import AsyncClient, ASGITransport
from unittest.mock import patch, AsyncMock
from app.main import app
from app.core.security import get_current_user
from app.models.entities.saved_for_later import SavedForLater
from app.models.entities.restaurant import Restaurant


# ── GET /api/v1/saved-for-later ────────────────────────────────────────────────────────

@pytest.mark.asyncio
@patch("app.presentation.routers.saved_for_later_router._get_uid")
@patch("app.presentation.routers.saved_for_later_router.saved_for_later_service")
@patch("app.presentation.routers.saved_for_later_router.recommendation_service")
async def test_get_save_for_later_endpoint(mock_rec, mock_service, mock_uid, dummy_user):
    mock_uid.return_value = "test_uid"
    mock_service.get_save_for_later.return_value = ([
        SavedForLater(id=1, user_id="test_uid", restaurant=Restaurant(place_id="place1"))
    ], 1)
    mock_rec.get_place_details = AsyncMock(return_value={"id": "place1", "name": "Restaurant 1"})

    app.dependency_overrides[get_current_user] = lambda: dummy_user
    async with AsyncClient(transport=ASGITransport(app=app), base_url="https://test") as ac:
        response = await ac.get("/api/v1/saved-for-later")
    app.dependency_overrides.clear()

    assert response.status_code == 200
    data = response.json()
    assert (data["total"], data["limit"], data["offset"]) == (1, 50, 0)
    assert len(data["items"]) == 1
    assert data["items"][0]["place_id"] == "place1"
    assert data["items"][0]["restaurant"]["name"] == "Restaurant 1"


# ── POST /api/v1/saved-for-later ───────────────────────────────────────────────────────

@pytest.mark.asyncio
@patch("app.presentation.routers.saved_for_later_router._get_uid")
@patch("app.presentation.routers.saved_for_later_router.saved_for_later_service")
@patch("app.presentation.routers.saved_for_later_router.recommendation_service")
async def test_add_to_save_for_later_endpoint_new(mock_rec, mock_service, mock_uid, dummy_user):
    mock_uid.return_value = "test_uid"
    entry = SavedForLater(id=1, user_id="test_uid", restaurant=Restaurant(place_id="place1"))
    mock_service.add_to_save_for_later.return_value = (entry, False)
    mock_rec.get_place_details = AsyncMock(return_value={"id": "place1", "name": "Restaurant 1"})

    app.dependency_overrides[get_current_user] = lambda: dummy_user
    async with AsyncClient(transport=ASGITransport(app=app), base_url="https://test") as ac:
        response = await ac.post("/api/v1/saved-for-later", json={"place_id": "place1"})
    app.dependency_overrides.clear()

    assert response.status_code == 201
    assert response.headers["location"] == "/api/v1/saved-for-later/1"
    data = response.json()
    assert data["place_id"] == "place1"
    assert data["already_saved"] is False


@pytest.mark.asyncio
@patch("app.presentation.routers.saved_for_later_router._get_uid")
@patch("app.presentation.routers.saved_for_later_router.saved_for_later_service")
@patch("app.presentation.routers.saved_for_later_router.recommendation_service")
async def test_add_to_save_for_later_endpoint_already_existing(mock_rec, mock_service, mock_uid, dummy_user):
    mock_uid.return_value = "test_uid"
    entry = SavedForLater(id=2, user_id="test_uid", restaurant=Restaurant(place_id="place2"))
    mock_service.add_to_save_for_later.return_value = (entry, True)
    mock_rec.get_place_details = AsyncMock(return_value={"id": "place2", "name": "Restaurant 2"})

    app.dependency_overrides[get_current_user] = lambda: dummy_user
    async with AsyncClient(transport=ASGITransport(app=app), base_url="https://test") as ac:
        response = await ac.post("/api/v1/saved-for-later", json={"place_id": "place2"})
    app.dependency_overrides.clear()

    assert response.status_code == 200  # existing entry: no new resource, no Location
    assert "location" not in response.headers
    data = response.json()
    assert data["id"] == 2
    assert data["already_saved"] is True


# ── DELETE /api/v1/saved-for-later/{entry_id} ─────────────────────────────────────────

@pytest.mark.asyncio
@patch("app.presentation.routers.saved_for_later_router._get_uid")
@patch("app.presentation.routers.saved_for_later_router.saved_for_later_service")
async def test_delete_save_for_later_endpoint_success(mock_service, mock_uid, dummy_user):
    mock_uid.return_value = "test_uid"
    mock_service.delete_from_save_for_later.return_value = True

    app.dependency_overrides[get_current_user] = lambda: dummy_user
    async with AsyncClient(transport=ASGITransport(app=app), base_url="https://test") as ac:
        response = await ac.delete("/api/v1/saved-for-later/1")
    app.dependency_overrides.clear()

    assert response.status_code == 204


@pytest.mark.asyncio
@patch("app.presentation.routers.saved_for_later_router._get_uid")
@patch("app.presentation.routers.saved_for_later_router.saved_for_later_service")
async def test_delete_save_for_later_endpoint_not_found(mock_service, mock_uid, dummy_user):
    mock_uid.return_value = "test_uid"
    mock_service.delete_from_save_for_later.return_value = False

    app.dependency_overrides[get_current_user] = lambda: dummy_user
    async with AsyncClient(transport=ASGITransport(app=app), base_url="https://test") as ac:
        response = await ac.delete("/api/v1/saved-for-later/999")
    app.dependency_overrides.clear()

    assert response.status_code == 404
    assert "no encontrada" in response.json()["detail"].lower() or "no autorizada" in response.json()["detail"].lower()


# ── New in the REST redesign ───────────────────────────────────────────────────

@pytest.mark.asyncio
@patch("app.presentation.routers.saved_for_later_router._get_uid")
@patch("app.presentation.routers.saved_for_later_router.saved_for_later_service")
@patch("app.presentation.routers.saved_for_later_router.recommendation_service")
async def test_get_save_for_later_pagination(mock_rec, mock_service, mock_uid, dummy_user):
    mock_uid.return_value = "test_uid"
    mock_service.get_save_for_later.return_value = ([], 75)
    app.dependency_overrides[get_current_user] = lambda: dummy_user
    async with AsyncClient(transport=ASGITransport(app=app), base_url="https://test") as ac:
        response = await ac.get("/api/v1/saved-for-later?limit=25&offset=50")
    app.dependency_overrides.clear()
    assert response.status_code == 200
    assert response.json() == {"items": [], "total": 75, "limit": 25, "offset": 50}
    assert mock_service.get_save_for_later.call_args.args[2:] == (25, 50)


@pytest.mark.asyncio
@pytest.mark.parametrize("query", ["limit=0", "limit=101", "offset=-5"])
async def test_get_save_for_later_pagination_bounds_422(query, dummy_user):
    app.dependency_overrides[get_current_user] = lambda: dummy_user
    async with AsyncClient(transport=ASGITransport(app=app), base_url="https://test") as ac:
        response = await ac.get(f"/api/v1/saved-for-later?{query}")
    app.dependency_overrides.clear()
    assert response.status_code == 422


@pytest.mark.asyncio
@patch("app.presentation.routers.saved_for_later_router._get_uid")
@patch("app.presentation.routers.saved_for_later_router.saved_for_later_service")
@patch("app.presentation.routers.saved_for_later_router.recommendation_service")
async def test_get_save_for_later_entry_by_id(mock_rec, mock_service, mock_uid, dummy_user):
    mock_uid.return_value = "test_uid"
    mock_service.get_save_for_later_entry.return_value = SavedForLater(
        id=4, user_id="test_uid", restaurant=Restaurant(place_id="place1"))
    mock_rec.get_place_details = AsyncMock(return_value={"id": "place1", "name": "Restaurant 1"})
    app.dependency_overrides[get_current_user] = lambda: dummy_user
    async with AsyncClient(transport=ASGITransport(app=app), base_url="https://test") as ac:
        response = await ac.get("/api/v1/saved-for-later/4")
    app.dependency_overrides.clear()
    assert response.status_code == 200
    data = response.json()
    assert data["id"] == 4 and data["restaurant"]["name"] == "Restaurant 1"
    assert "already_saved" not in data


@pytest.mark.asyncio
@patch("app.presentation.routers.saved_for_later_router._get_uid")
@patch("app.presentation.routers.saved_for_later_router.saved_for_later_service")
async def test_get_save_for_later_entry_of_another_user_is_404(mock_service, mock_uid, dummy_user):
    mock_uid.return_value = "test_uid"
    mock_service.get_save_for_later_entry.return_value = None
    app.dependency_overrides[get_current_user] = lambda: dummy_user
    async with AsyncClient(transport=ASGITransport(app=app), base_url="https://test") as ac:
        response = await ac.get("/api/v1/saved-for-later/999")
    app.dependency_overrides.clear()
    assert response.status_code == 404
