"""Tests para la capa de infraestructura: GooglePlacesClient y KerasApiClient."""
import pytest
from unittest.mock import patch, MagicMock, AsyncMock
import httpx

from app.infrastructure.google_places_client import GooglePlacesClient
from app.infrastructure.keras_api_client import KerasApiClient


# ── GooglePlacesClient ────────────────────────────────────────────────────────

@pytest.fixture
def places_client():
    return GooglePlacesClient()


@pytest.mark.asyncio
async def test_geocode_ok(places_client):
    """geocode devuelve lat/lng cuando la API responde con resultados."""
    mock_response = MagicMock()
    mock_response.status_code = 200
    mock_response.json.return_value = {
        "results": [{"geometry": {"location": {"lat": 43.5, "lng": -5.66}}}]
    }
    with patch("httpx.AsyncClient.get", return_value=mock_response):
        result = await places_client.geocode("Gijón")
    assert result == {"lat": 43.5, "lng": -5.66}


@pytest.mark.asyncio
async def test_geocode_sin_resultados(places_client):
    """geocode devuelve None cuando la API no encuentra resultados."""
    mock_response = MagicMock()
    mock_response.status_code = 200
    mock_response.json.return_value = {"results": []}
    with patch("httpx.AsyncClient.get", return_value=mock_response):
        result = await places_client.geocode("Lugar inventado XYZ")
    assert result is None


@pytest.mark.asyncio
async def test_geocode_timeout(places_client):
    """geocode devuelve None si se produce un timeout."""
    with patch("httpx.AsyncClient.get", side_effect=httpx.TimeoutException("timeout")):
        result = await places_client.geocode("Madrid")
    assert result is None


@pytest.mark.asyncio
async def test_search_places_ok(places_client):
    """search_places devuelve lugares y next_page_token cuando la API responde bien."""
    mock_response = MagicMock()
    mock_response.status_code = 200
    mock_response.json.return_value = {
        "places": [{"id": "p1", "displayName": {"text": "Restaurante A"}}],
        "nextPageToken": "tok123"
    }
    with patch("httpx.AsyncClient.post", return_value=mock_response):
        result = await places_client.search_places("pizza Madrid")
    assert len(result["places"]) == 1
    assert result["next_page_token"] == "tok123"


@pytest.mark.asyncio
async def test_search_places_api_error(places_client):
    """search_places devuelve listas vacías cuando la API da error."""
    mock_response = MagicMock()
    mock_response.status_code = 403
    mock_response.text = "Forbidden"
    with patch("httpx.AsyncClient.post", return_value=mock_response):
        result = await places_client.search_places("pizza Madrid")
    assert result == {"places": [], "next_page_token": None}


@pytest.mark.asyncio
async def test_search_places_con_filtros(places_client):
    """search_places envía los filtros de precio y open_now correctamente."""
    mock_response = MagicMock()
    mock_response.status_code = 200
    mock_response.json.return_value = {"places": []}
    with patch("httpx.AsyncClient.post", return_value=mock_response) as mock_post:
        await places_client.search_places(
            "tapas", price_levels=["PRICE_LEVEL_INEXPENSIVE"], open_now=True
        )
    _, kwargs = mock_post.call_args
    payload = kwargs["json"]
    assert payload["priceLevels"] == ["PRICE_LEVEL_INEXPENSIVE"]
    assert payload["openNow"] is True


@pytest.mark.asyncio
async def test_get_place_details_ok(places_client):
    """get_place_details devuelve el JSON de Google Places correctamente."""
    mock_response = MagicMock()
    mock_response.status_code = 200
    mock_response.json.return_value = {"id": "pid1", "displayName": {"text": "Lugar"}}
    with patch("httpx.AsyncClient.get", return_value=mock_response):
        result = await places_client.get_place_details("pid1")
    assert result["id"] == "pid1"


@pytest.mark.asyncio
async def test_get_place_details_no_encontrado(places_client):
    """get_place_details devuelve None cuando el lugar no existe."""
    mock_response = MagicMock()
    mock_response.status_code = 404
    with patch("httpx.AsyncClient.get", return_value=mock_response):
        result = await places_client.get_place_details("pid_inexistente")
    assert result is None


# ── KerasApiClient ────────────────────────────────────────────────────────────

@pytest.fixture
def keras_client():
    return KerasApiClient()


@pytest.mark.asyncio
async def test_get_restaurants_info_ok(keras_client):
    """get_restaurants_info devuelve el dict de info correctamente."""
    mock_response = MagicMock()
    mock_response.status_code = 200
    mock_response.json.return_value = {
        "info": {"p1": {"types": ["restaurant"], "price_level": 2}}
    }
    with patch("httpx.AsyncClient.post", return_value=mock_response):
        result = await keras_client.get_restaurants_info(["p1"])
    assert "p1" in result
    assert result["p1"]["price_level"] == 2


@pytest.mark.asyncio
async def test_get_restaurants_info_error(keras_client):
    """get_restaurants_info devuelve dict vacío si hay error de red."""
    with patch("httpx.AsyncClient.post", side_effect=Exception("connection error")):
        result = await keras_client.get_restaurants_info(["p1"])
    assert result == {}


@pytest.mark.asyncio
async def test_get_predictions_ok(keras_client):
    """get_predictions devuelve mapping place_id -> predicted_rating."""
    mock_response = MagicMock()
    mock_response.status_code = 200
    mock_response.json.return_value = {
        "results": [
            {"place_id": "p1", "keras_score": 0.8, "predicted_rating": 4.2},
            {"place_id": "p2", "keras_score": 0.6, "predicted_rating": 3.4},
        ]
    }
    with patch("httpx.AsyncClient.post", return_value=mock_response):
        result = await keras_client.get_predictions({"user_id": "u1", "candidates": []})
    assert result["p1"] == pytest.approx(4.2)
    assert result["p2"] == pytest.approx(3.4)


@pytest.mark.asyncio
async def test_get_predictions_error(keras_client):
    """get_predictions devuelve dict vacío si hay error de red."""
    with patch("httpx.AsyncClient.post", side_effect=Exception("timeout")):
        result = await keras_client.get_predictions({"user_id": "u1", "candidates": []})
    assert result == {}


# ── initialize_db ─────────────────────────────────────────────────────────────

def test_init_db_crea_tablas_cuando_no_existen():
    """init_db devuelve True y llama a create_all cuando no hay tablas."""
    from app.initialize_db import init_db

    mock_inspector = MagicMock()
    mock_inspector.get_table_names.return_value = []

    mock_metadata = MagicMock()

    with patch("app.initialize_db.inspect", return_value=mock_inspector), \
         patch("app.initialize_db.Base") as mock_base:
        mock_base.metadata = mock_metadata
        result = init_db()

    assert result is True
    mock_metadata.create_all.assert_called_once()


def test_init_db_omite_creacion_cuando_ya_existen_tablas():
    """init_db devuelve False y NO llama a create_all cuando ya hay tablas."""
    from app.initialize_db import init_db

    mock_inspector = MagicMock()
    mock_inspector.get_table_names.return_value = ["usuarios", "restaurantes"]

    mock_metadata = MagicMock()

    with patch("app.initialize_db.inspect", return_value=mock_inspector), \
         patch("app.initialize_db.Base") as mock_base:
        mock_base.metadata = mock_metadata
        result = init_db()

    assert result is False
    mock_metadata.create_all.assert_not_called()


def test_init_db_llama_a_inspect_con_el_engine():
    """init_db pasa el engine de la BD al inspector de SQLAlchemy."""
    from app.initialize_db import init_db, engine

    mock_inspector = MagicMock()
    mock_inspector.get_table_names.return_value = ["some_table"]

    with patch("app.initialize_db.inspect", return_value=mock_inspector) as mock_inspect, \
         patch("app.initialize_db.Base"):
        init_db()

    mock_inspect.assert_called_once_with(engine)

