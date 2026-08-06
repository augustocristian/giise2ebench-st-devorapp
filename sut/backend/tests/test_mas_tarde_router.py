"""Tests para el router /api/mas-tarde."""
import pytest
from httpx import AsyncClient, ASGITransport
from unittest.mock import patch, AsyncMock
from app.main import app
from app.core.security import get_current_user
from app.models.entities.mas_tarde import MasTarde
from app.models.entities.restaurante import Restaurante


# ── GET /api/mas-tarde ────────────────────────────────────────────────────────

@pytest.mark.asyncio
@patch("app.presentation.routers.mas_tarde_router._get_uid")
@patch("app.presentation.routers.mas_tarde_router.mas_tarde_service")
@patch("app.presentation.routers.mas_tarde_router.recommendation_service")
async def test_get_mas_tarde_endpoint(mock_rec, mock_service, mock_uid, dummy_user):
    mock_uid.return_value = "test_uid"
    mock_service.get_mas_tarde.return_value = [
        MasTarde(id=1, user_id="test_uid", restaurante=Restaurante(place_id="place1"))
    ]
    mock_rec.get_place_details = AsyncMock(return_value={"id": "place1", "name": "Restaurante 1"})

    app.dependency_overrides[get_current_user] = lambda: dummy_user
    async with AsyncClient(transport=ASGITransport(app=app), base_url="https://test") as ac:
        response = await ac.get("/api/mas-tarde")
    app.dependency_overrides.clear()

    assert response.status_code == 200
    data = response.json()
    assert len(data) == 1
    assert data[0]["place_id"] == "place1"
    assert data[0]["restaurant"]["name"] == "Restaurante 1"


# ── POST /api/mas-tarde ───────────────────────────────────────────────────────

@pytest.mark.asyncio
@patch("app.presentation.routers.mas_tarde_router._get_uid")
@patch("app.presentation.routers.mas_tarde_router.mas_tarde_service")
@patch("app.presentation.routers.mas_tarde_router.recommendation_service")
async def test_add_to_mas_tarde_endpoint_nuevo(mock_rec, mock_service, mock_uid, dummy_user):
    mock_uid.return_value = "test_uid"
    entry = MasTarde(id=1, user_id="test_uid", restaurante=Restaurante(place_id="place1"))
    mock_service.add_to_mas_tarde.return_value = (entry, False)
    mock_rec.get_place_details = AsyncMock(return_value={"id": "place1", "name": "Restaurante 1"})

    app.dependency_overrides[get_current_user] = lambda: dummy_user
    async with AsyncClient(transport=ASGITransport(app=app), base_url="https://test") as ac:
        response = await ac.post("/api/mas-tarde", json={"place_id": "place1"})
    app.dependency_overrides.clear()

    assert response.status_code == 201
    data = response.json()
    assert data["place_id"] == "place1"
    assert data["already_saved"] is False


@pytest.mark.asyncio
@patch("app.presentation.routers.mas_tarde_router._get_uid")
@patch("app.presentation.routers.mas_tarde_router.mas_tarde_service")
@patch("app.presentation.routers.mas_tarde_router.recommendation_service")
async def test_add_to_mas_tarde_endpoint_ya_existente(mock_rec, mock_service, mock_uid, dummy_user):
    mock_uid.return_value = "test_uid"
    entry = MasTarde(id=2, user_id="test_uid", restaurante=Restaurante(place_id="place2"))
    mock_service.add_to_mas_tarde.return_value = (entry, True)
    mock_rec.get_place_details = AsyncMock(return_value={"id": "place2", "name": "Restaurante 2"})

    app.dependency_overrides[get_current_user] = lambda: dummy_user
    async with AsyncClient(transport=ASGITransport(app=app), base_url="https://test") as ac:
        response = await ac.post("/api/mas-tarde", json={"place_id": "place2"})
    app.dependency_overrides.clear()

    assert response.status_code == 201
    data = response.json()
    assert data["already_saved"] is True


# ── DELETE /api/mas-tarde/{entry_id} ─────────────────────────────────────────

@pytest.mark.asyncio
@patch("app.presentation.routers.mas_tarde_router._get_uid")
@patch("app.presentation.routers.mas_tarde_router.mas_tarde_service")
async def test_delete_mas_tarde_endpoint_success(mock_service, mock_uid, dummy_user):
    mock_uid.return_value = "test_uid"
    mock_service.delete_from_mas_tarde.return_value = True

    app.dependency_overrides[get_current_user] = lambda: dummy_user
    async with AsyncClient(transport=ASGITransport(app=app), base_url="https://test") as ac:
        response = await ac.delete("/api/mas-tarde/1")
    app.dependency_overrides.clear()

    assert response.status_code == 204


@pytest.mark.asyncio
@patch("app.presentation.routers.mas_tarde_router._get_uid")
@patch("app.presentation.routers.mas_tarde_router.mas_tarde_service")
async def test_delete_mas_tarde_endpoint_not_found(mock_service, mock_uid, dummy_user):
    mock_uid.return_value = "test_uid"
    mock_service.delete_from_mas_tarde.return_value = False

    app.dependency_overrides[get_current_user] = lambda: dummy_user
    async with AsyncClient(transport=ASGITransport(app=app), base_url="https://test") as ac:
        response = await ac.delete("/api/mas-tarde/999")
    app.dependency_overrides.clear()

    assert response.status_code == 404
    assert "no encontrada" in response.json()["detail"].lower() or "no autorizada" in response.json()["detail"].lower()
