import pytest
from httpx import AsyncClient, ASGITransport
from unittest.mock import patch, MagicMock, AsyncMock
from app.main import app
from app.models.entities.usuarios import Usuario
from app.core.security import get_current_user
from app.models.entities.history import History
import datetime

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

from app.models.entities.restaurant import Restaurant

@pytest.mark.asyncio
@patch("app.presentation.routers.history_router._get_uid")
@patch("app.presentation.routers.history_router.history_service")
@patch("app.services.recommendation_service.recommendation_service")
async def test_get_history_endpoint(mock_rec_service, mock_hist_service, mock_get_uid, dummy_user):
    mock_get_uid.return_value = "test_uid"
    mock_hist_service.get_history.return_value = ([
        History(id=1, user_id="test_uid", restaurant=Restaurant(place_id="place1"), accessed_at=datetime.datetime(2026,1,1))
    ], 1)
    mock_rec_service.get_place_details = AsyncMock(return_value={"id": "place1", "name": "Restaurant 1"})

    app.dependency_overrides[get_current_user] = lambda: dummy_user

    async with AsyncClient(transport=ASGITransport(app=app), base_url="https://test") as ac:
        response = await ac.get("/api/v1/history")

    app.dependency_overrides.clear()

    assert response.status_code == 200
    data = response.json()
    assert (data["total"], data["limit"], data["offset"]) == (1, 50, 0)
    assert len(data["items"]) == 1
    assert data["items"][0]["place_id"] == "place1"
    assert data["items"][0]["restaurant"]["name"] == "Restaurant 1"

@pytest.mark.asyncio
@patch("app.presentation.routers.history_router._get_uid")
@patch("app.presentation.routers.history_router.history_service")
@patch("app.services.recommendation_service.recommendation_service")
async def test_add_to_history_endpoint(mock_rec_service, mock_hist_service, mock_get_uid, dummy_user):
    mock_get_uid.return_value = "test_uid"
    mock_hist_service.add_to_history.return_value = History(
        id=1, user_id="test_uid", restaurant=Restaurant(place_id="place1"), accessed_at=datetime.datetime(2026,1,1)
    )
    mock_rec_service.get_place_details = AsyncMock(return_value={"id": "place1", "name": "Restaurant 1"})

    app.dependency_overrides[get_current_user] = lambda: dummy_user

    async with AsyncClient(transport=ASGITransport(app=app), base_url="https://test") as ac:
        response = await ac.post("/api/v1/history", json={"place_id": "place1"})

    app.dependency_overrides.clear()

    assert response.status_code == 201
    assert response.headers["location"] == "/api/v1/history/1"
    data = response.json()
    assert data["place_id"] == "place1"

@pytest.mark.asyncio
@patch("app.presentation.routers.history_router._get_uid")
@patch("app.presentation.routers.history_router.history_service")
async def test_delete_from_history_endpoint_success(mock_hist_service, mock_get_uid, dummy_user):
    mock_get_uid.return_value = "test_uid"
    mock_hist_service.delete_from_history.return_value = True

    app.dependency_overrides[get_current_user] = lambda: dummy_user

    async with AsyncClient(transport=ASGITransport(app=app), base_url="https://test") as ac:
        response = await ac.delete("/api/v1/history/1")

    app.dependency_overrides.clear()

    assert response.status_code == 204

@pytest.mark.asyncio
@patch("app.presentation.routers.history_router._get_uid")
@patch("app.presentation.routers.history_router.history_service")
async def test_delete_from_history_endpoint_not_found(mock_hist_service, mock_get_uid, dummy_user):
    mock_get_uid.return_value = "test_uid"
    mock_hist_service.delete_from_history.return_value = False

    app.dependency_overrides[get_current_user] = lambda: dummy_user

    async with AsyncClient(transport=ASGITransport(app=app), base_url="https://test") as ac:
        response = await ac.delete("/api/v1/history/1")

    app.dependency_overrides.clear()

    assert response.status_code == 404


# ── GET /api/history/popular ──────────────────────────────────────────────

@pytest.mark.asyncio
@patch("app.presentation.routers.history_router.history_service")
@patch("app.services.recommendation_service.recommendation_service")
async def test_get_popular_history_without_location(mock_rec_service, mock_hist_service):
    """The popular endpoint must return the most visited places without a geographic filter."""
    mock_hist_service.get_popular_places.return_value = [("place1", 10), ("place2", 5)]
    mock_rec_service.get_place_details = AsyncMock(
        side_effect=lambda pid: {"id": pid, "name": f"Restaurant {pid}",
                                  "latitude": 40.4, "longitude": -3.7}
    )

    async with AsyncClient(transport=ASGITransport(app=app), base_url="https://test") as ac:
        response = await ac.get("/api/v1/history/popular?limit=5")

    assert response.status_code == 200
    data = response.json()
    assert len(data) == 2
    assert data[0]["id"] == "place1"


@pytest.mark.asyncio
@patch("app.presentation.routers.history_router.history_service")
@patch("app.services.recommendation_service.recommendation_service")
async def test_get_popular_history_with_location(mock_rec_service, mock_hist_service):
    """With a location, the endpoint must filter by distance <= 30 km."""
    mock_hist_service.get_popular_places.return_value = [("place1", 10)]
    # place1 is 0 km away -> must pass the filter
    mock_rec_service.get_place_details = AsyncMock(
        return_value={"id": "place1", "name": "Cerca", "latitude": 40.4168, "longitude": -3.7038}
    )
    mock_rec_service._geocode_location = AsyncMock(return_value=(40.4168, -3.7038))

    async with AsyncClient(transport=ASGITransport(app=app), base_url="https://test") as ac:
        response = await ac.get("/api/v1/history/popular?limit=5&location=Madrid")

    assert response.status_code == 200


# ── New in the REST redesign ───────────────────────────────────────────────────

def _history_entry(entry_id=1, place="place1"):
    return History(id=entry_id, user_id="test_uid", restaurant=Restaurant(place_id=place),
                   accessed_at=datetime.datetime(2026, 1, 1))


@pytest.mark.asyncio
@patch("app.presentation.routers.history_router._get_uid")
@patch("app.presentation.routers.history_router.history_service")
@patch("app.services.recommendation_service.recommendation_service")
async def test_get_history_pagination_params_and_envelope(mock_rec, mock_hist, mock_get_uid, dummy_user):
    mock_get_uid.return_value = "test_uid"
    mock_hist.get_history.return_value = ([_history_entry(5)], 120)
    mock_rec.get_place_details = AsyncMock(return_value={"id": "place1"})
    app.dependency_overrides[get_current_user] = lambda: dummy_user
    async with AsyncClient(transport=ASGITransport(app=app), base_url="https://test") as ac:
        response = await ac.get("/api/v1/history?limit=10&offset=20")
    app.dependency_overrides.clear()

    assert response.status_code == 200
    data = response.json()
    assert (data["total"], data["limit"], data["offset"]) == (120, 10, 20)
    assert set(data) == {"items", "total", "limit", "offset"}
    assert mock_hist.get_history.call_args.args[2:] == (10, 20)


@pytest.mark.asyncio
@pytest.mark.parametrize("query", ["limit=0", "limit=101", "limit=-1", "offset=-1", "limit=abc"])
async def test_get_history_pagination_bounds_return_422(query, dummy_user):
    app.dependency_overrides[get_current_user] = lambda: dummy_user
    async with AsyncClient(transport=ASGITransport(app=app), base_url="https://test") as ac:
        response = await ac.get(f"/api/v1/history?{query}")
    app.dependency_overrides.clear()
    assert response.status_code == 422


@pytest.mark.asyncio
@patch("app.presentation.routers.history_router._get_uid")
@patch("app.presentation.routers.history_router.history_service")
@patch("app.services.recommendation_service.recommendation_service")
async def test_get_history_max_limit_accepted(mock_rec, mock_hist, mock_get_uid, dummy_user):
    mock_get_uid.return_value = "test_uid"
    mock_hist.get_history.return_value = ([], 0)
    app.dependency_overrides[get_current_user] = lambda: dummy_user
    async with AsyncClient(transport=ASGITransport(app=app), base_url="https://test") as ac:
        response = await ac.get("/api/v1/history?limit=100")
    app.dependency_overrides.clear()
    assert response.status_code == 200
    assert response.json() == {"items": [], "total": 0, "limit": 100, "offset": 0}


@pytest.mark.asyncio
@patch("app.presentation.routers.history_router._get_uid")
@patch("app.presentation.routers.history_router.history_service")
@patch("app.services.recommendation_service.recommendation_service")
async def test_get_history_entry_by_id(mock_rec, mock_hist, mock_get_uid, dummy_user):
    mock_get_uid.return_value = "test_uid"
    mock_hist.get_history_entry.return_value = _history_entry(7)
    mock_rec.get_place_details = AsyncMock(return_value={"id": "place1", "name": "Restaurant 1"})
    app.dependency_overrides[get_current_user] = lambda: dummy_user
    async with AsyncClient(transport=ASGITransport(app=app), base_url="https://test") as ac:
        response = await ac.get("/api/v1/history/7")
    app.dependency_overrides.clear()

    assert response.status_code == 200
    data = response.json()
    assert data["id"] == 7
    assert data["restaurant"]["name"] == "Restaurant 1"
    assert mock_hist.get_history_entry.call_args.args[1:] == (7, "test_uid")


@pytest.mark.asyncio
@patch("app.presentation.routers.history_router._get_uid")
@patch("app.presentation.routers.history_router.history_service")
async def test_get_history_entry_of_another_user_is_404(mock_hist, mock_get_uid, dummy_user):
    mock_get_uid.return_value = "test_uid"
    mock_hist.get_history_entry.return_value = None  # the service filters by owner
    app.dependency_overrides[get_current_user] = lambda: dummy_user
    async with AsyncClient(transport=ASGITransport(app=app), base_url="https://test") as ac:
        response = await ac.get("/api/v1/history/999")
    app.dependency_overrides.clear()
    assert response.status_code == 404
    assert "no encontrada" in response.json()["detail"]


@pytest.mark.asyncio
@patch("app.presentation.routers.history_router.history_service")
@patch("app.services.recommendation_service.recommendation_service")
async def test_get_popular_default_limit_and_no_post(mock_rec, mock_hist):
    mock_hist.get_popular_places.return_value = [("p%d" % i, 10 - i) for i in range(8)]
    mock_rec.get_place_details = AsyncMock(side_effect=lambda pid: {"id": pid})
    async with AsyncClient(transport=ASGITransport(app=app), base_url="https://test") as ac:
        response = await ac.get("/api/v1/history/popular")
        old_post = await ac.post("/api/v1/history/popular", json={"limit": 5})
    assert response.status_code == 200
    assert len(response.json()) == 5  # default limit
    assert response.json()[0]["visit_count"] == 10
    assert old_post.status_code in (401, 405, 422)  # POST /history/popular no longer exists
