import pytest
from httpx import AsyncClient, ASGITransport
from unittest.mock import patch, MagicMock, AsyncMock
from app.main import app
from app.models.entities.usuarios import Usuario
from app.core.security import get_current_user
from app.models.entities.favorite_lists import FavoriteList
from app.models.entities.favorites import Favorite
from app.services.favorites_service import ConflictError

@pytest.fixture
def dummy_user():
    return Usuario(
        id="test_uid",
        email="test@test.com",
        username="testuser",
        first_name="Test",
        last_name="User",
        location="Madrid"
    )

@pytest.mark.asyncio
@patch("app.presentation.routers.favorites_router._get_uid")
@patch("app.presentation.routers.favorites_router.favorites_service")
async def test_get_lists_endpoint(mock_service, mock_get_uid, dummy_user):
    mock_get_uid.return_value = "test_uid"
    mock_service.get_lists.return_value = [FavoriteList(id=1, user_id="test_uid", name="Fav1")]
    
    app.dependency_overrides[get_current_user] = lambda: dummy_user

    async with AsyncClient(transport=ASGITransport(app=app), base_url="https://test") as ac:
        response = await ac.get("/api/v1/favorites/lists")

    app.dependency_overrides.clear()

    assert response.status_code == 200
    data = response.json()
    assert len(data) == 1
    assert data[0]["name"] == "Fav1"

@pytest.mark.asyncio
@patch("app.presentation.routers.favorites_router._get_uid")
@patch("app.presentation.routers.favorites_router.favorites_service")
async def test_create_list_endpoint_success(mock_service, mock_get_uid, dummy_user):
    mock_get_uid.return_value = "test_uid"
    mock_service.create_list.return_value = FavoriteList(id=1, user_id="test_uid", name="Fav1")
    
    app.dependency_overrides[get_current_user] = lambda: dummy_user

    async with AsyncClient(transport=ASGITransport(app=app), base_url="https://test") as ac:
        response = await ac.post("/api/v1/favorites/lists", json={"name": "Fav1"})

    app.dependency_overrides.clear()

    assert response.status_code == 201
    assert response.headers["location"] == "/api/v1/favorites/lists/1"
    data = response.json()
    assert data["name"] == "Fav1"

@pytest.mark.asyncio
@patch("app.presentation.routers.favorites_router._get_uid")
@patch("app.presentation.routers.favorites_router.favorites_service")
async def test_create_list_endpoint_duplicate(mock_service, mock_get_uid, dummy_user):
    mock_get_uid.return_value = "test_uid"
    mock_service.create_list.side_effect = ConflictError("Ya existe una lista")
    
    app.dependency_overrides[get_current_user] = lambda: dummy_user

    async with AsyncClient(transport=ASGITransport(app=app), base_url="https://test") as ac:
        response = await ac.post("/api/v1/favorites/lists", json={"name": "Fav1"})

    app.dependency_overrides.clear()

    assert response.status_code == 409
    assert "Ya existe" in response.json()["detail"]

@pytest.mark.asyncio
@patch("app.presentation.routers.favorites_router._get_uid")
@patch("app.presentation.routers.favorites_router.favorites_service")
async def test_delete_list_endpoint_success(mock_service, mock_get_uid, dummy_user):
    mock_get_uid.return_value = "test_uid"
    mock_service.delete_list.return_value = True
    
    app.dependency_overrides[get_current_user] = lambda: dummy_user

    async with AsyncClient(transport=ASGITransport(app=app), base_url="https://test") as ac:
        response = await ac.delete("/api/v1/favorites/lists/1")

    app.dependency_overrides.clear()

    assert response.status_code == 204

@pytest.mark.asyncio
@patch("app.presentation.routers.favorites_router._get_uid")
@patch("app.presentation.routers.favorites_router.favorites_service")
async def test_delete_list_endpoint_not_found(mock_service, mock_get_uid, dummy_user):
    mock_get_uid.return_value = "test_uid"
    mock_service.delete_list.return_value = False
    
    app.dependency_overrides[get_current_user] = lambda: dummy_user

    async with AsyncClient(transport=ASGITransport(app=app), base_url="https://test") as ac:
        response = await ac.delete("/api/v1/favorites/lists/1")

    app.dependency_overrides.clear()

    assert response.status_code == 404

from app.models.entities.restaurant import Restaurant

@pytest.mark.asyncio
@patch("app.presentation.routers.favorites_router._get_uid")
@patch("app.presentation.routers.favorites_router.favorites_service")
@patch("app.services.recommendation_service.recommendation_service")
async def test_get_list_detalle_endpoint(mock_rec_service, mock_fav_service, mock_get_uid, dummy_user):
    mock_get_uid.return_value = "test_uid"
    mock_fav_service.get_list_by_id.return_value = FavoriteList(id=1, user_id="test_uid", name="Fav1")
    mock_fav_service.get_favorites.return_value = [
        Favorite(id=1, list_id=1, restaurant=Restaurant(place_id="place1"))
    ]
    mock_rec_service.get_place_details = AsyncMock(return_value={"id": "place1", "name": "Restaurant 1"})

    app.dependency_overrides[get_current_user] = lambda: dummy_user

    async with AsyncClient(transport=ASGITransport(app=app), base_url="https://test") as ac:
        response = await ac.get("/api/v1/favorites/lists/1")

    app.dependency_overrides.clear()

    assert response.status_code == 200
    data = response.json()
    assert data["list"]["name"] == "Fav1"
    assert len(data["restaurants"]) == 1
    assert data["restaurants"][0]["place_id"] == "place1"

@pytest.mark.asyncio
@patch("app.presentation.routers.favorites_router._get_uid")
@patch("app.presentation.routers.favorites_router.favorites_service")
@patch("app.services.recommendation_service.recommendation_service")
async def test_add_favorite_endpoint_success(mock_rec_service, mock_fav_service, mock_get_uid, dummy_user):
    mock_get_uid.return_value = "test_uid"
    mock_fav_service.get_list_by_id.return_value = FavoriteList(id=1, user_id="test_uid", name="Fav1")
    mock_fav_service.add_favorite.return_value = Favorite(id=1, list_id=1, restaurant=Restaurant(place_id="place1"))
    mock_rec_service.get_place_details = AsyncMock(return_value={"id": "place1", "name": "Restaurant 1"})

    app.dependency_overrides[get_current_user] = lambda: dummy_user

    async with AsyncClient(transport=ASGITransport(app=app), base_url="https://test") as ac:
        response = await ac.post("/api/v1/favorites/lists/1/restaurants", json={"place_id": "place1"})

    app.dependency_overrides.clear()

    assert response.status_code == 201
    assert response.headers["location"] == "/api/v1/favorites/lists/1/restaurants/1"
    data = response.json()
    assert data["place_id"] == "place1"

@pytest.mark.asyncio
@patch("app.presentation.routers.favorites_router._get_uid")
@patch("app.presentation.routers.favorites_router.favorites_service")
async def test_add_favorite_endpoint_duplicate(mock_fav_service, mock_get_uid, dummy_user):
    mock_get_uid.return_value = "test_uid"
    mock_fav_service.get_list_by_id.return_value = FavoriteList(id=1, user_id="test_uid", name="Fav1")
    mock_fav_service.add_favorite.side_effect = ValueError("Duplicado intentado")

    app.dependency_overrides[get_current_user] = lambda: dummy_user

    async with AsyncClient(transport=ASGITransport(app=app), base_url="https://test") as ac:
        response = await ac.post("/api/v1/favorites/lists/1/restaurants", json={"place_id": "place1"})

    app.dependency_overrides.clear()

    assert response.status_code == 409
    assert "Duplicado" in response.json()["detail"]

@pytest.mark.asyncio
@patch("app.presentation.routers.favorites_router._get_uid")
@patch("app.presentation.routers.favorites_router.favorites_service")
async def test_delete_favorite_endpoint_success(mock_service, mock_get_uid, dummy_user):
    mock_get_uid.return_value = "test_uid"
    mock_service.delete_favorite.return_value = True
    
    app.dependency_overrides[get_current_user] = lambda: dummy_user

    async with AsyncClient(transport=ASGITransport(app=app), base_url="https://test") as ac:
        response = await ac.delete("/api/v1/favorites/lists/1/restaurants/7")

    app.dependency_overrides.clear()

    assert response.status_code == 204


# ── New in the REST redesign ───────────────────────────────────────────────────

@pytest.mark.asyncio
@patch("app.presentation.routers.favorites_router._get_uid")
@patch("app.presentation.routers.favorites_router.favorites_service")
async def test_delete_favorite_is_scoped_to_its_list(mock_service, mock_get_uid, dummy_user):
    mock_get_uid.return_value = "test_uid"
    mock_service.delete_favorite.return_value = True
    app.dependency_overrides[get_current_user] = lambda: dummy_user
    async with AsyncClient(transport=ASGITransport(app=app), base_url="https://test") as ac:
        response = await ac.delete("/api/v1/favorites/lists/3/restaurants/7")
    app.dependency_overrides.clear()
    assert response.status_code == 204
    assert mock_service.delete_favorite.call_args.args[1:] == (3, 7, "test_uid")


@pytest.mark.asyncio
@patch("app.presentation.routers.favorites_router._get_uid")
@patch("app.presentation.routers.favorites_router.favorites_service")
async def test_delete_favorite_not_found_in_that_list(mock_service, mock_get_uid, dummy_user):
    mock_get_uid.return_value = "test_uid"
    mock_service.delete_favorite.return_value = False
    app.dependency_overrides[get_current_user] = lambda: dummy_user
    async with AsyncClient(transport=ASGITransport(app=app), base_url="https://test") as ac:
        response = await ac.delete("/api/v1/favorites/lists/3/restaurants/7")
    app.dependency_overrides.clear()
    assert response.status_code == 404


@pytest.mark.asyncio
@patch("app.presentation.routers.favorites_router._get_uid")
@patch("app.presentation.routers.favorites_router.favorites_service")
async def test_old_favorite_routes_are_gone(mock_service, mock_get_uid, dummy_user):
    app.dependency_overrides[get_current_user] = lambda: dummy_user
    async with AsyncClient(transport=ASGITransport(app=app), base_url="https://test") as ac:
        old_list = await ac.get("/api/favorites/lists")
        old_delete = await ac.delete("/api/v1/favorites/1")
        old_add = await ac.post("/api/v1/favorites/lists/1", json={"place_id": "p"})
    app.dependency_overrides.clear()
    assert old_list.status_code == 404
    assert old_delete.status_code == 404
    assert old_add.status_code == 405


@pytest.mark.asyncio
@patch("app.presentation.routers.favorites_router._get_uid")
@patch("app.presentation.routers.favorites_router.favorites_service")
async def test_create_list_invalid_name_returns_422(mock_service, mock_get_uid, dummy_user):
    mock_get_uid.return_value = "test_uid"
    mock_service.create_list.side_effect = ValueError("El nombre de la lista no puede estar vacío.")
    app.dependency_overrides[get_current_user] = lambda: dummy_user
    async with AsyncClient(transport=ASGITransport(app=app), base_url="https://test") as ac:
        response = await ac.post("/api/v1/favorites/lists", json={"name": "  "})
    app.dependency_overrides.clear()
    assert response.status_code == 422


@pytest.mark.asyncio
@patch("app.presentation.routers.favorites_router._get_uid")
@patch("app.presentation.routers.favorites_router.favorites_service")
async def test_update_list_duplicate_409_and_invalid_422(mock_service, mock_get_uid, dummy_user):
    mock_get_uid.return_value = "test_uid"
    app.dependency_overrides[get_current_user] = lambda: dummy_user
    async with AsyncClient(transport=ASGITransport(app=app), base_url="https://test") as ac:
        mock_service.update_list.side_effect = ConflictError("Ya existe otra lista")
        dup = await ac.patch("/api/v1/favorites/lists/1", json={"name": "Dup"})
        mock_service.update_list.side_effect = ValueError("vacío")
        invalid = await ac.patch("/api/v1/favorites/lists/1", json={"name": " "})
    app.dependency_overrides.clear()
    assert dup.status_code == 409
    assert invalid.status_code == 422
