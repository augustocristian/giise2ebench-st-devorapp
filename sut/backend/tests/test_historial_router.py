import pytest
from httpx import AsyncClient, ASGITransport
from unittest.mock import patch, MagicMock, AsyncMock
from app.main import app
from app.models.entities.usuarios import Usuario
from app.core.security import get_current_user
from app.models.entities.historial import Historial
import datetime

@pytest.fixture
def dummy_user():
    return Usuario(
        id="test_uid",
        email="test@test.com",
        username="testuser",
        nombre="Test",
        apellidos="User",
        ubicacion="Madrid"
    )

from app.models.entities.restaurante import Restaurante

@pytest.mark.asyncio
@patch("app.presentation.routers.historial_router._get_uid")
@patch("app.presentation.routers.historial_router.historial_service")
@patch("app.services.recommendation_service.recommendation_service")
async def test_get_historial_endpoint(mock_rec_service, mock_hist_service, mock_get_uid, dummy_user):
    mock_get_uid.return_value = "test_uid"
    mock_hist_service.get_historial.return_value = [
        Historial(id=1, user_id="test_uid", restaurante=Restaurante(place_id="place1"), fecha_acceso=datetime.datetime(2026,1,1))
    ]
    mock_rec_service.get_place_details = AsyncMock(return_value={"id": "place1", "name": "Restaurante 1"})

    app.dependency_overrides[get_current_user] = lambda: dummy_user

    async with AsyncClient(transport=ASGITransport(app=app), base_url="https://test") as ac:
        response = await ac.get("/api/historial")

    app.dependency_overrides.clear()

    assert response.status_code == 200
    data = response.json()
    assert len(data) == 1
    assert data[0]["place_id"] == "place1"
    assert data[0]["restaurant"]["name"] == "Restaurante 1"

@pytest.mark.asyncio
@patch("app.presentation.routers.historial_router._get_uid")
@patch("app.presentation.routers.historial_router.historial_service")
@patch("app.services.recommendation_service.recommendation_service")
async def test_add_to_historial_endpoint(mock_rec_service, mock_hist_service, mock_get_uid, dummy_user):
    mock_get_uid.return_value = "test_uid"
    mock_hist_service.add_to_historial.return_value = Historial(
        id=1, user_id="test_uid", restaurante=Restaurante(place_id="place1"), fecha_acceso=datetime.datetime(2026,1,1)
    )
    mock_rec_service.get_place_details = AsyncMock(return_value={"id": "place1", "name": "Restaurante 1"})

    app.dependency_overrides[get_current_user] = lambda: dummy_user

    async with AsyncClient(transport=ASGITransport(app=app), base_url="https://test") as ac:
        response = await ac.post("/api/historial", json={"place_id": "place1"})

    app.dependency_overrides.clear()

    assert response.status_code == 201
    data = response.json()
    assert data["place_id"] == "place1"

@pytest.mark.asyncio
@patch("app.presentation.routers.historial_router._get_uid")
@patch("app.presentation.routers.historial_router.historial_service")
async def test_delete_from_historial_endpoint_success(mock_hist_service, mock_get_uid, dummy_user):
    mock_get_uid.return_value = "test_uid"
    mock_hist_service.delete_from_historial.return_value = True

    app.dependency_overrides[get_current_user] = lambda: dummy_user

    async with AsyncClient(transport=ASGITransport(app=app), base_url="https://test") as ac:
        response = await ac.delete("/api/historial/1")

    app.dependency_overrides.clear()

    assert response.status_code == 204

@pytest.mark.asyncio
@patch("app.presentation.routers.historial_router._get_uid")
@patch("app.presentation.routers.historial_router.historial_service")
async def test_delete_from_historial_endpoint_not_found(mock_hist_service, mock_get_uid, dummy_user):
    mock_get_uid.return_value = "test_uid"
    mock_hist_service.delete_from_historial.return_value = False

    app.dependency_overrides[get_current_user] = lambda: dummy_user

    async with AsyncClient(transport=ASGITransport(app=app), base_url="https://test") as ac:
        response = await ac.delete("/api/historial/1")

    app.dependency_overrides.clear()

    assert response.status_code == 404


# ── GET /api/historial/populares ──────────────────────────────────────────────

@pytest.mark.asyncio
@patch("app.presentation.routers.historial_router.historial_service")
@patch("app.services.recommendation_service.recommendation_service")
async def test_get_popular_historial_sin_ubicacion(mock_rec_service, mock_hist_service):
    """El endpoint de populares debe devolver los más visitados sin filtro geográfico."""
    mock_hist_service.get_popular_places.return_value = [("place1", 10), ("place2", 5)]
    mock_rec_service.get_place_details = AsyncMock(
        side_effect=lambda pid: {"id": pid, "name": f"Restaurante {pid}",
                                  "latitude": 40.4, "longitude": -3.7}
    )

    async with AsyncClient(transport=ASGITransport(app=app), base_url="https://test") as ac:
        response = await ac.post("/api/historial/populares", json={"limit": 5})

    assert response.status_code == 200
    data = response.json()
    assert len(data) == 2
    assert data[0]["id"] == "place1"


@pytest.mark.asyncio
@patch("app.presentation.routers.historial_router.historial_service")
@patch("app.services.recommendation_service.recommendation_service")
async def test_get_popular_historial_con_ubicacion(mock_rec_service, mock_hist_service):
    """Con ubicación, el endpoint debe filtrar por distancia ≤ 30 km."""
    mock_hist_service.get_popular_places.return_value = [("place1", 10)]
    # place1 está a 0 km → debe pasar el filtro
    mock_rec_service.get_place_details = AsyncMock(
        return_value={"id": "place1", "name": "Cerca", "latitude": 40.4168, "longitude": -3.7038}
    )
    mock_rec_service._geocode_location = AsyncMock(return_value=(40.4168, -3.7038))

    async with AsyncClient(transport=ASGITransport(app=app), base_url="https://test") as ac:
        response = await ac.post("/api/historial/populares", json={"limit": 5, "location": "Madrid"})

    assert response.status_code == 200

