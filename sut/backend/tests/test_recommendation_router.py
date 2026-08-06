import pytest
from httpx import AsyncClient, ASGITransport
from unittest.mock import patch, MagicMock
from app.main import app
from app.models.entities.usuarios import Usuario
from app.core.security import get_current_user

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
@patch("app.presentation.routers.recommendation_router.recommendation_service.search_restaurants")
async def test_search_recommendations_endpoint(mock_search, dummy_user):
    # Setup mock for service
    mock_search.return_value = {
        "results": [{"id": "1", "name": "Test Rest"}],
        "next_page_token": "token123"
    }

    # Sobrescribir dependencia para bypass de auth
    app.dependency_overrides[get_current_user] = lambda: dummy_user

    async with AsyncClient(transport=ASGITransport(app=app), base_url="https://test") as ac:
        payload = {
            "location": "Madrid",
            "categories": ["pizza"],
            "prices": [],
            "include_unconfirmed_price": False,
            "max_results": 10,
            "open_now": False
        }
        response = await ac.post("/api/recommendations/search", json=payload)

    # Limpiar overrides
    app.dependency_overrides.clear()

    assert response.status_code == 200
    data = response.json()
    assert len(data["results"]) == 1
    assert data["results"][0]["name"] == "Test Rest"
    assert data["next_page_token"] == "token123"

@pytest.mark.asyncio
async def test_search_recommendations_unauthorized():
    from fastapi import HTTPException
    
    # Simular fallo de autenticación
    def mock_get_current_user_fail():
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    app.dependency_overrides[get_current_user] = mock_get_current_user_fail

    async with AsyncClient(transport=ASGITransport(app=app), base_url="https://test") as ac:
        response = await ac.post("/api/recommendations/search", json={})

    app.dependency_overrides.clear()
    assert response.status_code == 401
