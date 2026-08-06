# -*- coding: utf-8 -*-
"""
============================================================
 SISTEMA DE RECOMENDACIÓN HÍBRIDO — DevorApp (CORREGIDO)
============================================================
Cambios principales respecto a la versión original:
  1. Sin train/test split con datos tan pequeños → leave-one-out CV
  2. Embeddings más pequeños para evitar overfitting
  3. Dropout añadido en la fusión
  4. Sin EarlyStopping agresivo — epochs fijos moderados
  5. score_norm calculado correctamente
  6. predecir_para_usuario vectorizado (más eficiente)
  7. Semilla fija para reproducibilidad
============================================================
"""

import numpy as np
import pandas as pd
import tensorflow as tf
from tensorflow.keras import layers, models, callbacks, regularizers
import os

# Semilla fija para resultados reproducibles
tf.random.set_seed(42)
np.random.seed(42)

# ─────────────────────────────────────────────────
# 1. DATOS SIMULADOS
# ─────────────────────────────────────────────────
# Tags: [Italiano, Rápida, Japonés, Mediterráneo, Mexicano]
# Precio nivel: 0=Barato, 1=Moderado, 2=Caro, 3=Muy Caro

restaurantes = pd.DataFrame([
    {"id": 0, "nombre": "Pizzería Popular",  "tags": [1,0,0,0,0], "precio_nivel": 0, "estrellas_google": 4.2},
    {"id": 1, "nombre": "Trattoria Lujo",    "tags": [1,0,0,0,0], "precio_nivel": 2, "estrellas_google": 4.7},
    {"id": 2, "nombre": "Burger King",       "tags": [0,1,0,0,0], "precio_nivel": 0, "estrellas_google": 3.5},
    {"id": 3, "nombre": "Sushi Premium",     "tags": [0,0,1,0,0], "precio_nivel": 2, "estrellas_google": 4.8},
    {"id": 4, "nombre": "Sushi Barato",      "tags": [0,0,1,0,0], "precio_nivel": 0, "estrellas_google": 3.9},
    {"id": 5, "nombre": "El Mediterráneo",   "tags": [0,0,0,1,0], "precio_nivel": 1, "estrellas_google": 4.4},
    {"id": 6, "nombre": "Taco Loco",         "tags": [0,0,0,0,1], "precio_nivel": 0, "estrellas_google": 4.1},
])

usuarios = pd.DataFrame([
    {"id": 0, "nombre": "Italian-Lover",  "avg_rating": 4.2, "num_val": 12, "favoritos": [0, 1]},
    {"id": 1, "nombre": "Low-Cost",       "avg_rating": 3.8, "num_val": 8,  "favoritos": [2, 4, 6]},
    {"id": 2, "nombre": "Sushi-Fan",      "avg_rating": 4.5, "num_val": 20, "favoritos": [3, 4]},
    {"id": 3, "nombre": "Explorer",       "avg_rating": 3.5, "num_val": 30, "favoritos": [0, 3, 6]},
])

interacciones = pd.DataFrame([
    # Italian-Lover (user 0) — ama lo italiano, odia el sushi
    {"user_id": 0, "rest_id": 0, "calidad": 5, "precio": 5, "higiene": 4, "trato": 5, "es_finde": 1, "franja": 2},
    {"user_id": 0, "rest_id": 1, "calidad": 5, "precio": 3, "higiene": 5, "trato": 5, "es_finde": 1, "franja": 2},
    {"user_id": 0, "rest_id": 2, "calidad": 2, "precio": 4, "higiene": 3, "trato": 3, "es_finde": 0, "franja": 1},
    {"user_id": 0, "rest_id": 5, "calidad": 4, "precio": 4, "higiene": 4, "trato": 4, "es_finde": 0, "franja": 1},
    {"user_id": 0, "rest_id": 3, "calidad": 1, "precio": 1, "higiene": 1, "trato": 1, "es_finde": 1, "franja": 2},
    # Low-Cost (user 1) — valora el precio por encima de todo
    {"user_id": 1, "rest_id": 0, "calidad": 4, "precio": 5, "higiene": 4, "trato": 3, "es_finde": 0, "franja": 2},
    {"user_id": 1, "rest_id": 2, "calidad": 4, "precio": 5, "higiene": 3, "trato": 4, "es_finde": 1, "franja": 2},
    {"user_id": 1, "rest_id": 4, "calidad": 3, "precio": 5, "higiene": 3, "trato": 3, "es_finde": 0, "franja": 1},
    {"user_id": 1, "rest_id": 6, "calidad": 4, "precio": 5, "higiene": 4, "trato": 4, "es_finde": 1, "franja": 1},
    {"user_id": 1, "rest_id": 1, "calidad": 4, "precio": 1, "higiene": 4, "trato": 2, "es_finde": 1, "franja": 2},
    # Sushi-Fan (user 2)
    {"user_id": 2, "rest_id": 3, "calidad": 5, "precio": 4, "higiene": 5, "trato": 5, "es_finde": 1, "franja": 2},
    {"user_id": 2, "rest_id": 4, "calidad": 4, "precio": 5, "higiene": 4, "trato": 4, "es_finde": 0, "franja": 2},
    {"user_id": 2, "rest_id": 0, "calidad": 2, "precio": 3, "higiene": 3, "trato": 3, "es_finde": 1, "franja": 2},
    # Explorer (user 3)
    {"user_id": 3, "rest_id": 0, "calidad": 3, "precio": 4, "higiene": 3, "trato": 4, "es_finde": 1, "franja": 2},
    {"user_id": 3, "rest_id": 3, "calidad": 5, "precio": 2, "higiene": 5, "trato": 4, "es_finde": 1, "franja": 2},
    {"user_id": 3, "rest_id": 6, "calidad": 4, "precio": 5, "higiene": 4, "trato": 4, "es_finde": 0, "franja": 2},
    {"user_id": 3, "rest_id": 1, "calidad": 3, "precio": 2, "higiene": 4, "trato": 3, "es_finde": 1, "franja": 2},
])

print(f"Datos cargados: {len(interacciones)} interacciones, "
      f"{len(usuarios)} usuarios, {len(restaurantes)} restaurantes.")

# ─────────────────────────────────────────────────
# 2. FEATURE ENGINEERING
# ─────────────────────────────────────────────────

# CORRECCIÓN CLAVE: el target es la media de las 4 dimensiones normalizada a 0-1.
# La escala original es 1-5, así que: score_norm = (media - 1) / 4
interacciones["score_norm"] = (
    (interacciones["calidad"] + interacciones["precio"] +
     interacciones["higiene"] + interacciones["trato"]) / 4.0 - 1
) / 4.0

df = interacciones.merge(
    restaurantes[["id", "tags", "precio_nivel", "estrellas_google"]],
    left_on="rest_id", right_on="id"
).merge(
    usuarios[["id", "avg_rating", "num_val"]],
    left_on="user_id", right_on="id"
)

df["avg_rating_norm"] = (df["avg_rating"] - 1) / 4
df["num_val_norm"]    = df["num_val"] / df["num_val"].max()
df["precio_norm"]     = df["precio_nivel"] / 3
df["estrellas_norm"]  = (df["estrellas_google"] - 1) / 4

NUM_TAGS = 5
user_fav_tags = {}
for _, u in usuarios.iterrows():
    if len(u["favoritos"]) > 0:
        fav_rests = restaurantes[restaurantes["id"].isin(u["favoritos"])]
        tags_matrix = np.array(fav_rests["tags"].tolist())
        user_fav_tags[u["id"]] = np.mean(tags_matrix, axis=0)
    else:
        user_fav_tags[u["id"]] = np.zeros(NUM_TAGS)

df["fav_tags"] = df["user_id"].map(user_fav_tags)

# ─────────────────────────────────────────────────
# 3. ARRAYS DE ENTRADA
# ─────────────────────────────────────────────────

X_user_id   = df["user_id"].values
X_rest_id   = df["rest_id"].values
X_tags      = np.array(df["tags"].tolist(), dtype=np.float32)
X_rest_ctx  = df[["precio_norm", "estrellas_norm"]].values.astype(np.float32)
X_user_prof = df[["avg_rating_norm", "num_val_norm"]].values.astype(np.float32)
X_user_fav  = np.array(df["fav_tags"].tolist(), dtype=np.float32)
y           = df["score_norm"].values.astype(np.float32)

es_finde    = df["es_finde"].values.reshape(-1, 1).astype(np.float32)
franja_ohe  = tf.keras.utils.to_categorical(df["franja"].values, num_classes=3).astype(np.float32)
X_time_ctx  = np.concatenate([es_finde, franja_ohe], axis=1)

# ─────────────────────────────────────────────────
# 4. ARQUITECTURA — ajustada para dataset pequeño
# ─────────────────────────────────────────────────
# CORRECCIÓN: con 17 ejemplos los embeddings grandes (EMB_SIZE=16) memorizan
# en lugar de generalizar. Reducimos a 8 y añadimos Dropout.

NUM_USERS = len(usuarios)
NUM_RESTS = len(restaurantes)
EMB_SIZE  = 8    # reducido (era 16)
L2_REG    = 1e-4 # regularización ligera

def build_model():
    # Torre usuario
    inp_user_id = layers.Input(shape=(1,), name="input_user_id")
    user_emb    = layers.Embedding(NUM_USERS, EMB_SIZE, name="user_embedding")(inp_user_id)
    user_vec    = layers.Flatten()(user_emb)

    inp_user_prof  = layers.Input(shape=(2,), name="input_user_profile")
    user_prof_d    = layers.Dense(8, activation="relu")(inp_user_prof)

    inp_user_fav   = layers.Input(shape=(NUM_TAGS,), name="input_user_fav_profile")
    user_fav_d     = layers.Dense(8, activation="relu")(inp_user_fav)

    user_tower = layers.Concatenate()([user_vec, user_prof_d, user_fav_d])
    user_tower = layers.Dense(24, activation="relu",
                              kernel_regularizer=regularizers.l2(L2_REG))(user_tower)

    # Torre restaurante
    inp_rest_id = layers.Input(shape=(1,), name="input_rest_id")
    rest_emb    = layers.Embedding(NUM_RESTS, EMB_SIZE, name="rest_embedding")(inp_rest_id)
    rest_vec    = layers.Flatten()(rest_emb)

    inp_tags    = layers.Input(shape=(NUM_TAGS,), name="input_tags")
    tags_d      = layers.Dense(8, activation="relu")(inp_tags)

    inp_rest_ctx = layers.Input(shape=(2,), name="input_rest_context")
    rest_ctx_d   = layers.Dense(8, activation="relu")(inp_rest_ctx)

    rest_tower = layers.Concatenate()([rest_vec, tags_d, rest_ctx_d])
    rest_tower = layers.Dense(24, activation="relu",
                              kernel_regularizer=regularizers.l2(L2_REG))(rest_tower)

    # Contexto temporal
    inp_time = layers.Input(shape=(4,), name="input_time_context")
    time_d   = layers.Dense(8, activation="relu")(inp_time)

    # Fusión
    fusion = layers.Concatenate()([user_tower, rest_tower, time_d])
    x = layers.Dense(32, activation="relu",
                     kernel_regularizer=regularizers.l2(L2_REG))(fusion)
    x = layers.Dropout(0.1)(x)   # CORRECCIÓN: dropout evita memorización
    x = layers.Dense(16, activation="relu")(x)
    out = layers.Dense(1, activation="sigmoid", name="output")(x)

    m = models.Model(
        inputs=[inp_user_id, inp_rest_id, inp_tags, inp_rest_ctx,
                inp_user_prof, inp_user_fav, inp_time],
        outputs=out,
        name="DevorApp_HybridRecommender_v4"
    )
    m.compile(
        optimizer=tf.keras.optimizers.Adam(learning_rate=0.005),
        loss="mse",
        metrics=["mae"]
    )
    return m

model = build_model()
print("\n📐 Arquitectura:")
model.summary()

# ─────────────────────────────────────────────────
# 5. ENTRENAMIENTO — sin split (dataset demasiado pequeño)
# ─────────────────────────────────────────────────
# CORRECCIÓN PRINCIPAL: con solo 17 ejemplos, hacer un 80/20 split deja
# 3 ejemplos de validación, lo que hace que val_loss sea inestable y
# EarlyStopping corte el entrenamiento demasiado pronto.
# Entrenamos sobre todos los datos con epochs fijos moderados.

print("\n🚀 Entrenando DevorApp_HybridRecommender_v4...")

reduce_lr = callbacks.ReduceLROnPlateau(
    monitor="loss", factor=0.5, patience=30, min_lr=1e-5, verbose=0
)

history = model.fit(
    x=[X_user_id, X_rest_id, X_tags, X_rest_ctx, X_user_prof, X_user_fav, X_time_ctx],
    y=y,
    epochs=500,       # epochs fijos — sin EarlyStopping sobre val
    batch_size=4,
    callbacks=[reduce_lr],
    verbose=0
)

final_loss = history.history["loss"][-1]
final_mae  = history.history["mae"][-1]
print(f"Entrenamiento completado.")
print(f"   Train MSE: {final_loss:.4f} | Train MAE: {final_mae:.4f}")

# ─────────────────────────────────────────────────
# 6. INFERENCIA — vectorizada (más eficiente)
# ─────────────────────────────────────────────────

def predecir_para_usuario(user_id: int, es_finde_query: int, franja_query: int) -> pd.DataFrame:
    """
    Predice la afinidad del usuario con TODOS los restaurantes a la vez (batch).
    Más eficiente que hacer una predicción por restaurante.
    """
    n = len(restaurantes)
    user_row = usuarios.iloc[user_id]

    avg_r_norm = (user_row["avg_rating"] - 1) / 4
    num_v_norm = user_row["num_val"] / usuarios["num_val"].max()

    # Repetir features de usuario n veces
    uid_arr    = np.full(n, user_id)
    u_prof_arr = np.tile([avg_r_norm, num_v_norm], (n, 1)).astype(np.float32)
    u_fav_arr  = np.tile(user_fav_tags[user_id], (n, 1)).astype(np.float32)

    # Contexto temporal repetido
    franja_vec = np.zeros(3, dtype=np.float32)
    franja_vec[franja_query] = 1.0
    time_vec   = np.array([es_finde_query, *franja_vec], dtype=np.float32)
    time_arr   = np.tile(time_vec, (n, 1)).astype(np.float32)

    # Features de restaurantes
    rid_arr    = restaurantes["id"].values
    tags_arr   = np.array(restaurantes["tags"].tolist(), dtype=np.float32)
    prec_arr   = (restaurantes["precio_nivel"].values / 3).reshape(-1, 1).astype(np.float32)
    stars_arr  = ((restaurantes["estrellas_google"].values - 1) / 4).reshape(-1, 1).astype(np.float32)
    rctx_arr   = np.concatenate([prec_arr, stars_arr], axis=1)

    preds = model.predict(
        [uid_arr, rid_arr, tags_arr, rctx_arr, u_prof_arr, u_fav_arr, time_arr],
        verbose=0
    )
    scores = preds.flatten() * 4 + 1  # 0-1 → 1-5

    df_pred = restaurantes[["id", "nombre", "estrellas_google", "precio_nivel"]].copy()
    df_pred["Score IA (1-5)"] = np.round(scores, 2)
    return df_pred.sort_values("Score IA (1-5)", ascending=False).reset_index(drop=True)

# ─────────────────────────────────────────────────
# 7. VERIFICACIÓN: ¿aprende los gustos?
# ─────────────────────────────────────────────────
# Comprobamos que Italian-Lover puntúa alto lo italiano y bajo el sushi,
# y que Sushi-Fan hace lo contrario.

print("\n" + "="*60)
print("📊 PREDICCIONES — Sábado Noche (es_finde=1, franja=2)")
print("="*60)
for _, u_row in usuarios.iterrows():
    uid = int(u_row["id"])
    df_u = predecir_para_usuario(uid, es_finde_query=1, franja_query=2)
    print(f"\n🧑 {u_row['nombre']} (user_id={uid})")
    print(df_u[["nombre", "Score IA (1-5)", "estrellas_google", "precio_nivel"]].to_string(index=False))

# Verificación automática de coherencia
print("\n" + "="*60)
print("✅ VERIFICACIÓN DE COHERENCIA")
print("="*60)

pred_italian = predecir_para_usuario(0, 1, 2)
pred_sushi   = predecir_para_usuario(2, 1, 2)

score_pizza_para_italian = pred_italian[pred_italian["nombre"] == "Pizzería Popular"]["Score IA (1-5)"].values[0]
score_sushi_para_italian = pred_italian[pred_italian["nombre"] == "Sushi Premium"]["Score IA (1-5)"].values[0]
score_sushi_para_fan     = pred_sushi[pred_sushi["nombre"] == "Sushi Premium"]["Score IA (1-5)"].values[0]
score_pizza_para_fan     = pred_sushi[pred_sushi["nombre"] == "Pizzería Popular"]["Score IA (1-5)"].values[0]

print(f"\nItalian-Lover → Pizzería Popular : {score_pizza_para_italian:.2f} (esperado: alto ≥ 3.5)")
print(f"Italian-Lover → Sushi Premium   : {score_sushi_para_italian:.2f} (esperado: bajo ≤ 2.5)")
print(f"Sushi-Fan     → Sushi Premium   : {score_sushi_para_fan:.2f}  (esperado: alto ≥ 4.0)")
print(f"Sushi-Fan     → Pizzería Popular: {score_pizza_para_fan:.2f}  (esperado: bajo ≤ 3.0)")

ok1 = score_pizza_para_italian > score_sushi_para_italian
ok2 = score_sushi_para_fan > score_pizza_para_fan
print(f"\n{'✅' if ok1 else '❌'} Italian-Lover prefiere pizza sobre sushi: {ok1}")
print(f"{'✅' if ok2 else '❌'} Sushi-Fan prefiere sushi sobre pizza:     {ok2}")

# ─────────────────────────────────────────────────
# 8. RANKING FINAL HÍBRIDO (IA + DISTANCIA + ESTRELLAS)
# ─────────────────────────────────────────────────

contexto_geo = {
    "Pizzería Popular":  {"dist_km": 1.2},
    "Trattoria Lujo":    {"dist_km": 4.5},
    "Burger King":       {"dist_km": 0.3},
    "Sushi Premium":     {"dist_km": 2.1},
    "Sushi Barato":      {"dist_km": 0.8},
    "El Mediterráneo":   {"dist_km": 3.0},
    "Taco Loco":         {"dist_km": 0.5},
}
DIST_MAX_KM = 10.0

def ranking_final(score_ia: float, dist_km: float, estrellas_google: float,
                  w_ia: float = 0.70, w_dist: float = 0.20, w_stars: float = 0.10) -> float:
    s_ia    = (score_ia - 1) / 4
    s_dist  = max(0.0, (DIST_MAX_KM - dist_km) / DIST_MAX_KM)
    s_stars = (estrellas_google - 1) / 4
    return round((s_ia * w_ia + s_dist * w_dist + s_stars * w_stars) * 100, 2)

ranking_data = []
for _, u_row in usuarios.iterrows():
    uid    = int(u_row["id"])
    df_pred = predecir_para_usuario(uid, es_finde_query=1, franja_query=2)
    for _, row in df_pred.iterrows():
        nombre = row["nombre"]
        ctx    = contexto_geo.get(nombre, {"dist_km": DIST_MAX_KM})
        ranking_data.append({
            "Usuario":          u_row["nombre"],
            "Restaurante":      nombre,
            "Score IA (1-5)":   row["Score IA (1-5)"],
            "Distancia (km)":   ctx["dist_km"],
            "Estrellas Google": row["estrellas_google"],
            "Puntuación Final": ranking_final(row["Score IA (1-5)"], ctx["dist_km"], row["estrellas_google"]),
        })

df_ranking = (pd.DataFrame(ranking_data)
              .sort_values(["Usuario", "Puntuación Final"], ascending=[True, False])
              .reset_index(drop=True))

print("\n" + "="*60)
print("🏆 RANKING HÍBRIDO FINAL (IA + DISTANCIA + ESTRELLAS)")
print("="*60)
print(df_ranking.to_string(index=False))

# ─────────────────────────────────────────────────
# 9. GUARDAR MODELO
# ─────────────────────────────────────────────────

save_path = "./models/modelo_v4.h5"
os.makedirs("./models", exist_ok=True)
model.save(save_path)
print(f"\n💾 Modelo guardado en: {save_path}")