import pytest
from fastapi.testclient import TestClient
import numpy as np
from unittest.mock import patch, MagicMock

# Evitar que se cargue el modelo real durante los tests si existe
with patch("tensorflow.keras.models.load_model") as mock_load:
    _mock_model_init = MagicMock()
    _mock_model_init.inputs = [MagicMock(name="input", shape=(None, 10)) for _ in range(7)]
    _mock_model_init.inputs[2].name = "tags"
    _mock_model_init.inputs[2].shape = (None, 5)
    mock_load.return_value = _mock_model_init

    import main
    from main import app, extract_tags_vector, API_KEY_SECRET

client = TestClient(app)
api_headers = {"x-api-key": API_KEY_SECRET if API_KEY_SECRET else "test-api-key"}

PREDICT_PAYLOAD = {
    "user_id": "user123",
    "avg_rating": 4.0,
    "num_val": 5,
    "user_favs": [],
    "es_finde": 0,
    "franja": 1,
    "candidates": [
        {"place_id": "place_A", "price_level": 2, "rating": 4.5, "types": ["restaurant"]},
        {"place_id": "place_B", "price_level": 1, "rating": 3.8, "types": ["cafe"]}
    ]
}


class FakeModelOutput:
    """Simula la salida de model.predict() retornando un array (N, 1)."""
    def __init__(self, values):
        self._values = np.array([[v] for v in values])

    def __getitem__(self, idx):
        return self._values[idx]

    def __len__(self):
        return len(self._values)


def make_fake_model(scores):
    m = MagicMock()
    m.predict.return_value = FakeModelOutput(scores)
    tag_input = MagicMock()
    tag_input.name = "tags_input"
    tag_input.shape = [None, main.NUM_TAGS]
    m.inputs = [tag_input]
    return m


@pytest.fixture(autouse=True)
def setup_mocks():
    """Inyectar variables globales simuladas para todos los tests."""
    main.model = make_fake_model([0.8, 0.6])
    main.API_KEY_SECRET = "test-api-key"
    main.user_mapping = {"test_user": 1}
    main.place_mapping = {"test_place": 1}
    main.places_cache = {"fav_place_1": {"types": ["restaurant"], "price_level": 2}}
    main.TAGS_ORDER = ["restaurant", "bar", "cafe", "pizza", "burger"]
    main.NUM_TAGS = 5
    main.tag_to_idx = {tag: i for i, tag in enumerate(main.TAGS_ORDER)}


# ── Health check ─────────────────────────────────────────────────────────────

def test_health_check():
    response = client.get("/")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "ok"
    assert "model_loaded" in data
    assert "num_tags" in data


# ── API key auth ──────────────────────────────────────────────────────────────

def test_predict_unauthorized():
    payload = {**PREDICT_PAYLOAD, "candidates": []}
    # Sin API Key
    response = client.post("/predict", json=payload)
    assert response.status_code == 403
    assert response.json()["detail"] == "Clave de API no válida"

    # Con API Key incorrecta
    response = client.post("/predict", json=payload, headers={"x-api-key": "wrong-key"})
    assert response.status_code == 403


# ── /predict endpoint ─────────────────────────────────────────────────────────

def test_predict_success():
    payload = {
        "user_id": "test_user",
        "avg_rating": 4.5,
        "num_val": 10,
        "user_favs": ["fav_place_1"],
        "es_finde": 1,
        "franja": 2,
        "candidates": [
            {"place_id": "cand_1", "price_level": 2, "rating": 4.0, "types": ["restaurant", "bar"]},
            {"place_id": "cand_2", "price_level": 3, "rating": 3.5, "types": ["cafe"]}
        ]
    }

    response = client.post("/predict", json=payload, headers={"x-api-key": "test-api-key"})
    assert response.status_code == 200
    data = response.json()
    assert "results" in data
    assert len(data["results"]) == 2

    res1 = data["results"][0]
    assert "place_id" in res1
    assert "keras_score" in res1
    assert "predicted_rating" in res1


def test_predict_model_none():
    """Si el modelo no está cargado, /predict debe devolver 503."""
    main.model = None
    resp = client.post("/predict", headers={"x-api-key": "test-api-key"}, json=PREDICT_PAYLOAD)
    assert resp.status_code == 503


def test_predict_empty_candidates():
    payload = {**PREDICT_PAYLOAD, "candidates": []}
    response = client.post("/predict", json=payload, headers={"x-api-key": "test-api-key"})
    assert response.status_code == 200
    assert response.json() == {"results": []}


def test_predict_missing_fields():
    """Payload incompleto debe devolver 422 por validación Pydantic."""
    payload = {
        "user_id": "test_user",
        "avg_rating": 4.5,
        "num_val": 10,
        "user_favs": [],
        "candidates": []
        # Faltan es_finde y franja
    }
    response = client.post("/predict", json=payload, headers={"x-api-key": "test-api-key"})
    assert response.status_code == 422


def test_predict_ok_y_ordenado():
    """Los candidatos deben estar ordenados de mayor a menor keras_score."""
    # Scores: place_A=0.6, place_B=0.9 → place_B primero
    main.model = make_fake_model([0.6, 0.9])
    resp = client.post("/predict", headers={"x-api-key": "test-api-key"}, json=PREDICT_PAYLOAD)
    assert resp.status_code == 200
    results = resp.json()["results"]
    assert len(results) == 2
    assert results[0]["place_id"] == "place_B"
    assert results[1]["place_id"] == "place_A"
    assert results[0]["keras_score"] > results[1]["keras_score"]


def test_predict_usuario_desconocido_usa_idx_0():
    """Un user_id que no está en user_mapping debe usar idx=0 sin error."""
    main.model = make_fake_model([0.5, 0.5])
    main.user_mapping = {}  # Sin mapeos
    resp = client.post("/predict", headers={"x-api-key": "test-api-key"}, json=PREDICT_PAYLOAD)
    assert resp.status_code == 200


def test_predict_favoritos_en_cache():
    """Favoritos en places_cache deben contribuir al vector fav del usuario."""
    main.model = make_fake_model([0.5, 0.5])
    main.places_cache = {"fav_place": {"types": ["restaurant"], "price_level": 1}}
    payload = {**PREDICT_PAYLOAD, "user_favs": ["fav_place"]}
    resp = client.post("/predict", headers={"x-api-key": "test-api-key"}, json=payload)
    assert resp.status_code == 200
    assert len(resp.json()["results"]) == 2


def test_predict_favoritos_no_en_cache():
    """Favoritos no en places_cache deben ser ignorados (fav_vector = zeros)."""
    main.model = make_fake_model([0.5, 0.5])
    main.places_cache = {}
    payload = {**PREDICT_PAYLOAD, "user_favs": ["no_existe"]}
    resp = client.post("/predict", headers={"x-api-key": "test-api-key"}, json=payload)
    assert resp.status_code == 200


# ── extract_tags_vector ───────────────────────────────────────────────────────

def test_extract_tags_vector_tipos_conocidos():
    """Tipos presentes en TAGS_ORDER deben activar el bit correspondiente."""
    main.TAGS_ORDER = ["restaurant", "cafe", "bar"]
    main.NUM_TAGS = 3
    main.tag_to_idx = {t: i for i, t in enumerate(main.TAGS_ORDER)}
    vec = extract_tags_vector(["cafe"])
    assert vec[1] == 1.0
    assert vec[0] == 0.0
    assert vec[2] == 0.0


def test_extract_tags_vector_tipos_desconocidos():
    """Tipos no reconocidos deben activar el fallback 'restaurant' si existe."""
    main.TAGS_ORDER = ["restaurant", "cafe"]
    main.NUM_TAGS = 2
    main.tag_to_idx = {t: i for i, t in enumerate(main.TAGS_ORDER)}
    vec = extract_tags_vector(["alien_food"])
    # Fallback: 'restaurant' debe activarse
    assert vec[0] == 1.0


def test_extract_tags_vector_vacio():
    """Sin tipos, el fallback 'restaurant' debe activarse."""
    main.TAGS_ORDER = ["restaurant", "cafe"]
    main.NUM_TAGS = 2
    main.tag_to_idx = {t: i for i, t in enumerate(main.TAGS_ORDER)}
    vec = extract_tags_vector([])
    assert vec[0] == 1.0  # fallback restaurant


def test_extract_tags_vector_multiples():
    """Con múltiples tipos reconocidos deben activarse todos."""
    main.TAGS_ORDER = ["restaurant", "cafe", "bar"]
    main.NUM_TAGS = 3
    main.tag_to_idx = {t: i for i, t in enumerate(main.TAGS_ORDER)}
    vec = extract_tags_vector(["restaurant", "bar"])
    assert vec[0] == 1.0
    assert vec[1] == 0.0
    assert vec[2] == 1.0


# ── /info endpoint ─────────────────────────────────────────────────────────────

def test_get_place_info():
    payload = {"place_ids": ["fav_place_1", "unknown_place"]}
    response = client.post("/info", json=payload, headers={"x-api-key": "test-api-key"})
    assert response.status_code == 200
    data = response.json()
    assert "info" in data
    assert "fav_place_1" in data["info"]
    assert "unknown_place" not in data["info"]
    assert data["info"]["fav_place_1"]["types"] == ["restaurant"]
    assert data["info"]["fav_place_1"]["price_level"] == 2


def test_info_todos_desconocidos():
    """Si ningún place_id está en cache, /info devuelve dict vacío."""
    main.places_cache = {}
    resp = client.post("/info", headers={"x-api-key": "test-api-key"}, json={"place_ids": ["unknown"]})
    assert resp.status_code == 200
    assert resp.json()["info"] == {}
