import pytest
from httpx import AsyncClient, ASGITransport
from unittest.mock import patch, MagicMock, AsyncMock
from app.main import app
from app.models.entities.usuarios import Usuario
from app.core.security import get_current_user
from app.models.entities.valoracion import Valoracion
from app.models.dtos.valoracion_dto import ValoracionResponse, ValoracionPublicaResponse


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


from datetime import datetime

@pytest.fixture
def dummy_valoracion():
    return Valoracion(
        id=1, user_id="test_uid", restaurante=Restaurante(place_id="place1"),
        calidad=5, precio=4, higiene=3, trato=5, comentario="Excelente", me_gustas=0,
        fecha=datetime.now()
    )


# ── POST /api/valoraciones ────────────────────────────────────────────────────

@pytest.mark.asyncio
@patch("app.presentation.routers.valoraciones_router._get_uid")
@patch("app.presentation.routers.valoraciones_router.valoracion_service")
async def test_valorar_restaurante_endpoint(mock_service, mock_get_uid, dummy_user, dummy_valoracion):
    mock_get_uid.return_value = "test_uid"
    mock_service.valorar_restaurante.return_value = ValoracionResponse.model_validate(dummy_valoracion)

    app.dependency_overrides[get_current_user] = lambda: dummy_user

    async with AsyncClient(transport=ASGITransport(app=app), base_url="https://test") as ac:
        response = await ac.post("/api/valoraciones", json={
            "place_id": "place1", "calidad": 5, "precio": 4, "higiene": 3, "trato": 5
        })

    app.dependency_overrides.clear()

    assert response.status_code == 201
    data = response.json()
    assert data["place_id"] == "place1"
    assert data["calidad"] == 5


# ── GET /api/valoraciones ─────────────────────────────────────────────────────

@pytest.mark.asyncio
@patch("app.presentation.routers.valoraciones_router._get_uid")
@patch("app.presentation.routers.valoraciones_router.valoracion_service")
@patch("app.services.recommendation_service.recommendation_service")
async def test_obtener_todas_mis_valoraciones_endpoint(mock_rec_service, mock_service, mock_get_uid, dummy_user, dummy_valoracion):
    mock_get_uid.return_value = "test_uid"
    mock_service.obtener_todas_mis_valoraciones.return_value = [
        ValoracionResponse.model_validate(dummy_valoracion)
    ]
    mock_rec_service.get_place_details = AsyncMock(return_value={"id": "place1", "name": "Restaurante Test"})

    app.dependency_overrides[get_current_user] = lambda: dummy_user

    async with AsyncClient(transport=ASGITransport(app=app), base_url="https://test") as ac:
        response = await ac.get("/api/valoraciones")

    app.dependency_overrides.clear()

    assert response.status_code == 200
    data = response.json()
    assert len(data) == 1
    assert data[0]["place_id"] == "place1"
    assert data[0]["restaurant"]["name"] == "Restaurante Test"


# ── GET /api/valoraciones/{place_id} ─────────────────────────────────────────

@pytest.mark.asyncio
@patch("app.presentation.routers.valoraciones_router._get_uid")
@patch("app.presentation.routers.valoraciones_router.valoracion_service")
async def test_obtener_mi_valoracion_existente_endpoint(mock_service, mock_get_uid, dummy_user):
    mock_get_uid.return_value = "test_uid"
    mock_service.obtener_mi_valoracion.return_value = {
        "id": 1, "user_id": "test_uid", "place_id": "place1",
        "calidad": 5, "precio": 4, "higiene": 3, "trato": 5, "comentario": "Ok"
    }

    app.dependency_overrides[get_current_user] = lambda: dummy_user

    async with AsyncClient(transport=ASGITransport(app=app), base_url="https://test") as ac:
        response = await ac.get("/api/valoraciones/place1")

    app.dependency_overrides.clear()

    assert response.status_code == 200
    data = response.json()
    assert data["place_id"] == "place1"


@pytest.mark.asyncio
@patch("app.presentation.routers.valoraciones_router._get_uid")
@patch("app.presentation.routers.valoraciones_router.valoracion_service")
async def test_obtener_mi_valoracion_no_existente_endpoint(mock_service, mock_get_uid, dummy_user):
    mock_get_uid.return_value = "test_uid"
    mock_service.obtener_mi_valoracion.return_value = {}

    app.dependency_overrides[get_current_user] = lambda: dummy_user

    async with AsyncClient(transport=ASGITransport(app=app), base_url="https://test") as ac:
        response = await ac.get("/api/valoraciones/place_inexistente")

    app.dependency_overrides.clear()

    assert response.status_code == 200
    assert response.json() == {}


# ── DELETE /api/valoraciones/{place_id} ───────────────────────────────────────

@pytest.mark.asyncio
@patch("app.presentation.routers.valoraciones_router._get_uid")
@patch("app.presentation.routers.valoraciones_router.valoracion_service")
async def test_eliminar_valoracion_endpoint_success(mock_service, mock_get_uid, dummy_user):
    mock_get_uid.return_value = "test_uid"
    mock_service.eliminar_valoracion.return_value = True

    app.dependency_overrides[get_current_user] = lambda: dummy_user

    async with AsyncClient(transport=ASGITransport(app=app), base_url="https://test") as ac:
        response = await ac.delete("/api/valoraciones/place1")

    app.dependency_overrides.clear()

    assert response.status_code == 204


@pytest.mark.asyncio
@patch("app.presentation.routers.valoraciones_router._get_uid")
@patch("app.presentation.routers.valoraciones_router.valoracion_service")
async def test_eliminar_valoracion_endpoint_not_found(mock_service, mock_get_uid, dummy_user):
    mock_get_uid.return_value = "test_uid"
    mock_service.eliminar_valoracion.return_value = False

    app.dependency_overrides[get_current_user] = lambda: dummy_user

    async with AsyncClient(transport=ASGITransport(app=app), base_url="https://test") as ac:
        response = await ac.delete("/api/valoraciones/place_inexistente")

    app.dependency_overrides.clear()

    assert response.status_code == 404
    assert "no encontrada" in response.json()["detail"]


# ── GET /api/valoraciones/restaurante/{place_id} ──────────────────────────────

@pytest.mark.asyncio
@patch("app.presentation.routers.valoraciones_router._get_uid")
@patch("app.presentation.routers.valoraciones_router.valoracion_service")
async def test_obtener_resenas_restaurante_con_datos(mock_service, mock_get_uid, dummy_user):
    mock_get_uid.return_value = "test_uid"
    mock_service.obtener_resenas_restaurante.return_value = [
        ValoracionPublicaResponse(
            id=1, username="pepe", calidad=5, precio=4,
            higiene=3, trato=5, comentario="Genial", me_gustas=2, fecha=datetime.now()
        ),
        ValoracionPublicaResponse(
            id=2, username="ana", calidad=3, precio=3,
            higiene=4, trato=4, comentario=None, me_gustas=0, fecha=datetime.now()
        ),
    ]

    app.dependency_overrides[get_current_user] = lambda: dummy_user

    async with AsyncClient(transport=ASGITransport(app=app), base_url="https://test") as ac:
        response = await ac.get("/api/valoraciones/restaurante/place1")

    app.dependency_overrides.clear()

    assert response.status_code == 200
    data = response.json()
    assert len(data) == 2
    assert data[0]["username"] == "pepe"
    assert data[0]["me_gustas"] == 2
    assert data[1]["username"] == "ana"
    assert data[1]["comentario"] is None


@pytest.mark.asyncio
@patch("app.presentation.routers.valoraciones_router._get_uid")
@patch("app.presentation.routers.valoraciones_router.valoracion_service")
async def test_obtener_resenas_restaurante_sin_datos(mock_service, mock_get_uid, dummy_user):
    mock_get_uid.return_value = "test_uid"
    mock_service.obtener_resenas_restaurante.return_value = []

    app.dependency_overrides[get_current_user] = lambda: dummy_user

    async with AsyncClient(transport=ASGITransport(app=app), base_url="https://test") as ac:
        response = await ac.get("/api/valoraciones/restaurante/place_sin_resenas")

    app.dependency_overrides.clear()

    assert response.status_code == 200
    assert response.json() == []


# ── POST /api/valoraciones/{id}/like ─────────────────────────────────────────

@pytest.mark.asyncio
@patch("app.presentation.routers.valoraciones_router._get_uid")
@patch("app.presentation.routers.valoraciones_router.valoracion_service")
async def test_dar_me_gusta_exitoso(mock_service, mock_get_uid, dummy_user):
    mock_get_uid.return_value = "test_uid"
    mock_service.dar_me_gusta.return_value = ValoracionPublicaResponse(
        id=1, username="pepe", calidad=5, precio=4,
        higiene=3, trato=5, comentario="Genial", me_gustas=3, fecha=datetime.now()
    )

    app.dependency_overrides[get_current_user] = lambda: dummy_user

    async with AsyncClient(transport=ASGITransport(app=app), base_url="https://test") as ac:
        response = await ac.post("/api/valoraciones/1/like")

    app.dependency_overrides.clear()

    assert response.status_code == 200
    data = response.json()
    assert data["me_gustas"] == 3
    assert data["username"] == "pepe"


@pytest.mark.asyncio
@patch("app.presentation.routers.valoraciones_router._get_uid")
@patch("app.presentation.routers.valoraciones_router.valoracion_service")
async def test_dar_me_gusta_valoracion_no_encontrada(mock_service, mock_get_uid, dummy_user):
    mock_get_uid.return_value = "test_uid"
    mock_service.dar_me_gusta.return_value = None

    app.dependency_overrides[get_current_user] = lambda: dummy_user

    async with AsyncClient(transport=ASGITransport(app=app), base_url="https://test") as ac:
        response = await ac.post("/api/valoraciones/9999/like")

    app.dependency_overrides.clear()

    assert response.status_code == 404
    assert "no encontrada" in response.json()["detail"]
