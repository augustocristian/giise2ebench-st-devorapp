import pytest
from fastapi.testclient import TestClient
import numpy as np
from unittest.mock import patch, MagicMock

# Avoid loading the real model during tests if it exists
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
    """Simulate model.predict() output by returning an (N, 1) array."""
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
    """Inject mocked globals for all tests."""
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
    # Without an API key
    response = client.post("/predict", json=payload)
    assert response.status_code == 403
    assert response.json()["detail"] == "Clave de API no válida"

    # With a wrong API key
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
    """If the model is not loaded, /predict must return 503."""
    main.model = None
    resp = client.post("/predict", headers={"x-api-key": "test-api-key"}, json=PREDICT_PAYLOAD)
    assert resp.status_code == 503


def test_predict_empty_candidates():
    payload = {**PREDICT_PAYLOAD, "candidates": []}
    response = client.post("/predict", json=payload, headers={"x-api-key": "test-api-key"})
    assert response.status_code == 200
    assert response.json() == {"results": []}


def test_predict_missing_fields():
    """An incomplete payload must return 422 from Pydantic validation."""
    payload = {
        "user_id": "test_user",
        "avg_rating": 4.5,
        "num_val": 10,
        "user_favs": [],
        "candidates": []
        # es_finde and franja are missing
    }
    response = client.post("/predict", json=payload, headers={"x-api-key": "test-api-key"})
    assert response.status_code == 422


def test_predict_ok_and_sorted():
    """Candidates must be sorted by keras_score, highest first."""
    # Scores: place_A=0.6, place_B=0.9 -> place_B first
    main.model = make_fake_model([0.6, 0.9])
    resp = client.post("/predict", headers={"x-api-key": "test-api-key"}, json=PREDICT_PAYLOAD)
    assert resp.status_code == 200
    results = resp.json()["results"]
    assert len(results) == 2
    assert results[0]["place_id"] == "place_B"
    assert results[1]["place_id"] == "place_A"
    assert results[0]["keras_score"] > results[1]["keras_score"]


def test_predict_unknown_user_uses_idx_0():
    """A user_id missing from user_mapping must use idx=0 without error."""
    main.model = make_fake_model([0.5, 0.5])
    main.user_mapping = {}  # Without mappings
    resp = client.post("/predict", headers={"x-api-key": "test-api-key"}, json=PREDICT_PAYLOAD)
    assert resp.status_code == 200


def test_predict_favorites_in_cache():
    """Favorites in places_cache must contribute to the user's fav vector."""
    main.model = make_fake_model([0.5, 0.5])
    main.places_cache = {"fav_place": {"types": ["restaurant"], "price_level": 1}}
    payload = {**PREDICT_PAYLOAD, "user_favs": ["fav_place"]}
    resp = client.post("/predict", headers={"x-api-key": "test-api-key"}, json=payload)
    assert resp.status_code == 200
    assert len(resp.json()["results"]) == 2


def test_predict_favorites_not_in_cache():
    """Favorites not in places_cache must be ignored (fav_vector = zeros)."""
    main.model = make_fake_model([0.5, 0.5])
    main.places_cache = {}
    payload = {**PREDICT_PAYLOAD, "user_favs": ["no_existe"]}
    resp = client.post("/predict", headers={"x-api-key": "test-api-key"}, json=payload)
    assert resp.status_code == 200


# ── extract_tags_vector ───────────────────────────────────────────────────────

def test_extract_tags_vector_known_types():
    """Types present in TAGS_ORDER must set the matching bit."""
    main.TAGS_ORDER = ["restaurant", "cafe", "bar"]
    main.NUM_TAGS = 3
    main.tag_to_idx = {t: i for i, t in enumerate(main.TAGS_ORDER)}
    vec = extract_tags_vector(["cafe"])
    assert vec[1] == 1.0
    assert vec[0] == 0.0
    assert vec[2] == 0.0


def test_extract_tags_vector_unknown_types():
    """Unrecognized types must set the 'restaurant' fallback if it exists."""
    main.TAGS_ORDER = ["restaurant", "cafe"]
    main.NUM_TAGS = 2
    main.tag_to_idx = {t: i for i, t in enumerate(main.TAGS_ORDER)}
    vec = extract_tags_vector(["alien_food"])
    # Fallback: 'restaurant' must be set
    assert vec[0] == 1.0


def test_extract_tags_vector_empty():
    """Without types, the 'restaurant' fallback must be set."""
    main.TAGS_ORDER = ["restaurant", "cafe"]
    main.NUM_TAGS = 2
    main.tag_to_idx = {t: i for i, t in enumerate(main.TAGS_ORDER)}
    vec = extract_tags_vector([])
    assert vec[0] == 1.0  # fallback restaurant


def test_extract_tags_vector_multiple():
    """With multiple recognized types, all must be set."""
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


def test_info_all_unknown():
    """If no place_id is in the cache, /info returns an empty dict."""
    main.places_cache = {}
    resp = client.post("/info", headers={"x-api-key": "test-api-key"}, json={"place_ids": ["unknown"]})
    assert resp.status_code == 200
    assert resp.json()["info"] == {}
