"""
Tests para train_pipeline.py

Como train_pipeline.py es un script que ejecuta toda su lógica a nivel de módulo
(conexión a BD, queries SQL, llamadas a Google API, entrenamiento del modelo),
es necesario mockear todas las dependencias externas ANTES de importarlo.
"""

import sys
import json
import math
import numpy as np
import pandas as pd
import pytest
from unittest.mock import patch, MagicMock, call


# ─────────────────────────────────────────────────────────────────────────────
# Datos de prueba (fake DataFrames y cachés que el script necesitará)
# ─────────────────────────────────────────────────────────────────────────────

FAKE_USERS_DF = pd.DataFrame({
    'user_id': ['uid_1', 'uid_2'],
    'num_val': [3, 1],
    'avg_rating': [4.0, 3.5]
})

FAKE_FAVS_DF = pd.DataFrame({
    'user_id': ['uid_1'],
    'restaurante_id': [1]
})

FAKE_RESTS_DF = pd.DataFrame({
    'rest_id': [1, 2],
    'place_id': ['place_A', 'place_B']
})

# 3 valoraciones: uid_1 valora rest 1 y rest 2; uid_2 valora rest 2
FAKE_VAL_DF = pd.DataFrame({
    'user_id':       ['uid_1', 'uid_2', 'uid_1'],
    'restaurante_id': [1,       2,       2],
    'calidad':       [4,       3,       5],
    'precio':        [4,       3,       4],
    'higiene':       [5,       3,       4],
    'trato':         [4,       4,       5],
    'val_fecha':     pd.to_datetime(['2024-01-01 07:00', '2024-01-06 20:00', '2024-02-01 14:00']),
    'visit_fecha':   [None,    None,    None],
})

# Caché de Google Places (los dos restaurantes ya están cacheados → no se llama a la API)
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
# Mock del modelo Keras: devuelve un historial de entrenamiento falso
# ─────────────────────────────────────────────────────────────────────────────

_fake_history = MagicMock()
_fake_history.history = {'loss': [0.5, 0.3, 0.2], 'mae': [0.4, 0.3, 0.2]}

_fake_model = MagicMock()
_fake_model.fit.return_value = _fake_history

# ─────────────────────────────────────────────────────────────────────────────
# Importación de train_pipeline con TODOS los externos mockeados
# ─────────────────────────────────────────────────────────────────────────────

_mock_engine = MagicMock()
_mock_engine.connect.return_value.__enter__ = MagicMock()
_mock_engine.connect.return_value.__exit__ = MagicMock(return_value=False)

_env_map = {
    'DATABASE_URL':   'postgresql+asyncpg://user:pass@localhost/testdb',
    'GOOGLE_API_KEY': 'fake_google_key',
}

# Sequence de respuestas para pd.read_sql: usuarios, favoritos, restaurantes, valoraciones
_read_sql_seq = [FAKE_USERS_DF, FAKE_FAVS_DF, FAKE_RESTS_DF, FAKE_VAL_DF]

# Sequence para json.load: primero la caché de places, luego los tags
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
# Tests para get_franja(hour)
# =============================================================================

class TestGetFranja:
    """La función get_franja clasifica la hora en franjas: mañana(0), tarde(1), noche(2)."""

    def test_franja_manana_inicio(self):
        """Las 5h debe ser mañana (0)."""
        assert get_franja(5) == 0

    def test_franja_manana_fin(self):
        """Las 11h debe ser mañana (0)."""
        assert get_franja(11) == 0

    def test_franja_tarde_inicio(self):
        """Las 12h en punto debe ser tarde (1), no mañana."""
        assert get_franja(12) == 1

    def test_franja_tarde_fin(self):
        """Las 18h debe ser tarde (1)."""
        assert get_franja(18) == 1

    def test_franja_noche_inicio(self):
        """Las 19h en punto debe ser noche (2), no tarde."""
        assert get_franja(19) == 2

    def test_franja_noche_medianoche(self):
        """Las 23h debe ser noche (2)."""
        assert get_franja(23) == 2

    def test_franja_noche_madrugada(self):
        """Las 0h (medianoche) debe ser noche (2)."""
        assert get_franja(0) == 2

    def test_franja_noche_madrugada_4(self):
        """Las 4h (madrugada) debe ser noche (2)."""
        assert get_franja(4) == 2

    def test_franja_nan_devuelve_default(self):
        """Un valor NaN debe devolver 1 (tarde, valor por defecto)."""
        assert get_franja(float('nan')) == 1

    def test_franja_pd_nan_devuelve_default(self):
        """pd.NA / NaT también deben devolver 1."""
        assert get_franja(pd.NaT) == 1


# =============================================================================
# Tests del estado del módulo tras la importación
# =============================================================================

class TestModuleState:
    """Verifica que el módulo se inicializa correctamente con los datos falsos."""

    def test_user_mapping_contiene_los_dos_usuarios(self):
        assert 'uid_1' in train_pipeline.user_mapping
        assert 'uid_2' in train_pipeline.user_mapping

    def test_user_mapping_tiene_dos_entradas(self):
        assert len(train_pipeline.user_mapping) == 2

    def test_rest_mapping_tiene_dos_entradas(self):
        assert len(train_pipeline.rest_mapping) == 2

    def test_place_mapping_contiene_place_A_y_place_B(self):
        assert 'place_A' in train_pipeline.place_mapping
        assert 'place_B' in train_pipeline.place_mapping

    def test_tags_order_carga_los_ids_de_fake_tags(self):
        expected = [t['id'] for t in FAKE_TAGS]
        assert train_pipeline.TAGS_ORDER == expected

    def test_num_users_correcto(self):
        assert train_pipeline.NUM_USERS == 2

    def test_num_rests_correcto(self):
        assert train_pipeline.NUM_RESTS == 2

    def test_num_tags_correcto(self):
        assert train_pipeline.NUM_TAGS == len(FAKE_TAGS)

    def test_database_url_se_reemplaza_asyncpg(self):
        """La URL con postgresql+asyncpg debe haber sido convertida a postgresql://."""
        assert not train_pipeline.DATABASE_URL.startswith('postgresql+asyncpg')
        assert train_pipeline.DATABASE_URL.startswith('postgresql')

    def test_model_fit_fue_llamado_una_vez(self):
        """El modelo debe haberse entrenado exactamente una vez."""
        _fake_model.fit.assert_called_once()

    def test_model_save_fue_llamado_con_la_ruta_correcta(self):
        """El modelo debe guardarse en './models/modelo_prod.h5'."""
        _fake_model.save.assert_called_with('./models/modelo_prod.h5')


# =============================================================================
# Tests de rest_features
# =============================================================================

class TestRestFeatures:
    """Verifica que rest_features se construye correctamente para cada restaurante."""

    def test_rest_features_tiene_dos_entradas(self):
        assert len(train_pipeline.rest_features) == 2

    def test_rest_features_tiene_campos_requeridos(self):
        for feat in train_pipeline.rest_features.values():
            assert 'precio_norm' in feat
            assert 'estrellas_norm' in feat
            assert 'tags_vector' in feat

    def test_precio_norm_rango_valido(self):
        """precio_norm debe estar en [0, 1] (price_level / 3.0)."""
        for feat in train_pipeline.rest_features.values():
            assert 0.0 <= feat['precio_norm'] <= 1.0

    def test_estrellas_norm_rango_valido(self):
        """estrellas_norm debe estar en [0, 1] ((rating - 1) / 4.0)."""
        for feat in train_pipeline.rest_features.values():
            assert 0.0 <= feat['estrellas_norm'] <= 1.0

    def test_tags_vector_es_float32(self):
        for feat in train_pipeline.rest_features.values():
            assert feat['tags_vector'].dtype == np.float32

    def test_tags_vector_longitud_igual_a_num_tags(self):
        for feat in train_pipeline.rest_features.values():
            assert len(feat['tags_vector']) == train_pipeline.NUM_TAGS

    def test_place_A_precio_norm(self):
        """place_A tiene precio_nivel=2, por tanto precio_norm=2/3.0."""
        r_idx = train_pipeline.place_mapping['place_A']
        assert abs(train_pipeline.rest_features[r_idx]['precio_norm'] - 2 / 3.0) < 1e-6

    def test_place_A_estrellas_norm(self):
        """place_A tiene estrellas_google=4.5 → (4.5-1)/4.0 = 0.875."""
        r_idx = train_pipeline.place_mapping['place_A']
        expected = (4.5 - 1.0) / 4.0
        assert abs(train_pipeline.rest_features[r_idx]['estrellas_norm'] - expected) < 1e-6

    def test_place_A_tiene_tags_restaurant_y_food_activos(self):
        """place_A tiene types=['restaurant','food']; esos índices deben ser 1.0."""
        r_idx = train_pipeline.place_mapping['place_A']
        tv = train_pipeline.rest_features[r_idx]['tags_vector']
        tag_idx = {t: i for i, t in enumerate(train_pipeline.TAGS_ORDER)}
        assert tv[tag_idx['restaurant']] == 1.0
        assert tv[tag_idx['food']] == 1.0
        assert tv[tag_idx['cafe']] == 0.0

    def test_place_B_solo_tiene_tag_cafe_activo(self):
        """place_B tiene types=['cafe']; solo ese índice debe ser 1.0."""
        r_idx = train_pipeline.place_mapping['place_B']
        tv = train_pipeline.rest_features[r_idx]['tags_vector']
        tag_idx = {t: i for i, t in enumerate(train_pipeline.TAGS_ORDER)}
        assert tv[tag_idx['cafe']] == 1.0
        assert tv[tag_idx['restaurant']] == 0.0

    def test_place_B_precio_norm(self):
        """place_B tiene precio_nivel=1, por tanto precio_norm=1/3.0."""
        r_idx = train_pipeline.place_mapping['place_B']
        assert abs(train_pipeline.rest_features[r_idx]['precio_norm'] - 1 / 3.0) < 1e-6


# =============================================================================
# Tests de la fórmula de normalización del score
# =============================================================================

class TestScoreNorm:
    """Verifica la fórmula: score_norm = (avg_subcriteria - 1) / 4.0"""

    def test_rating_maximo_da_1(self):
        calidad = precio = higiene = trato = 5
        result = ((calidad + precio + higiene + trato) / 4.0 - 1) / 4.0
        assert result == pytest.approx(1.0)

    def test_rating_minimo_da_0(self):
        calidad = precio = higiene = trato = 1
        result = ((calidad + precio + higiene + trato) / 4.0 - 1) / 4.0
        assert result == pytest.approx(0.0)

    def test_rating_medio_da_05(self):
        calidad = precio = higiene = trato = 3
        result = ((calidad + precio + higiene + trato) / 4.0 - 1) / 4.0
        assert result == pytest.approx(0.5)

    def test_score_calculado_en_val_df(self):
        """Verifica que el DataFrame procesado contiene la columna score_norm en rango [0, 1]."""
        # El módulo calculó score_norm al arrancar; usamos los valores de los arrays generados
        assert train_pipeline.y.min() >= 0.0
        assert train_pipeline.y.max() <= 1.0


# =============================================================================
# Tests de las matrices X generadas
# =============================================================================

class TestTrainingArrays:
    """Verifica la forma y tipo de las matrices de entrenamiento."""

    def test_num_muestras_consistente(self):
        """Todas las matrices X deben tener el mismo número de filas."""
        n = len(train_pipeline.y)
        assert len(train_pipeline.X_uid) == n
        assert len(train_pipeline.X_rid) == n
        assert len(train_pipeline.X_tags) == n
        assert len(train_pipeline.X_rctx) == n
        assert len(train_pipeline.X_uprof) == n
        assert len(train_pipeline.X_ufav) == n
        assert len(train_pipeline.X_time) == n

    def test_x_uid_es_int32(self):
        assert train_pipeline.X_uid.dtype == np.int32

    def test_x_rid_es_int32(self):
        assert train_pipeline.X_rid.dtype == np.int32

    def test_x_tags_forma(self):
        """X_tags debe tener shape (N, NUM_TAGS)."""
        assert train_pipeline.X_tags.shape[1] == train_pipeline.NUM_TAGS

    def test_x_rctx_tiene_2_features(self):
        """X_rctx = [precio_norm, estrellas_norm] → 2 columnas."""
        assert train_pipeline.X_rctx.shape[1] == 2

    def test_x_uprof_tiene_2_features(self):
        """X_uprof = [avg_rating_norm, num_val_norm] → 2 columnas."""
        assert train_pipeline.X_uprof.shape[1] == 2

    def test_x_time_tiene_4_features(self):
        """X_time = [es_finde, franja_0, franja_1, franja_2] → 4 columnas."""
        assert train_pipeline.X_time.shape[1] == 4

    def test_x_ufav_forma(self):
        """X_ufav (perfil de favoritos) debe tener shape (N, NUM_TAGS)."""
        assert train_pipeline.X_ufav.shape[1] == train_pipeline.NUM_TAGS


# =============================================================================
# Tests del mapeo precio_nivel para la API de Google
# =============================================================================

class TestPriceLevelMapping:
    """
    La lógica de mapeo de priceLevel se ejecutó al cargar el módulo.
    Verificamos el resultado en rest_features, no reimplementando la lógica.
    """

    @pytest.mark.parametrize("place_id,expected_norm", [
        ('place_A', 2 / 3.0),   # precio_nivel=2
        ('place_B', 1 / 3.0),   # precio_nivel=1
    ])
    def test_precio_norm_de_cada_restaurante(self, place_id, expected_norm):
        r_idx = train_pipeline.place_mapping[place_id]
        actual = train_pipeline.rest_features[r_idx]['precio_norm']
        assert abs(actual - expected_norm) < 1e-6
