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

# Base directory = folder containing this script (keras-api/)
BASE_DIR = os.path.dirname(os.path.abspath(__file__))

# Load .env from the script's folder
load_dotenv(os.path.join(BASE_DIR, ".env"))

app = FastAPI(title="Recommender API", version="1.0")

# Read .env values; relative paths resolve from BASE_DIR
API_KEY_SECRET = os.getenv("API_KEY_RECOMMENDER")
_model_path_raw = os.getenv("MODEL_PATH", "./models/modelo_prod.h5")
MODEL_PATH = os.path.join(BASE_DIR, _model_path_raw) if not os.path.isabs(_model_path_raw) else _model_path_raw

# Globals for the model and the dictionaries
model = None
user_mapping = {}
place_mapping = {}
places_cache = {}

# Tags start from the fallback; the real NUM_TAGS is inferred when the model loads.
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
            print(f"✅ Loaded {len(TAGS_ORDER_FULL)} tags from {os.path.abspath(p)}")
            break
except Exception as e:
    print(f"⚠️ Error loading tags.json: {e}")

if not TAGS_ORDER_FULL:
    TAGS_ORDER_FULL = ["restaurant", "cafe", "bar", "bakery", "meal_takeaway", "pizza_restaurant", "hamburger_restaurant"]

# These globals are updated at startup once the model's real NUM_TAGS is known
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
        print(f"⚠️  Could not read the model inputs: {e}")
    return None

def _sync_tags(keras_model):
    global TAGS_ORDER, NUM_TAGS, tag_to_idx
    model_num_tags = _detect_num_tags(keras_model)
    if model_num_tags is None:
        print(f"⚠️  Could not auto-detect NUM_TAGS. Using {NUM_TAGS} tags.")
        return

    print(f"🔎 The model was trained with NUM_TAGS = {model_num_tags}")
    if model_num_tags != len(TAGS_ORDER_FULL):
        print(f"⚠️  Adjusting TAGS_ORDER from {len(TAGS_ORDER_FULL)} to {model_num_tags} tags.")
        TAGS_ORDER = TAGS_ORDER_FULL[:model_num_tags]
        NUM_TAGS = model_num_tags
        tag_to_idx = {tag: i for i, tag in enumerate(TAGS_ORDER)}
    else:
        print(f"✅ Tags in sync: {NUM_TAGS} tags.")

def _print_models_directory(models_dir: str):
    if os.path.exists(models_dir):
        print("   Files in the models/ folder:")
        for f in os.listdir(models_dir):
            print(f"     - {f}")

def _load_model_safe():
    global model
    print(f"🔍 Trying to load the model from: {MODEL_PATH}")
    if not os.path.exists(MODEL_PATH):
        print(f"❌ MODEL NOT FOUND at: {MODEL_PATH}")
        _print_models_directory(os.path.join(BASE_DIR, "models"))
        return

    try:
        model = tf.keras.models.load_model(MODEL_PATH, compile=False)
        print("✅ Model loaded successfully (compile=False).")
        _sync_tags(model)
    except Exception as e:
        print("💥 Critical error loading the model:")
        tb.print_exc()

async def _load_mappings():
    global user_mapping, place_mapping
    models_dir = os.path.join(BASE_DIR, "models")
    try:
        async with aiofiles.open(os.path.join(models_dir, "user_mapping.json"), "r") as f:
            user_mapping = json.loads(await f.read())
        async with aiofiles.open(os.path.join(models_dir, "place_mapping.json"), "r") as f:
            place_mapping = json.loads(await f.read())
        print(f"✅ Mappings loaded: {len(user_mapping)} users / {len(place_mapping)} places.")
    except Exception as e:
        print(f"⚠️  Mappings not found: {e}. Run train_pipeline.py first.")

async def _load_places_cache():
    global places_cache
    cache_path = os.path.join(BASE_DIR, "places_cache.json")
    if not os.path.exists(cache_path):
        print("ℹ️  No places_cache.json yet (it will be created on training).")
        return

    try:
        async with aiofiles.open(cache_path, "r", encoding="utf-8") as f:
            places_cache = json.loads(await f.read())
        print(f"✅ Places cache loaded ({len(places_cache)} entries).")
    except Exception as e:
        print(f"⚠️  Error loading places_cache: {e}")

@app.on_event("startup")
async def startup_event():
    # 1. Load the model
    _load_model_safe()

    # 2. Cargar Mapeos
    await _load_mappings()

    # 3. Load the places cache
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
        max_num_val_approx = 50.0
        u_prof = [
            (req.avg_rating - 1.0) / 4.0,
            min(req.num_val / max_num_val_approx, 1.0)
        ]

        # 3. User favorites vector
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

        # 5. Matrices for batch inference
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
        print(f"📊 Predicting for user {req.user_id} (idx={u_idx}), {N} candidates, NUM_TAGS={NUM_TAGS}")
        preds = model.predict([x_uid, x_rid, x_tags, x_rctx, x_uprof, x_ufav, x_time], verbose=0)

        # 7. Formatear salida
        results = []
        for i, cand in enumerate(req.candidates):
            raw_score   = float(preds[i][0])
            scaled_score = 1.0 + (raw_score * 4.0)
            results.append({
                "place_id": cand.place_id,
                "keras_score": raw_score,
                "predicted_rating": scaled_score
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
    """Return Google Places types and price_level for a list of place_ids."""
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