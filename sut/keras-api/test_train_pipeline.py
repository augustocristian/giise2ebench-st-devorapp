"""
Tests for train_pipeline.py

Since train_pipeline.py is a script that runs all its logic at module level
(DB connection, SQL queries, Google API calls, model training),
all external dependencies must be mocked BEFORE importing it.
"""

import sys
import json
import math
import numpy as np
import pandas as pd
import pytest
from unittest.mock import patch, MagicMock, call


# ─────────────────────────────────────────────────────────────────────────────
# Test data (fake DataFrames and caches the script will need)
# ─────────────────────────────────────────────────────────────────────────────

FAKE_USERS_DF = pd.DataFrame({
    'user_id': ['uid_1', 'uid_2'],
    'num_val': [3, 1],
    'avg_rating': [4.0, 3.5]
})

FAKE_FAVS_DF = pd.DataFrame({
    'user_id': ['uid_1'],
    'restaurant_id': [1]
})

FAKE_RESTS_DF = pd.DataFrame({
    'rest_id': [1, 2],
    'place_id': ['place_A', 'place_B']
})

# 3 ratings: uid_1 rates rest 1 and rest 2; uid_2 rates rest 2
FAKE_VAL_DF = pd.DataFrame({
    'user_id':       ['uid_1', 'uid_2', 'uid_1'],
    'restaurant_id': [1,       2,       2],
    'quality':        [4,       3,       5],
    'price':         [4,       3,       4],
    'hygiene':        [5,       3,       4],
    'service':        [4,       4,       5],
    'val_date':      pd.to_datetime(['2024-01-01 07:00', '2024-01-06 20:00', '2024-02-01 14:00']),
    'visit_date':    [None,    None,    None],
})

# Google Places cache (both restaurants already cached -> the API is not called)
FAKE_PLACES_CACHE = {
    'place_A': {
        'precio_nivel':    2,
        'estrellas_google': 4.5,
        'types':           ['restaurant', 'food'],
    },
    'place_B': {
        'precio_nivel':    1,
        'estrellas_google': 3.8,
        'types':           ['cafe'],
    },
}

FAKE_TAGS = [
    {'id': 'restaurant'},
    {'id': 'cafe'},
    {'id': 'bar'},
    {'id': 'food'},
    {'id': 'bakery'},
]

# ─────────────────────────────────────────────────────────────────────────────
# Keras model mock: returns a fake training history
# ─────────────────────────────────────────────────────────────────────────────

_fake_history = MagicMock()
_fake_history.history = {'loss': [0.5, 0.3, 0.2], 'mae': [0.4, 0.3, 0.2]}

_fake_model = MagicMock()
_fake_model.fit.return_value = _fake_history

# ─────────────────────────────────────────────────────────────────────────────
# Import train_pipeline with ALL externals mocked
# ─────────────────────────────────────────────────────────────────────────────

_mock_engine = MagicMock()
_mock_engine.connect.return_value.__enter__ = MagicMock()
_mock_engine.connect.return_value.__exit__ = MagicMock(return_value=False)

_env_map = {
    'DATABASE_URL':   'postgresql+asyncpg://user:pass@localhost/testdb',
    'GOOGLE_API_KEY': 'fake_google_key',
}

# Response sequence for pd.read_sql: users, favorites, restaurants, ratings
_read_sql_seq = [FAKE_USERS_DF, FAKE_FAVS_DF, FAKE_RESTS_DF, FAKE_VAL_DF]

# Sequence for json.load: first the places cache, then the tags
_json_load_seq = [FAKE_PLACES_CACHE, FAKE_TAGS]

with patch('dotenv.load_dotenv'), \
     patch('os.getenv', side_effect=lambda k, d=None: _env_map.get(k, d)), \
     patch('sqlalchemy.create_engine', return_value=_mock_engine), \
     patch('pandas.read_sql', side_effect=_read_sql_seq), \
     patch('os.path.exists', return_value=True), \
     patch('builtins.open', MagicMock()), \
     patch('json.load', side_effect=_json_load_seq), \
     patch('json.dump'), \
     patch('os.makedirs'), \
     patch('requests.get', return_value=MagicMock(status_code=200, json=MagicMock(return_value={}))), \
     patch('tensorflow.keras.models.Model', return_value=_fake_model):

    import train_pipeline
    from train_pipeline import get_franja


# =============================================================================
# Tests for get_franja(hour)
# =============================================================================

class TestGetFranja:
    """get_franja classifies the hour into slots: morning(0), afternoon(1), night(2)."""

    def test_franja_morning_start(self):
        """5h must be morning (0)."""
        assert get_franja(5) == 0

    def test_franja_morning_end(self):
        """11h must be morning (0)."""
        assert get_franja(11) == 0

    def test_franja_afternoon_start(self):
        """12h sharp must be afternoon (1), not morning."""
        assert get_franja(12) == 1

    def test_franja_afternoon_end(self):
        """18h must be afternoon (1)."""
        assert get_franja(18) == 1

    def test_franja_night_start(self):
        """19h sharp must be night (2), not afternoon."""
        assert get_franja(19) == 2

    def test_franja_night_midnight(self):
        """23h must be night (2)."""
        assert get_franja(23) == 2

    def test_franja_night_early_morning(self):
        """0h (midnight) must be night (2)."""
        assert get_franja(0) == 2

    def test_franja_night_early_morning_4(self):
        """4h (early morning) must be night (2)."""
        assert get_franja(4) == 2

    def test_franja_nan_returns_default(self):
        """A NaN value must return 1 (afternoon, the default)."""
        assert get_franja(float('nan')) == 1

    def test_franja_pd_nan_returns_default(self):
        """pd.NA / NaT must also return 1."""
        assert get_franja(pd.NaT) == 1


# =============================================================================
# Tests of the module state after import
# =============================================================================

class TestModuleState:
    """Check the module initializes correctly with the fake data."""

    def test_user_mapping_contains_both_users(self):
        assert 'uid_1' in train_pipeline.user_mapping
        assert 'uid_2' in train_pipeline.user_mapping

    def test_user_mapping_has_two_entries(self):
        assert len(train_pipeline.user_mapping) == 2

    def test_rest_mapping_has_two_entries(self):
        assert len(train_pipeline.rest_mapping) == 2

    def test_place_mapping_contains_place_A_and_place_B(self):
        assert 'place_A' in train_pipeline.place_mapping
        assert 'place_B' in train_pipeline.place_mapping

    def test_tags_order_loads_fake_tag_ids(self):
        expected = [t['id'] for t in FAKE_TAGS]
        assert train_pipeline.TAGS_ORDER == expected

    def test_num_users_correct(self):
        assert train_pipeline.NUM_USERS == 2

    def test_num_rests_correct(self):
        assert train_pipeline.NUM_RESTS == 2

    def test_num_tags_correct(self):
        assert train_pipeline.NUM_TAGS == len(FAKE_TAGS)

    def test_database_url_replaces_asyncpg(self):
        """The postgresql+asyncpg URL must have been converted to postgresql://."""
        assert not train_pipeline.DATABASE_URL.startswith('postgresql+asyncpg')
        assert train_pipeline.DATABASE_URL.startswith('postgresql')

    def test_model_fit_called_once(self):
        """The model must have been trained exactly once."""
        _fake_model.fit.assert_called_once()

    def test_model_save_called_with_correct_path(self):
        """The model must be saved to './models/modelo_prod.h5'."""
        _fake_model.save.assert_called_with('./models/modelo_prod.h5')


# =============================================================================
# Tests for rest_features
# =============================================================================

class TestRestFeatures:
    """Check rest_features is built correctly for each restaurant."""

    def test_rest_features_has_two_entries(self):
        assert len(train_pipeline.rest_features) == 2

    def test_rest_features_has_required_fields(self):
        for feat in train_pipeline.rest_features.values():
            assert 'precio_norm' in feat
            assert 'estrellas_norm' in feat
            assert 'tags_vector' in feat

    def test_precio_norm_valid_range(self):
        """precio_norm must be within [0, 1] (price_level / 3.0)."""
        for feat in train_pipeline.rest_features.values():
            assert 0.0 <= feat['precio_norm'] <= 1.0

    def test_estrellas_norm_valid_range(self):
        """estrellas_norm must be within [0, 1] ((rating - 1) / 4.0)."""
        for feat in train_pipeline.rest_features.values():
            assert 0.0 <= feat['estrellas_norm'] <= 1.0

    def test_tags_vector_is_float32(self):
        for feat in train_pipeline.rest_features.values():
            assert feat['tags_vector'].dtype == np.float32

    def test_tags_vector_length_equals_num_tags(self):
        for feat in train_pipeline.rest_features.values():
            assert len(feat['tags_vector']) == train_pipeline.NUM_TAGS

    def test_place_A_precio_norm(self):
        """place_A has precio_nivel=2, so precio_norm=2/3.0."""
        r_idx = train_pipeline.place_mapping['place_A']
        assert abs(train_pipeline.rest_features[r_idx]['precio_norm'] - 2 / 3.0) < 1e-6

    def test_place_A_estrellas_norm(self):
        """place_A has estrellas_google=4.5 -> (4.5-1)/4.0 = 0.875."""
        r_idx = train_pipeline.place_mapping['place_A']
        expected = (4.5 - 1.0) / 4.0
        assert abs(train_pipeline.rest_features[r_idx]['estrellas_norm'] - expected) < 1e-6

    def test_place_A_has_restaurant_and_food_tags_active(self):
        """place_A has types=['restaurant','food']; those indices must be 1.0."""
        r_idx = train_pipeline.place_mapping['place_A']
        tv = train_pipeline.rest_features[r_idx]['tags_vector']
        tag_idx = {t: i for i, t in enumerate(train_pipeline.TAGS_ORDER)}
        assert tv[tag_idx['restaurant']] == 1.0
        assert tv[tag_idx['food']] == 1.0
        assert tv[tag_idx['cafe']] == 0.0

    def test_place_B_only_has_cafe_tag_active(self):
        """place_B has types=['cafe']; only that index must be 1.0."""
        r_idx = train_pipeline.place_mapping['place_B']
        tv = train_pipeline.rest_features[r_idx]['tags_vector']
        tag_idx = {t: i for i, t in enumerate(train_pipeline.TAGS_ORDER)}
        assert tv[tag_idx['cafe']] == 1.0
        assert tv[tag_idx['restaurant']] == 0.0

    def test_place_B_precio_norm(self):
        """place_B has precio_nivel=1, so precio_norm=1/3.0."""
        r_idx = train_pipeline.place_mapping['place_B']
        assert abs(train_pipeline.rest_features[r_idx]['precio_norm'] - 1 / 3.0) < 1e-6


# =============================================================================
# Tests for the score normalization formula
# =============================================================================

class TestScoreNorm:
    """Check the formula: score_norm = (avg_subcriteria - 1) / 4.0"""

    def test_rating_max_gives_1(self):
        quality = price = hygiene = service = 5
        result = ((quality + price + hygiene + service) / 4.0 - 1) / 4.0
        assert result == pytest.approx(1.0)

    def test_rating_min_gives_0(self):
        quality = price = hygiene = service = 1
        result = ((quality + price + hygiene + service) / 4.0 - 1) / 4.0
        assert result == pytest.approx(0.0)

    def test_rating_mid_gives_05(self):
        quality = price = hygiene = service = 3
        result = ((quality + price + hygiene + service) / 4.0 - 1) / 4.0
        assert result == pytest.approx(0.5)

    def test_score_computed_in_val_df(self):
        """Check the processed DataFrame has a score_norm column within [0, 1]."""
        # The module computed score_norm at startup; use the generated arrays' values
        assert train_pipeline.y.min() >= 0.0
        assert train_pipeline.y.max() <= 1.0


# =============================================================================
# Tests for the generated X matrices
# =============================================================================

class TestTrainingArrays:
    """Check the shape and type of the training matrices."""

    def test_num_samples_consistent(self):
        """All X matrices must have the same number of rows."""
        n = len(train_pipeline.y)
        assert len(train_pipeline.X_uid) == n
        assert len(train_pipeline.X_rid) == n
        assert len(train_pipeline.X_tags) == n
        assert len(train_pipeline.X_rctx) == n
        assert len(train_pipeline.X_uprof) == n
        assert len(train_pipeline.X_ufav) == n
        assert len(train_pipeline.X_time) == n

    def test_x_uid_is_int32(self):
        assert train_pipeline.X_uid.dtype == np.int32

    def test_x_rid_is_int32(self):
        assert train_pipeline.X_rid.dtype == np.int32

    def test_x_tags_shape(self):
        """X_tags must have shape (N, NUM_TAGS)."""
        assert train_pipeline.X_tags.shape[1] == train_pipeline.NUM_TAGS

    def test_x_rctx_has_2_features(self):
        """X_rctx = [precio_norm, estrellas_norm] -> 2 columns."""
        assert train_pipeline.X_rctx.shape[1] == 2

    def test_x_uprof_has_2_features(self):
        """X_uprof = [avg_rating_norm, num_val_norm] -> 2 columns."""
        assert train_pipeline.X_uprof.shape[1] == 2

    def test_x_time_has_4_features(self):
        """X_time = [es_finde, franja_0, franja_1, franja_2] -> 4 columns."""
        assert train_pipeline.X_time.shape[1] == 4

    def test_x_ufav_shape(self):
        """X_ufav (favorites profile) must have shape (N, NUM_TAGS)."""
        assert train_pipeline.X_ufav.shape[1] == train_pipeline.NUM_TAGS


# =============================================================================
# Tests for the precio_nivel mapping for the Google API
# =============================================================================

class TestPriceLevelMapping:
    """
    The priceLevel mapping logic ran when the module loaded.
    Check the result in rest_features instead of reimplementing the logic.
    """

    @pytest.mark.parametrize("place_id,expected_norm", [
        ('place_A', 2 / 3.0),   # precio_nivel=2
        ('place_B', 1 / 3.0),   # precio_nivel=1
    ])
    def test_precio_norm_of_each_restaurant(self, place_id, expected_norm):
        r_idx = train_pipeline.place_mapping[place_id]
        actual = train_pipeline.rest_features[r_idx]['precio_norm']
        assert abs(actual - expected_norm) < 1e-6
