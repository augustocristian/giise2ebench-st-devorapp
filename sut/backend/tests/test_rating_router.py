import pytest
from httpx import AsyncClient, ASGITransport
from unittest.mock import patch, MagicMock, AsyncMock
from app.main import app
from app.models.entities.usuarios import Usuario
from app.core.security import get_current_user
from app.models.entities.rating import Rating
from app.models.dtos.rating_dto import RatingResponse, PublicRatingResponse


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


from datetime import datetime

@pytest.fixture
def dummy_review():
    return Rating(
        id=1, user_id="test_uid", restaurant=Restaurant(place_id="place1"),
        quality=5, price=4, hygiene=3, service=5, comment="Excelente", likes=0,
        created_at=datetime.now()
    )


# ── PUT /api/v1/restaurants/{place_id}/rating ────────────────────────────────────────────────────

@pytest.mark.asyncio
@patch("app.presentation.routers.ratings_router._get_uid")
@patch("app.presentation.routers.ratings_router.rating_service")
async def test_rate_restaurant_endpoint(mock_service, mock_get_uid, dummy_user, dummy_review):
    mock_get_uid.return_value = "test_uid"
    mock_service.rate_restaurant.return_value = (RatingResponse.model_validate(dummy_review), True)

    app.dependency_overrides[get_current_user] = lambda: dummy_user

    async with AsyncClient(transport=ASGITransport(app=app), base_url="https://test") as ac:
        response = await ac.put("/api/v1/restaurants/place1/rating", json={
            "quality": 5, "price": 4, "hygiene": 3, "service": 5
        })

    app.dependency_overrides.clear()

    assert response.status_code == 201
    assert response.headers["location"] == "/api/v1/restaurants/place1/rating"
    assert mock_service.rate_restaurant.call_args.args[1:3] == ("test_uid", "place1")
    data = response.json()
    assert data["place_id"] == "place1"
    assert data["quality"] == 5


# ── GET /api/v1/ratings ─────────────────────────────────────────────────────

@pytest.mark.asyncio
@patch("app.presentation.routers.ratings_router._get_uid")
@patch("app.presentation.routers.ratings_router.rating_service")
@patch("app.services.recommendation_service.recommendation_service")
async def test_get_all_my_reviews_endpoint(mock_rec_service, mock_service, mock_get_uid, dummy_user, dummy_review):
    mock_get_uid.return_value = "test_uid"
    mock_service.get_all_my_reviews.return_value = ([
        RatingResponse.model_validate(dummy_review)
    ], 1)
    mock_rec_service.get_place_details = AsyncMock(return_value={"id": "place1", "name": "Restaurant Test"})

    app.dependency_overrides[get_current_user] = lambda: dummy_user

    async with AsyncClient(transport=ASGITransport(app=app), base_url="https://test") as ac:
        response = await ac.get("/api/v1/ratings")

    app.dependency_overrides.clear()

    assert response.status_code == 200
    data = response.json()
    assert (data["total"], data["limit"], data["offset"]) == (1, 50, 0)
    assert len(data["items"]) == 1
    assert data["items"][0]["place_id"] == "place1"
    assert data["items"][0]["restaurant"]["name"] == "Restaurant Test"


# ── GET /api/v1/restaurants/{place_id}/rating ─────────────────────────────────────────

@pytest.mark.asyncio
@patch("app.presentation.routers.ratings_router._get_uid")
@patch("app.presentation.routers.ratings_router.rating_service")
async def test_get_my_review_existing_endpoint(mock_service, mock_get_uid, dummy_user):
    mock_get_uid.return_value = "test_uid"
    mock_service.get_my_review.return_value = {
        "id": 1, "user_id": "test_uid", "place_id": "place1",
        "quality": 5, "price": 4, "hygiene": 3, "service": 5, "comment": "Ok"
    }

    app.dependency_overrides[get_current_user] = lambda: dummy_user

    async with AsyncClient(transport=ASGITransport(app=app), base_url="https://test") as ac:
        response = await ac.get("/api/v1/restaurants/place1/rating")

    app.dependency_overrides.clear()

    assert response.status_code == 200
    data = response.json()
    assert data["place_id"] == "place1"


@pytest.mark.asyncio
@patch("app.presentation.routers.ratings_router._get_uid")
@patch("app.presentation.routers.ratings_router.rating_service")
async def test_get_my_review_nonexistent_endpoint(mock_service, mock_get_uid, dummy_user):
    mock_get_uid.return_value = "test_uid"
    mock_service.get_my_review.return_value = {}

    app.dependency_overrides[get_current_user] = lambda: dummy_user

    async with AsyncClient(transport=ASGITransport(app=app), base_url="https://test") as ac:
        response = await ac.get("/api/v1/restaurants/place_inexistente/rating")

    app.dependency_overrides.clear()

    assert response.status_code == 200
    assert response.json() == {}


# ── DELETE /api/v1/restaurants/{place_id}/rating ───────────────────────────────────────

@pytest.mark.asyncio
@patch("app.presentation.routers.ratings_router._get_uid")
@patch("app.presentation.routers.ratings_router.rating_service")
async def test_delete_review_endpoint_success(mock_service, mock_get_uid, dummy_user):
    mock_get_uid.return_value = "test_uid"
    mock_service.delete_review.return_value = True

    app.dependency_overrides[get_current_user] = lambda: dummy_user

    async with AsyncClient(transport=ASGITransport(app=app), base_url="https://test") as ac:
        response = await ac.delete("/api/v1/restaurants/place1/rating")

    app.dependency_overrides.clear()

    assert response.status_code == 204


@pytest.mark.asyncio
@patch("app.presentation.routers.ratings_router._get_uid")
@patch("app.presentation.routers.ratings_router.rating_service")
async def test_delete_review_endpoint_not_found(mock_service, mock_get_uid, dummy_user):
    mock_get_uid.return_value = "test_uid"
    mock_service.delete_review.return_value = False

    app.dependency_overrides[get_current_user] = lambda: dummy_user

    async with AsyncClient(transport=ASGITransport(app=app), base_url="https://test") as ac:
        response = await ac.delete("/api/v1/restaurants/place_inexistente/rating")

    app.dependency_overrides.clear()

    assert response.status_code == 404
    assert "no encontrada" in response.json()["detail"]


# ── GET /api/v1/restaurants/{place_id}/ratings ──────────────────────────────

@pytest.mark.asyncio
@patch("app.presentation.routers.ratings_router._get_uid")
@patch("app.presentation.routers.ratings_router.rating_service")
async def test_get_reviews_restaurant_with_data(mock_service, mock_get_uid, dummy_user):
    mock_get_uid.return_value = "test_uid"
    mock_service.get_restaurant_reviews.return_value = ([
        PublicRatingResponse(
            id=1, username="pepe", quality=5, price=4,
            hygiene=3, service=5, comment="Genial", likes=2, created_at=datetime.now()
        ),
        PublicRatingResponse(
            id=2, username="ana", quality=3, price=3,
            hygiene=4, service=4, comment=None, likes=0, created_at=datetime.now()
        ),
    ], 2)

    app.dependency_overrides[get_current_user] = lambda: dummy_user

    async with AsyncClient(transport=ASGITransport(app=app), base_url="https://test") as ac:
        response = await ac.get("/api/v1/restaurants/place1/ratings")

    app.dependency_overrides.clear()

    assert response.status_code == 200
    body = response.json()
    assert (body["total"], body["limit"], body["offset"]) == (2, 50, 0)
    data = body["items"]
    assert len(data) == 2
    assert data[0]["username"] == "pepe"
    assert data[0]["likes"] == 2
    assert data[1]["username"] == "ana"
    assert data[1]["comment"] is None


@pytest.mark.asyncio
@patch("app.presentation.routers.ratings_router._get_uid")
@patch("app.presentation.routers.ratings_router.rating_service")
async def test_get_reviews_restaurant_without_data(mock_service, mock_get_uid, dummy_user):
    mock_get_uid.return_value = "test_uid"
    mock_service.get_restaurant_reviews.return_value = ([], 0)

    app.dependency_overrides[get_current_user] = lambda: dummy_user

    async with AsyncClient(transport=ASGITransport(app=app), base_url="https://test") as ac:
        response = await ac.get("/api/v1/restaurants/place_sin_resenas/ratings")

    app.dependency_overrides.clear()

    assert response.status_code == 200
    assert response.json() == {"items": [], "total": 0, "limit": 50, "offset": 0}


# ── POST /api/v1/ratings/{id}/likes ─────────────────────────────────────────

@pytest.mark.asyncio
@patch("app.presentation.routers.ratings_router._get_uid")
@patch("app.presentation.routers.ratings_router.rating_service")
async def test_like_review_successful(mock_service, mock_get_uid, dummy_user):
    mock_get_uid.return_value = "test_uid"
    mock_service.like_review.return_value = PublicRatingResponse(
        id=1, username="pepe", quality=5, price=4,
        hygiene=3, service=5, comment="Genial", likes=3, created_at=datetime.now()
    )

    app.dependency_overrides[get_current_user] = lambda: dummy_user

    async with AsyncClient(transport=ASGITransport(app=app), base_url="https://test") as ac:
        response = await ac.post("/api/v1/ratings/1/likes")

    app.dependency_overrides.clear()

    assert response.status_code == 200
    data = response.json()
    assert data["likes"] == 3
    assert data["username"] == "pepe"


@pytest.mark.asyncio
@patch("app.presentation.routers.ratings_router._get_uid")
@patch("app.presentation.routers.ratings_router.rating_service")
async def test_like_review_review_not_found(mock_service, mock_get_uid, dummy_user):
    mock_get_uid.return_value = "test_uid"
    mock_service.like_review.return_value = None

    app.dependency_overrides[get_current_user] = lambda: dummy_user

    async with AsyncClient(transport=ASGITransport(app=app), base_url="https://test") as ac:
        response = await ac.post("/api/v1/ratings/9999/likes")

    app.dependency_overrides.clear()

    assert response.status_code == 404
    assert "no encontrada" in response.json()["detail"]


# ── New in the REST redesign ───────────────────────────────────────────────────

@pytest.mark.asyncio
@patch("app.presentation.routers.ratings_router._get_uid")
@patch("app.presentation.routers.ratings_router.rating_service")
async def test_put_rating_replaces_existing_returns_200_without_location(mock_service, mock_get_uid, dummy_user, dummy_review):
    mock_get_uid.return_value = "test_uid"
    mock_service.rate_restaurant.return_value = (RatingResponse.model_validate(dummy_review), False)
    app.dependency_overrides[get_current_user] = lambda: dummy_user
    async with AsyncClient(transport=ASGITransport(app=app), base_url="https://test") as ac:
        response = await ac.put("/api/v1/restaurants/place1/rating", json={
            "quality": 5, "price": 4, "hygiene": 3, "service": 5, "comment": "Excelente"
        })
    app.dependency_overrides.clear()
    assert response.status_code == 200
    assert "location" not in response.headers
    assert response.json()["comment"] == "Excelente"


@pytest.mark.asyncio
@pytest.mark.parametrize("body", [
    {"quality": 0, "price": 4, "hygiene": 3, "service": 5},
    {"quality": 6, "price": 4, "hygiene": 3, "service": 5},
    {"quality": 5, "price": 4, "hygiene": 3},
])
async def test_put_rating_invalid_body_returns_422(body, dummy_user):
    app.dependency_overrides[get_current_user] = lambda: dummy_user
    async with AsyncClient(transport=ASGITransport(app=app), base_url="https://test") as ac:
        response = await ac.put("/api/v1/restaurants/place1/rating", json=body)
    app.dependency_overrides.clear()
    assert response.status_code == 422


@pytest.mark.asyncio
async def test_old_rating_routes_are_gone(dummy_user):
    app.dependency_overrides[get_current_user] = lambda: dummy_user
    async with AsyncClient(transport=ASGITransport(app=app), base_url="https://test") as ac:
        post_old = await ac.post("/api/v1/ratings", json={"place_id": "p", "quality": 5, "price": 4, "hygiene": 3, "service": 5})
        get_old = await ac.get("/api/v1/ratings/restaurant/place1")
        like_old = await ac.post("/api/v1/ratings/1/like")
    app.dependency_overrides.clear()
    assert post_old.status_code == 405
    assert get_old.status_code == 404
    assert like_old.status_code == 404


@pytest.mark.asyncio
@patch("app.presentation.routers.ratings_router._get_uid")
@patch("app.presentation.routers.ratings_router.rating_service")
async def test_restaurant_ratings_pagination(mock_service, mock_get_uid, dummy_user):
    mock_get_uid.return_value = "test_uid"
    mock_service.get_restaurant_reviews.return_value = ([], 300)
    app.dependency_overrides[get_current_user] = lambda: dummy_user
    async with AsyncClient(transport=ASGITransport(app=app), base_url="https://test") as ac:
        response = await ac.get("/api/v1/restaurants/place1/ratings?limit=100&offset=200")
    app.dependency_overrides.clear()
    assert response.json() == {"items": [], "total": 300, "limit": 100, "offset": 200}
    assert mock_service.get_restaurant_reviews.call_args.args[1:] == ("place1", "test_uid", 100, 200)


@pytest.mark.asyncio
@patch("app.presentation.routers.ratings_router._get_uid")
@patch("app.presentation.routers.ratings_router.rating_service")
async def test_my_ratings_pagination_params_forwarded(mock_service, mock_get_uid, dummy_user):
    mock_get_uid.return_value = "test_uid"
    mock_service.get_all_my_reviews.return_value = ([], 0)
    app.dependency_overrides[get_current_user] = lambda: dummy_user
    async with AsyncClient(transport=ASGITransport(app=app), base_url="https://test") as ac:
        response = await ac.get("/api/v1/ratings?limit=5&offset=10")
    app.dependency_overrides.clear()
    assert response.json() == {"items": [], "total": 0, "limit": 5, "offset": 10}
    assert mock_service.get_all_my_reviews.call_args.args[1:] == ("test_uid", 5, 10)


@pytest.mark.asyncio
@pytest.mark.parametrize("url", [
    "/api/v1/ratings?limit=0", "/api/v1/ratings?limit=101", "/api/v1/ratings?offset=-1",
    "/api/v1/restaurants/place1/ratings?limit=101", "/api/v1/restaurants/place1/ratings?offset=-1",
])
async def test_ratings_pagination_bounds_return_422(url, dummy_user):
    app.dependency_overrides[get_current_user] = lambda: dummy_user
    async with AsyncClient(transport=ASGITransport(app=app), base_url="https://test") as ac:
        response = await ac.get(url)
    app.dependency_overrides.clear()
    assert response.status_code == 422


@pytest.mark.asyncio
@patch("app.presentation.routers.ratings_router._get_uid")
@patch("app.presentation.routers.ratings_router.rating_service")
async def test_like_is_idempotent_returns_200_both_times(mock_service, mock_get_uid, dummy_user):
    mock_get_uid.return_value = "test_uid"
    liked = PublicRatingResponse(id=1, username="pepe", quality=5, price=4, hygiene=3, service=5,
                                 comment=None, likes=1, liked_by_me=True, created_at=datetime.now())
    mock_service.like_review.return_value = liked
    app.dependency_overrides[get_current_user] = lambda: dummy_user
    async with AsyncClient(transport=ASGITransport(app=app), base_url="https://test") as ac:
        first = await ac.post("/api/v1/ratings/1/likes")
        second = await ac.post("/api/v1/ratings/1/likes")
    app.dependency_overrides.clear()
    assert first.status_code == second.status_code == 200
    assert first.json() == second.json()
    assert first.json()["liked_by_me"] is True and first.json()["likes"] == 1


@pytest.mark.asyncio
@patch("app.presentation.routers.ratings_router._get_uid")
@patch("app.presentation.routers.ratings_router.rating_service")
async def test_unlike_returns_204_and_is_idempotent(mock_service, mock_get_uid, dummy_user):
    mock_get_uid.return_value = "test_uid"
    mock_service.unlike_review.return_value = True
    app.dependency_overrides[get_current_user] = lambda: dummy_user
    async with AsyncClient(transport=ASGITransport(app=app), base_url="https://test") as ac:
        first = await ac.delete("/api/v1/ratings/1/likes")
        second = await ac.delete("/api/v1/ratings/1/likes")
    app.dependency_overrides.clear()
    assert first.status_code == second.status_code == 204
    assert first.content == b""


@pytest.mark.asyncio
@patch("app.presentation.routers.ratings_router._get_uid")
@patch("app.presentation.routers.ratings_router.rating_service")
async def test_unlike_rating_not_found(mock_service, mock_get_uid, dummy_user):
    mock_get_uid.return_value = "test_uid"
    mock_service.unlike_review.return_value = False
    app.dependency_overrides[get_current_user] = lambda: dummy_user
    async with AsyncClient(transport=ASGITransport(app=app), base_url="https://test") as ac:
        response = await ac.delete("/api/v1/ratings/9999/likes")
    app.dependency_overrides.clear()
    assert response.status_code == 404
    assert "no encontrada" in response.json()["detail"]
