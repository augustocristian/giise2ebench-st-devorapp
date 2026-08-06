import os
import json
import traceback as tb
import aiofiles
import numpy as np
import tensorflow as tf
from fastapi import FastAPI, Header, HTTPException, Depends
from pydantic import BaseModel
from typing import List, Optional
from dotenv import load_dotenv

# Directorio base = carpeta donde está este script (keras-api/)
BASE_DIR = os.path.dirname(os.path.abspath(__file__))

# Cargar .env desde la misma carpeta del script
load_dotenv(os.path.join(BASE_DIR, ".env"))

app = FastAPI(title="Recommender API", version="1.0")

# Obtener valores del .env — rutas relativas se resuelven desde BASE_DIR
API_KEY_SECRET = os.getenv("API_KEY_RECOMMENDER")
_model_path_raw = os.getenv("MODEL_PATH", "./models/modelo_prod.h5")
MODEL_PATH = os.path.join(BASE_DIR, _model_path_raw) if not os.path.isabs(_model_path_raw) else _model_path_raw

# Variables globales para el modelo y los diccionarios
model = None
user_mapping = {}
place_mapping = {}
places_cache = {}

# Tags — se inicializan con el fallback. Al cargar el modelo se infiere NUM_TAGS real.
TAGS_ORDER_FULL = []
try:
    _tag_paths = [
        os.path.join(BASE_DIR, "../backend/app/data/tags.json"),
        os.path.join(BASE_DIR, "../frontend/src/data/tags.json"),
        os.path.join(BASE_DIR, "tags.json"),
    ]
    for p in _tag_paths:
        if os.path.exists(p):
            with open(p, "r", encoding="utf-8") as f:
                valid_tags = json.load(f)
                TAGS_ORDER_FULL = [tag["id"] for tag in valid_tags]
            print(f"✅ Cargados {len(TAGS_ORDER_FULL)} tags desde {os.path.abspath(p)}")
            break
except Exception as e:
    print(f"⚠️ Error cargando tags.json: {e}")

if not TAGS_ORDER_FULL:
    TAGS_ORDER_FULL = ["restaurant", "cafe", "bar", "bakery", "meal_takeaway", "pizza_restaurant", "hamburger_restaurant"]

# Estas variables globales se actualizan en startup una vez sabemos el NUM_TAGS real del modelo
TAGS_ORDER = TAGS_ORDER_FULL
NUM_TAGS = len(TAGS_ORDER_FULL)
tag_to_idx = {tag: i for i, tag in enumerate(TAGS_ORDER)}


class Candidate(BaseModel):
    place_id: str
    price_level: Optional[int] = 1
    rating: Optional[float] = 3.5
    types: List[str] = []

class PredictRequest(BaseModel):
    user_id: str
    avg_rating: float
    num_val: int
    user_favs: List[str]
    es_finde: int
    franja: int
    candidates: List[Candidate]

def verify_api_key(x_api_key: str = Header(None)):
    if x_api_key != API_KEY_SECRET:
        raise HTTPException(status_code=403, detail="Clave de API no válida")

def _detect_num_tags(keras_model) -> Optional[int]:
    try:
        for inp in keras_model.inputs:
            if "tags" in inp.name.lower():
                return inp.shape[-1]
    except Exception as e:
        print(f"⚠️  No se pudo leer las entradas del modelo: {e}")
    return None

def _sync_tags(keras_model):
    global TAGS_ORDER, NUM_TAGS, tag_to_idx
    num_tags_modelo = _detect_num_tags(keras_model)
    if num_tags_modelo is None:
        print(f"⚠️  No se pudo auto-detectar NUM_TAGS. Usando {NUM_TAGS} tags.")
        return

    print(f"🔎 El modelo fue entrenado con NUM_TAGS = {num_tags_modelo}")
    if num_tags_modelo != len(TAGS_ORDER_FULL):
        print(f"⚠️  Ajustando TAGS_ORDER de {len(TAGS_ORDER_FULL)} → {num_tags_modelo} tags.")
        TAGS_ORDER = TAGS_ORDER_FULL[:num_tags_modelo]
        NUM_TAGS = num_tags_modelo
        tag_to_idx = {tag: i for i, tag in enumerate(TAGS_ORDER)}
    else:
        print(f"✅ Tags en sync: {NUM_TAGS} etiquetas.")

def _print_models_directory(models_dir: str):
    if os.path.exists(models_dir):
        print("   Archivos en la carpeta models/:")
        for f in os.listdir(models_dir):
            print(f"     - {f}")

def _load_model_safe():
    global model
    print(f"🔍 Intentando cargar modelo desde: {MODEL_PATH}")
    if not os.path.exists(MODEL_PATH):
        print(f"❌ MODELO NO ENCONTRADO en: {MODEL_PATH}")
        _print_models_directory(os.path.join(BASE_DIR, "models"))
        return

    try:
        model = tf.keras.models.load_model(MODEL_PATH, compile=False)
        print("✅ Modelo cargado correctamente (compile=False).")
        _sync_tags(model)
    except Exception as e:
        print("💥 Error crítico al cargar el modelo:")
        tb.print_exc()

async def _load_mappings():
    global user_mapping, place_mapping
    models_dir = os.path.join(BASE_DIR, "models")
    try:
        async with aiofiles.open(os.path.join(models_dir, "user_mapping.json"), "r") as f:
            user_mapping = json.loads(await f.read())
        async with aiofiles.open(os.path.join(models_dir, "place_mapping.json"), "r") as f:
            place_mapping = json.loads(await f.read())
        print(f"✅ Mappings cargados — {len(user_mapping)} usuarios / {len(place_mapping)} lugares.")
    except Exception as e:
        print(f"⚠️  Mapeos no encontrados: {e}. Ejecuta train_pipeline.py primero.")

async def _load_places_cache():
    global places_cache
    cache_path = os.path.join(BASE_DIR, "places_cache.json")
    if not os.path.exists(cache_path):
        print("ℹ️  No hay places_cache.json aún (se creará al entrenar).")
        return

    try:
        async with aiofiles.open(cache_path, "r", encoding="utf-8") as f:
            places_cache = json.loads(await f.read())
        print(f"✅ Caché de lugares cargado ({len(places_cache)} entradas).")
    except Exception as e:
        print(f"⚠️  Error cargando places_cache: {e}")

@app.on_event("startup")
async def startup_event():
    # 1. Cargar el modelo
    _load_model_safe()

    # 2. Cargar Mapeos
    await _load_mappings()

    # 3. Cargar Caché de Lugares
    await _load_places_cache()


def extract_tags_vector(types: List[str]) -> np.ndarray:
    tags_vector = np.zeros(NUM_TAGS, dtype=np.float32)
    for t in types:
        if t in tag_to_idx:
            tags_vector[tag_to_idx[t]] = 1.0
    if np.sum(tags_vector) == 0 and "restaurant" in tag_to_idx:
        tags_vector[tag_to_idx["restaurant"]] = 1.0
    return tags_vector


@app.post(
    "/predict",
    dependencies=[Depends(verify_api_key)],
    responses={
        503: {"description": "El modelo no está cargado. Revisa los logs de arranque."},
        400: {"description": "Error en la predicción."},
    },
)
async def predict(req: PredictRequest):
    if model is None:
        raise HTTPException(status_code=503, detail="El modelo no está cargado. Revisa los logs de arranque.")

    if not req.candidates:
        return {"results": []}

    try:
        # 1. Resolver User ID
        u_idx = user_mapping.get(req.user_id, 0)

        # 2. Construir User Profile
        max_num_val_aprox = 50.0
        u_prof = [
            (req.avg_rating - 1.0) / 4.0,
            min(req.num_val / max_num_val_aprox, 1.0)
        ]

        # 3. Vector de Favoritos del Usuario
        matrices_tags_favs = []
        for fav_place_id in req.user_favs:
            if fav_place_id in places_cache:
                types = places_cache[fav_place_id].get("types", [])
                matrices_tags_favs.append(extract_tags_vector(types))

        u_fav_vector = np.mean(matrices_tags_favs, axis=0) if matrices_tags_favs else np.zeros(NUM_TAGS, dtype=np.float32)

        # 4. Contexto Temporal
        franja_ohe = [0, 0, 0]
        if 0 <= req.franja <= 2:
            franja_ohe[req.franja] = 1.0
        time_ctx = [float(req.es_finde)] + franja_ohe

        # 5. Matrices para Inferencia en Lote
        N = len(req.candidates)
        x_uid  = np.full((N,), u_idx, dtype=np.int32)
        x_rid  = np.zeros((N,), dtype=np.int32)
        x_tags = np.zeros((N, NUM_TAGS), dtype=np.float32)
        x_rctx = np.zeros((N, 2), dtype=np.float32)
        x_uprof = np.tile(u_prof, (N, 1)).astype(np.float32)
        x_ufav  = np.tile(u_fav_vector, (N, 1)).astype(np.float32)
        x_time  = np.tile(time_ctx, (N, 1)).astype(np.float32)

        for i, cand in enumerate(req.candidates):
            x_rid[i]  = place_mapping.get(cand.place_id, 0)
            x_tags[i] = extract_tags_vector(cand.types)
            precio_norm    = (cand.price_level or 1) / 3.0
            estrellas_norm = ((cand.rating or 3.5) - 1.0) / 4.0
            x_rctx[i] = [precio_norm, estrellas_norm]

        # 6. Inferencia
        print(f"📊 Prediciendo para usuario {req.user_id} (idx={u_idx}), {N} candidatos, NUM_TAGS={NUM_TAGS}")
        preds = model.predict([x_uid, x_rid, x_tags, x_rctx, x_uprof, x_ufav, x_time], verbose=0)

        # 7. Formatear salida
        results = []
        for i, cand in enumerate(req.candidates):
            score_bruto   = float(preds[i][0])
            score_escalado = 1.0 + (score_bruto * 4.0)
            results.append({
                "place_id": cand.place_id,
                "keras_score": score_bruto,
                "predicted_rating": score_escalado
            })

        results.sort(key=lambda x: x["keras_score"], reverse=True)
        return {"results": results}

    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=400, detail=f"Error en la predicción: {str(e)}")



class TypesRequest(BaseModel):
    place_ids: List[str]

@app.post("/info", dependencies=[Depends(verify_api_key)])
async def get_place_info(req: TypesRequest):
    """Devuelve tipos y price_level de Google Places para una lista de place_ids."""
    result = {}
    for pid in req.place_ids:
        if pid in places_cache:
            result[pid] = {
                "types": places_cache[pid].get("types", []),
                "price_level": places_cache[pid].get("price_level", 1)
            }
    return {"info": result}


@app.get("/")
async def health_check():
    return {
        "status": "ok",
        "message": "DevorApp_Prod Recommender API Activo",
        "model_loaded": model is not None,
        "num_tags": NUM_TAGS,
        "num_users": len(user_mapping),
        "num_places": len(place_mapping),
    }