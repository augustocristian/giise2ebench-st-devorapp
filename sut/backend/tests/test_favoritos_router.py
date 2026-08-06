import pytest
from httpx import AsyncClient, ASGITransport
from unittest.mock import patch, MagicMock, AsyncMock
from app.main import app
from app.models.entities.usuarios import Usuario
from app.core.security import get_current_user
from app.models.entities.listas_favoritos import ListaFavoritos
from app.models.entities.favoritos import Favorito

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

@pytest.mark.asyncio
@patch("app.presentation.routers.favoritos_router._get_uid")
@patch("app.presentation.routers.favoritos_router.favoritos_service")
async def test_get_listas_endpoint(mock_service, mock_get_uid, dummy_user):
    mock_get_uid.return_value = "test_uid"
    mock_service.get_listas.return_value = [ListaFavoritos(id=1, user_id="test_uid", nombre="Fav1")]
    
    app.dependency_overrides[get_current_user] = lambda: dummy_user

    async with AsyncClient(transport=ASGITransport(app=app), base_url="https://test") as ac:
        response = await ac.get("/api/favoritos/listas")

    app.dependency_overrides.clear()

    assert response.status_code == 200
    data = response.json()
    assert len(data) == 1
    assert data[0]["nombre"] == "Fav1"

@pytest.mark.asyncio
@patch("app.presentation.routers.favoritos_router._get_uid")
@patch("app.presentation.routers.favoritos_router.favoritos_service")
async def test_create_lista_endpoint_success(mock_service, mock_get_uid, dummy_user):
    mock_get_uid.return_value = "test_uid"
    mock_service.create_lista.return_value = ListaFavoritos(id=1, user_id="test_uid", nombre="Fav1")
    
    app.dependency_overrides[get_current_user] = lambda: dummy_user

    async with AsyncClient(transport=ASGITransport(app=app), base_url="https://test") as ac:
        response = await ac.post("/api/favoritos/listas", json={"nombre": "Fav1"})

    app.dependency_overrides.clear()

    assert response.status_code == 201
    data = response.json()
    assert data["nombre"] == "Fav1"

@pytest.mark.asyncio
@patch("app.presentation.routers.favoritos_router._get_uid")
@patch("app.presentation.routers.favoritos_router.favoritos_service")
async def test_create_lista_endpoint_duplicate(mock_service, mock_get_uid, dummy_user):
    mock_get_uid.return_value = "test_uid"
    mock_service.create_lista.side_effect = ValueError("Ya existe una lista")
    
    app.dependency_overrides[get_current_user] = lambda: dummy_user

    async with AsyncClient(transport=ASGITransport(app=app), base_url="https://test") as ac:
        response = await ac.post("/api/favoritos/listas", json={"nombre": "Fav1"})

    app.dependency_overrides.clear()

    assert response.status_code == 400
    assert "Ya existe" in response.json()["detail"]

@pytest.mark.asyncio
@patch("app.presentation.routers.favoritos_router._get_uid")
@patch("app.presentation.routers.favoritos_router.favoritos_service")
async def test_delete_lista_endpoint_success(mock_service, mock_get_uid, dummy_user):
    mock_get_uid.return_value = "test_uid"
    mock_service.delete_lista.return_value = True
    
    app.dependency_overrides[get_current_user] = lambda: dummy_user

    async with AsyncClient(transport=ASGITransport(app=app), base_url="https://test") as ac:
        response = await ac.delete("/api/favoritos/listas/1")

    app.dependency_overrides.clear()

    assert response.status_code == 204

@pytest.mark.asyncio
@patch("app.presentation.routers.favoritos_router._get_uid")
@patch("app.presentation.routers.favoritos_router.favoritos_service")
async def test_delete_lista_endpoint_not_found(mock_service, mock_get_uid, dummy_user):
    mock_get_uid.return_value = "test_uid"
    mock_service.delete_lista.return_value = False
    
    app.dependency_overrides[get_current_user] = lambda: dummy_user

    async with AsyncClient(transport=ASGITransport(app=app), base_url="https://test") as ac:
        response = await ac.delete("/api/favoritos/listas/1")

    app.dependency_overrides.clear()

    assert response.status_code == 404

from app.models.entities.restaurante import Restaurante

@pytest.mark.asyncio
@patch("app.presentation.routers.favoritos_router._get_uid")
@patch("app.presentation.routers.favoritos_router.favoritos_service")
@patch("app.services.recommendation_service.recommendation_service")
async def test_get_lista_detalle_endpoint(mock_rec_service, mock_fav_service, mock_get_uid, dummy_user):
    mock_get_uid.return_value = "test_uid"
    mock_fav_service.get_lista_by_id.return_value = ListaFavoritos(id=1, user_id="test_uid", nombre="Fav1")
    mock_fav_service.get_favoritos.return_value = [
        Favorito(id=1, lista_id=1, restaurante=Restaurante(place_id="place1"))
    ]
    mock_rec_service.get_place_details = AsyncMock(return_value={"id": "place1", "name": "Restaurante 1"})

    app.dependency_overrides[get_current_user] = lambda: dummy_user

    async with AsyncClient(transport=ASGITransport(app=app), base_url="https://test") as ac:
        response = await ac.get("/api/favoritos/listas/1")

    app.dependency_overrides.clear()

    assert response.status_code == 200
    data = response.json()
    assert data["lista"]["nombre"] == "Fav1"
    assert len(data["restaurantes"]) == 1
    assert data["restaurantes"][0]["place_id"] == "place1"

@pytest.mark.asyncio
@patch("app.presentation.routers.favoritos_router._get_uid")
@patch("app.presentation.routers.favoritos_router.favoritos_service")
@patch("app.services.recommendation_service.recommendation_service")
async def test_add_favorito_endpoint_success(mock_rec_service, mock_fav_service, mock_get_uid, dummy_user):
    mock_get_uid.return_value = "test_uid"
    mock_fav_service.get_lista_by_id.return_value = ListaFavoritos(id=1, user_id="test_uid", nombre="Fav1")
    mock_fav_service.add_favorito.return_value = Favorito(id=1, lista_id=1, restaurante=Restaurante(place_id="place1"))
    mock_rec_service.get_place_details = AsyncMock(return_value={"id": "place1", "name": "Restaurante 1"})

    app.dependency_overrides[get_current_user] = lambda: dummy_user

    async with AsyncClient(transport=ASGITransport(app=app), base_url="https://test") as ac:
        response = await ac.post("/api/favoritos/listas/1", json={"place_id": "place1"})

    app.dependency_overrides.clear()

    assert response.status_code == 201
    data = response.json()
    assert data["place_id"] == "place1"

@pytest.mark.asyncio
@patch("app.presentation.routers.favoritos_router._get_uid")
@patch("app.presentation.routers.favoritos_router.favoritos_service")
async def test_add_favorito_endpoint_duplicate(mock_fav_service, mock_get_uid, dummy_user):
    mock_get_uid.return_value = "test_uid"
    mock_fav_service.get_lista_by_id.return_value = ListaFavoritos(id=1, user_id="test_uid", nombre="Fav1")
    mock_fav_service.add_favorito.side_effect = ValueError("Duplicado intentado")

    app.dependency_overrides[get_current_user] = lambda: dummy_user

    async with AsyncClient(transport=ASGITransport(app=app), base_url="https://test") as ac:
        response = await ac.post("/api/favoritos/listas/1", json={"place_id": "place1"})

    app.dependency_overrides.clear()

    assert response.status_code == 400
    assert "Duplicado" in response.json()["detail"]

@pytest.mark.asyncio
@patch("app.presentation.routers.favoritos_router._get_uid")
@patch("app.presentation.routers.favoritos_router.favoritos_service")
async def test_delete_favorito_endpoint_success(mock_service, mock_get_uid, dummy_user):
    mock_get_uid.return_value = "test_uid"
    mock_service.delete_favorito.return_value = True
    
    app.dependency_overrides[get_current_user] = lambda: dummy_user

    async with AsyncClient(transport=ASGITransport(app=app), base_url="https://test") as ac:
        response = await ac.delete("/api/favoritos/1")

    app.dependency_overrides.clear()

    assert response.status_code == 204
