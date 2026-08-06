import os
import json
import numpy as np
import pandas as pd
import requests
import tensorflow as tf
from tensorflow.keras import layers, models, callbacks, regularizers
from sqlalchemy import create_engine, text
from dotenv import load_dotenv

SEPARATOR = "============================================================"
print(SEPARATOR)
print(" SISTEMA DE RECOMENDACIÓN — PIPELINE DE PRODUCCIÓN")
print(SEPARATOR)

# 1. CARGAR CONFIGURACIÓN
# Intentar cargar desde keras-api/.env y también desde backend/.env
load_dotenv(".env")  # Carga variables locales de keras-api
load_dotenv("../backend/.env")  # Carga (o sobrescribe) desde el backend para DB y API_KEY

DATABASE_URL = os.getenv("DATABASE_URL")
GOOGLE_API_KEY = os.getenv("GOOGLE_API_KEY")

if not DATABASE_URL or not GOOGLE_API_KEY:
    raise ValueError("❌ Faltan DATABASE_URL o GOOGLE_API_KEY en los archivos .env")

# Arreglar URL de PostgreSQL para SQLAlchemy si usa asyncpg
if DATABASE_URL.startswith("postgresql+asyncpg"):
    DATABASE_URL = DATABASE_URL.replace("postgresql+asyncpg", "postgresql")

try:
    engine = create_engine(DATABASE_URL)
    # Probar conexión ejecutando una consulta trivial
    with engine.connect() as connection:
        connection.execute(text("SELECT 1"))
except Exception as e:
    print(f"❌ Error al conectar a la base de datos: {e}")
    exit(1)

# 2. CARGAR DATOS DE LA BASE DE DATOS
print("\n📥 Extrayendo datos de PostgreSQL...")
try:
    # Usuarios (creado a partir de las valoraciones porque no hay tabla usuarios en DB)
    query_users = """
        SELECT user_id, 
               COUNT(id) as num_val,
               AVG((calidad + precio + higiene + trato) / 4.0) as avg_rating
        FROM valoraciones
        GROUP BY user_id
    """
    usuarios_df = pd.read_sql(query_users, engine)
    
    # Favoritos (cruzando favoritos con listas_favoritos)
    query_favs = """
        SELECT l.user_id, f.restaurante_id 
        FROM favoritos f
        JOIN listas_favoritos l ON f.lista_id = l.id
    """
    favs_df = pd.read_sql(query_favs, engine)
    
    # Restaurantes (para obtener place_id)
    query_rests = "SELECT id as rest_id, place_id FROM restaurantes"
    restaurantes_df = pd.read_sql(query_rests, engine)
    
    # Valoraciones (Target) e Historial (Contexto temporal)
    query_val = """
        SELECT v.user_id, v.restaurante_id, v.calidad, v.precio, v.higiene, v.trato,
               v.fecha as val_fecha,
               -- Intentar cruzar con historial si existe la visita
               h.fecha_acceso as visit_fecha
        FROM valoraciones v
        LEFT JOIN historial h ON v.user_id = h.user_id AND v.restaurante_id = h.restaurante_id
    """
    val_df = pd.read_sql(query_val, engine)
except Exception as e:
    print(f"❌ Error al ejecutar queries en la base de datos: {e}")
    exit(1)

if len(val_df) == 0:
    print("❌ No hay suficientes valoraciones en la base de datos para entrenar.")
    exit(1)

# Procesar contexto temporal (usar visit_fecha, si no, val_fecha)
val_df["fecha_efectiva"] = pd.to_datetime(val_df["visit_fecha"].fillna(val_df["val_fecha"]))
val_df["es_finde"] = val_df["fecha_efectiva"].dt.dayofweek.isin([5, 6]).astype(int)

# Franja: Mañana (05-12) -> 0, Tarde (12-19) -> 1, Noche (19-05) -> 2
def get_franja(hour):
    if pd.isna(hour): return 1
    if 5 <= hour < 12: return 0
    elif 12 <= hour < 19: return 1
    else: return 2
    
val_df["franja"] = val_df["fecha_efectiva"].dt.hour.apply(get_franja)

# Score (Target)
val_df["score_norm"] = ((val_df["calidad"] + val_df["precio"] + val_df["higiene"] + val_df["trato"]) / 4.0 - 1) / 4.0

# 3. MAPEO DE IDS (Para que Keras tenga índices continuos)
print("\n🗺️ Generando diccionarios de mapeo...")
user_ids_unicos = usuarios_df["user_id"].unique()
rest_ids_unicos = restaurantes_df["rest_id"].unique()

user_mapping = {str(uid): idx for idx, uid in enumerate(user_ids_unicos)}
rest_mapping = {int(rid): idx for idx, rid in enumerate(rest_ids_unicos)}

os.makedirs("./models", exist_ok=True)
with open("./models/user_mapping.json", "w") as f:
    json.dump(user_mapping, f)
with open("./models/rest_mapping.json", "w") as f:
    json.dump(rest_mapping, f)

# Generar también mapeo directo de place_id a índice para la inferencia
place_mapping = {}
for _, row in restaurantes_df.iterrows():
    if row["rest_id"] in rest_mapping:
        place_mapping[row["place_id"]] = rest_mapping[row["rest_id"]]

with open("./models/place_mapping.json", "w") as f:
    json.dump(place_mapping, f)

# Aplicar mapeos a los DataFrames
val_df["user_idx"] = val_df["user_id"].map(user_mapping)
val_df["rest_idx"] = val_df["restaurante_id"].map(rest_mapping)
favs_df["user_idx"] = favs_df["user_id"].map(user_mapping)
favs_df["rest_idx"] = favs_df["restaurante_id"].map(rest_mapping)

# Eliminar valoraciones de usuarios o restaurantes huérfanos (por si acaso hay inconsistencias DB)
val_df = val_df.dropna(subset=["user_idx", "rest_idx"])
favs_df = favs_df.dropna(subset=["user_idx", "rest_idx"])

# 4. EXTRACCIÓN DE TAGS DESDE GOOGLE PLACES API (Con Caché)
print("\n🌍 Obteniendo información de restaurantes de Google Places API...")
CACHE_FILE = "places_cache.json"
if os.path.exists(CACHE_FILE):
    with open(CACHE_FILE, "r", encoding="utf-8") as f:
        places_cache = json.load(f)
else:
    places_cache = {}

# Cargar los tags válidos
try:
    with open("../backend/app/data/tags.json", "r", encoding="utf-8") as f:
        valid_tags = json.load(f)
        TAGS_ORDER = [tag["id"] for tag in valid_tags]
except Exception:
    # Fallback genérico si no encuentra el archivo del backend
    # Cargar todos los tags posibles desde el archivo central
    try:
        with open("../frontend/src/data/tags.json", "r", encoding="utf-8") as f:
            all_tags_data = json.load(f)
            TAGS_ORDER = [t["id"] for t in all_tags_data]
        print(f"Cargados {len(TAGS_ORDER)} tags para el modelo.")
    except Exception as e:
        print(f"Error cargando tags.json: {e}. Usando lista por defecto.")
        TAGS_ORDER = ["restaurant", "cafe", "bar", "bakery", "meal_takeaway", "pizza_restaurant", "hamburger_restaurant"]

NUM_TAGS = len(TAGS_ORDER)
tag_to_idx = {tag: i for i, tag in enumerate(TAGS_ORDER)}

rest_features = {}
headers = {
    "X-Goog-Api-Key": GOOGLE_API_KEY,
    "X-Goog-FieldMask": "priceLevel,rating,types"
}

nuevos_cacheados = 0
for _, row in restaurantes_df.iterrows():
    r_idx = rest_mapping[row["rest_id"]]
    place_id = row["place_id"]
    
    if place_id not in places_cache:
        # Extraer de Google
        url = f"https://places.googleapis.com/v1/places/{place_id}"
        resp = requests.get(url, headers=headers)
        if resp.status_code == 200:
            data = resp.json()
            # Mapear priceLevel
            pl = data.get("priceLevel", "PRICE_LEVEL_MODERATE")
            if pl == "PRICE_LEVEL_INEXPENSIVE": p_nivel = 0
            elif pl == "PRICE_LEVEL_MODERATE": p_nivel = 1
            elif pl == "PRICE_LEVEL_EXPENSIVE": p_nivel = 2
            elif pl == "PRICE_LEVEL_VERY_EXPENSIVE": p_nivel = 3
            else: p_nivel = 1 # Por defecto
            
            stars = data.get("rating", 3.5)
            types = data.get("types", [])
            
            places_cache[place_id] = {
                "precio_nivel": p_nivel,
                "estrellas_google": stars,
                "types": types
            }
            nuevos_cacheados += 1
        else:
            print(f"  ⚠️ Error al extraer {place_id} de Google API. Usando valores por defecto.")
            places_cache[place_id] = {
                "precio_nivel": 1,
                "estrellas_google": 3.5,
                "types": ["restaurant"]
            }

    # Procesar características
    info = places_cache[place_id]
    
    # Vector One-Hot para Tags
    tags_vector = np.zeros(NUM_TAGS, dtype=np.float32)
    for t in info["types"]:
        if t in tag_to_idx:
            tags_vector[tag_to_idx[t]] = 1.0
            
    # Si no tiene ningún tag reconocido, ponemos el genérico para no dejarlo vacío
    if np.sum(tags_vector) == 0 and "restaurant" in tag_to_idx:
        tags_vector[tag_to_idx["restaurant"]] = 1.0

    rest_features[r_idx] = {
        "precio_norm": info["precio_nivel"] / 3.0,
        "estrellas_norm": (info["estrellas_google"] - 1.0) / 4.0,
        "tags_vector": tags_vector
    }

print(f"  ✅ Caché actualizado. Nuevas llamadas a Google API hoy: {nuevos_cacheados}")

# Guardar caché actualizado
with open(CACHE_FILE, "w", encoding="utf-8") as f:
    json.dump(places_cache, f, ensure_ascii=False, indent=2)

# 5. CONSTRUIR VECTORES DE ENTRADA
print("\n🧩 Construyendo matrices de entrenamiento...")

NUM_USERS = len(user_mapping)
NUM_RESTS = len(rest_mapping)

# Precomputar perfil de favoritos por usuario
user_fav_tags = {}
for u_idx in range(NUM_USERS):
    favs_del_usuario = favs_df[favs_df["user_idx"] == u_idx]["rest_idx"].values
    if len(favs_del_usuario) > 0:
        matrices_tags = [rest_features[r_idx]["tags_vector"] for r_idx in favs_del_usuario if r_idx in rest_features]
        if matrices_tags:
            user_fav_tags[u_idx] = np.mean(matrices_tags, axis=0)
        else:
            user_fav_tags[u_idx] = np.zeros(NUM_TAGS, dtype=np.float32)
    else:
        user_fav_tags[u_idx] = np.zeros(NUM_TAGS, dtype=np.float32)

# Normalizaciones globales de perfil de usuario
max_num_val = usuarios_df["num_val"].max()
if max_num_val == 0: max_num_val = 1

X_uid_list, X_rid_list, X_tags_list, X_rctx_list = [], [], [], []
X_uprof_list, X_ufav_list, X_time_list, y_list = [], [], [], []

for _, val in val_df.iterrows():
    u_idx = int(val["user_idx"])
    r_idx = int(val["rest_idx"])
    
    # Usuario features
    u_row = usuarios_df[usuarios_df["user_id"] == val["user_id"]].iloc[0]
    u_prof = [
        (u_row["avg_rating"] - 1) / 4.0,
        u_row["num_val"] / max_num_val
    ]
    
    # Restaurante features
    r_feat = rest_features[r_idx]
    r_ctx = [r_feat["precio_norm"], r_feat["estrellas_norm"]]
    
    # Temporal features
    franja_ohe = [0, 0, 0]
    franja_ohe[int(val["franja"])] = 1.0
    time_ctx = [val["es_finde"]] + franja_ohe
    
    X_uid_list.append(u_idx)
    X_rid_list.append(r_idx)
    X_tags_list.append(r_feat["tags_vector"])
    X_rctx_list.append(r_ctx)
    X_uprof_list.append(u_prof)
    X_ufav_list.append(user_fav_tags[u_idx])
    X_time_list.append(time_ctx)
    y_list.append(val["score_norm"])

X_uid   = np.array(X_uid_list, dtype=np.int32)
X_rid   = np.array(X_rid_list, dtype=np.int32)
X_tags  = np.array(X_tags_list, dtype=np.float32)
X_rctx  = np.array(X_rctx_list, dtype=np.float32)
X_uprof = np.array(X_uprof_list, dtype=np.float32)
X_ufav  = np.array(X_ufav_list, dtype=np.float32)
X_time  = np.array(X_time_list, dtype=np.float32)
y       = np.array(y_list, dtype=np.float32)

print(f"✅ Dataset final: {len(y)} ejemplos listos para entrenar.")
print(f"   Usuarios: {NUM_USERS} | Restaurantes: {NUM_RESTS} | Tags Totales: {NUM_TAGS}")

# 6. DEFINIR Y ENTRENAR EL MODELO
print("\n🚀 Entrenando DevorApp_Prod...")

tf.random.set_seed(42)
np.random.seed(42)

EMB_SIZE  = min(16, max(4, int(NUM_USERS**0.5))) # Ajuste dinámico de embeddings según la DB
L2_REG    = 1e-4

# Torre usuario
inp_user_id = layers.Input(shape=(1,), name="input_user_id")
user_emb    = layers.Embedding(NUM_USERS, EMB_SIZE, name="user_embedding")(inp_user_id)
user_vec    = layers.Flatten()(user_emb)

inp_user_prof  = layers.Input(shape=(2,), name="input_user_profile")
user_prof_d    = layers.Dense(8, activation="relu")(inp_user_prof)

inp_user_fav   = layers.Input(shape=(NUM_TAGS,), name="input_user_fav_profile")
user_fav_d     = layers.Dense(8, activation="relu")(inp_user_fav)

user_tower = layers.Concatenate()([user_vec, user_prof_d, user_fav_d])
user_tower = layers.Dense(32, activation="relu", kernel_regularizer=regularizers.l2(L2_REG))(user_tower)

# Torre restaurante
inp_rest_id = layers.Input(shape=(1,), name="input_rest_id")
rest_emb    = layers.Embedding(NUM_RESTS, EMB_SIZE, name="rest_embedding")(inp_rest_id)
rest_vec    = layers.Flatten()(rest_emb)

inp_tags    = layers.Input(shape=(NUM_TAGS,), name="input_tags")
tags_d      = layers.Dense(16, activation="relu")(inp_tags)

inp_rest_ctx = layers.Input(shape=(2,), name="input_rest_context")
rest_ctx_d   = layers.Dense(8, activation="relu")(inp_rest_ctx)

rest_tower = layers.Concatenate()([rest_vec, tags_d, rest_ctx_d])
rest_tower = layers.Dense(32, activation="relu", kernel_regularizer=regularizers.l2(L2_REG))(rest_tower)

# Contexto temporal
inp_time = layers.Input(shape=(4,), name="input_time_context")
time_d   = layers.Dense(8, activation="relu")(inp_time)

# Fusión
fusion = layers.Concatenate()([user_tower, rest_tower, time_d])
x = layers.Dense(64, activation="relu", kernel_regularizer=regularizers.l2(L2_REG))(fusion)
x = layers.Dropout(0.2)(x)
x = layers.Dense(32, activation="relu")(x)
out = layers.Dense(1, activation="sigmoid", name="output")(x)

model = models.Model(
    inputs=[inp_user_id, inp_rest_id, inp_tags, inp_rest_ctx, inp_user_prof, inp_user_fav, inp_time],
    outputs=out,
    name="DevorApp_Prod"
)

model.compile(
    optimizer=tf.keras.optimizers.Adam(learning_rate=0.005),
    loss="mse",
    metrics=["mae"]
)

# EarlyStopping solo si tenemos suficientes datos para no asfixiar a una BD muy pequeña
reduce_lr = callbacks.ReduceLROnPlateau(monitor="loss", factor=0.5, patience=20, min_lr=1e-5, verbose=0)
early_stop = callbacks.EarlyStopping(monitor="loss", patience=50, restore_best_weights=True)

history = model.fit(
    x=[X_uid, X_rid, X_tags, X_rctx, X_uprof, X_ufav, X_time],
    y=y,
    epochs=500,
    batch_size=16,
    callbacks=[reduce_lr, early_stop],
    verbose=0
)

final_loss = history.history["loss"][-1]
final_mae  = history.history["mae"][-1]
print("✅ Entrenamiento completado.")
print(f"   Train MSE: {final_loss:.4f} | Train MAE: {final_mae:.4f}")

save_path = "./models/modelo_prod.h5"
model.save(save_path)
print(f"\n💾 Modelo guardado en: {save_path}")
print("📄 Mappings guardados en ./models/user_mapping.json y rest_mapping.json")
print(SEPARATOR)
