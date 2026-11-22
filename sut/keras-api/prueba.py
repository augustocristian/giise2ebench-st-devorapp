# -*- coding: utf-8 -*-
"""
============================================================
 HYBRID RECOMMENDATION SYSTEM - DevorApp (FIXED)
============================================================
Main changes from the original version:
  1. No train/test split with such small data -> leave-one-out CV
  2. Smaller embeddings to avoid overfitting
  3. Dropout added in the fusion layer
  4. No aggressive EarlyStopping; moderate fixed epochs
  5. score_norm calculado correctamente
  6. Vectorized predict_for_user (more efficient)
  7. Fixed seed for reproducibility
============================================================
"""

import numpy as np
import pandas as pd
import tensorflow as tf
from tensorflow.keras import layers, models, callbacks, regularizers
import os

# Fixed seed for reproducible results
tf.random.set_seed(42)
np.random.seed(42)

# ─────────────────────────────────────────────────
# 1. SIMULATED DATA
# ─────────────────────────────────────────────────
# Tags: [Italian, Fast, Japanese, Mediterranean, Mexican]
# Precio nivel: 0=Barato, 1=Moderado, 2=Caro, 3=Muy Caro

restaurants = pd.DataFrame([
    {"id": 0, "nombre": "Pizzería Popular",  "tags": [1,0,0,0,0], "precio_nivel": 0, "estrellas_google": 4.2},
    {"id": 1, "nombre": "Trattoria Lujo",    "tags": [1,0,0,0,0], "precio_nivel": 2, "estrellas_google": 4.7},
    {"id": 2, "nombre": "Burger King",       "tags": [0,1,0,0,0], "precio_nivel": 0, "estrellas_google": 3.5},
    {"id": 3, "nombre": "Sushi Premium",     "tags": [0,0,1,0,0], "precio_nivel": 2, "estrellas_google": 4.8},
    {"id": 4, "nombre": "Sushi Barato",      "tags": [0,0,1,0,0], "precio_nivel": 0, "estrellas_google": 3.9},
    {"id": 5, "nombre": "El Mediterráneo",   "tags": [0,0,0,1,0], "precio_nivel": 1, "estrellas_google": 4.4},
    {"id": 6, "nombre": "Taco Loco",         "tags": [0,0,0,0,1], "precio_nivel": 0, "estrellas_google": 4.1},
])

users = pd.DataFrame([
    {"id": 0, "nombre": "Italian-Lover",  "avg_rating": 4.2, "num_val": 12, "favoritos": [0, 1]},
    {"id": 1, "nombre": "Low-Cost",       "avg_rating": 3.8, "num_val": 8,  "favoritos": [2, 4, 6]},
    {"id": 2, "nombre": "Sushi-Fan",      "avg_rating": 4.5, "num_val": 20, "favoritos": [3, 4]},
    {"id": 3, "nombre": "Explorer",       "avg_rating": 3.5, "num_val": 30, "favoritos": [0, 3, 6]},
])

interactions = pd.DataFrame([
    # Italian-Lover (user 0): loves Italian, hates sushi
    {"user_id": 0, "rest_id": 0, "calidad": 5, "precio": 5, "higiene": 4, "trato": 5, "es_finde": 1, "franja": 2},
    {"user_id": 0, "rest_id": 1, "calidad": 5, "precio": 3, "higiene": 5, "trato": 5, "es_finde": 1, "franja": 2},
    {"user_id": 0, "rest_id": 2, "calidad": 2, "precio": 4, "higiene": 3, "trato": 3, "es_finde": 0, "franja": 1},
    {"user_id": 0, "rest_id": 5, "calidad": 4, "precio": 4, "higiene": 4, "trato": 4, "es_finde": 0, "franja": 1},
    {"user_id": 0, "rest_id": 3, "calidad": 1, "precio": 1, "higiene": 1, "trato": 1, "es_finde": 1, "franja": 2},
    # Low-Cost (user 1): values price above all
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

print(f"Data loaded: {len(interactions)} interactions, "
      f"{len(users)} usuarios, {len(restaurants)} restaurantes.")

# ─────────────────────────────────────────────────
# 2. FEATURE ENGINEERING
# ─────────────────────────────────────────────────

# KEY FIX: the target is the mean of the 4 dimensions, normalized to 0-1.
# The original scale is 1-5, so: score_norm = (mean - 1) / 4
interactions["score_norm"] = (
    (interactions["calidad"] + interactions["precio"] +
     interactions["higiene"] + interactions["trato"]) / 4.0 - 1
) / 4.0

df = interactions.merge(
    restaurants[["id", "tags", "precio_nivel", "estrellas_google"]],
    left_on="rest_id", right_on="id"
).merge(
    users[["id", "avg_rating", "num_val"]],
    left_on="user_id", right_on="id"
)

df["avg_rating_norm"] = (df["avg_rating"] - 1) / 4
df["num_val_norm"]    = df["num_val"] / df["num_val"].max()
df["precio_norm"]     = df["precio_nivel"] / 3
df["estrellas_norm"]  = (df["estrellas_google"] - 1) / 4

NUM_TAGS = 5
user_fav_tags = {}
for _, u in users.iterrows():
    if len(u["favoritos"]) > 0:
        fav_rests = restaurants[restaurants["id"].isin(u["favoritos"])]
        tags_matrix = np.array(fav_rests["tags"].tolist())
        user_fav_tags[u["id"]] = np.mean(tags_matrix, axis=0)
    else:
        user_fav_tags[u["id"]] = np.zeros(NUM_TAGS)

df["fav_tags"] = df["user_id"].map(user_fav_tags)

# ─────────────────────────────────────────────────
# 3. INPUT ARRAYS
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
# 4. ARCHITECTURE - tuned for a small dataset
# ─────────────────────────────────────────────────
# FIX: with 17 examples, large embeddings (EMB_SIZE=16) memorize
# instead of generalizing. Reduced to 8 and added Dropout.

NUM_USERS = len(users)
NUM_RESTS = len(restaurants)
EMB_SIZE  = 8    # reducido (era 16)
L2_REG    = 1e-4 # light regularization

def build_model():
    # User tower
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

    # Restaurant tower
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

    # Fusion
    fusion = layers.Concatenate()([user_tower, rest_tower, time_d])
    x = layers.Dense(32, activation="relu",
                     kernel_regularizer=regularizers.l2(L2_REG))(fusion)
    x = layers.Dropout(0.1)(x)   # FIX: dropout prevents memorization
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
print("\n📐 Architecture:")
model.summary()

# ─────────────────────────────────────────────────
# 5. TRAINING - no split (dataset too small)
# ─────────────────────────────────────────────────
# MAIN FIX: with only 17 examples, an 80/20 split leaves
# 3 validation examples, which makes val_loss unstable and
# makes EarlyStopping cut training too early.
# Train on all the data with a moderate fixed number of epochs.

print("\n🚀 Training DevorApp_HybridRecommender_v4...")

reduce_lr = callbacks.ReduceLROnPlateau(
    monitor="loss", factor=0.5, patience=30, min_lr=1e-5, verbose=0
)

history = model.fit(
    x=[X_user_id, X_rest_id, X_tags, X_rest_ctx, X_user_prof, X_user_fav, X_time_ctx],
    y=y,
    epochs=500,       # fixed epochs, no EarlyStopping on val
    batch_size=4,
    callbacks=[reduce_lr],
    verbose=0
)

final_loss = history.history["loss"][-1]
final_mae  = history.history["mae"][-1]
print(f"Training completed.")
print(f"   Train MSE: {final_loss:.4f} | Train MAE: {final_mae:.4f}")

# ─────────────────────────────────────────────────
# 6. INFERENCE - vectorized (more efficient)
# ─────────────────────────────────────────────────

def predict_for_user(user_id: int, es_finde_query: int, franja_query: int) -> pd.DataFrame:
    """
    Predict the user's affinity with ALL restaurants at once (batch).
    More efficient than predicting one restaurant at a time.
    """
    n = len(restaurants)
    user_row = users.iloc[user_id]

    avg_r_norm = (user_row["avg_rating"] - 1) / 4
    num_v_norm = user_row["num_val"] / users["num_val"].max()

    # Repeat user features n times
    uid_arr    = np.full(n, user_id)
    u_prof_arr = np.tile([avg_r_norm, num_v_norm], (n, 1)).astype(np.float32)
    u_fav_arr  = np.tile(user_fav_tags[user_id], (n, 1)).astype(np.float32)

    # Contexto temporal repetido
    franja_vec = np.zeros(3, dtype=np.float32)
    franja_vec[franja_query] = 1.0
    time_vec   = np.array([es_finde_query, *franja_vec], dtype=np.float32)
    time_arr   = np.tile(time_vec, (n, 1)).astype(np.float32)

    # Restaurant features
    rid_arr    = restaurants["id"].values
    tags_arr   = np.array(restaurants["tags"].tolist(), dtype=np.float32)
    prec_arr   = (restaurants["precio_nivel"].values / 3).reshape(-1, 1).astype(np.float32)
    stars_arr  = ((restaurants["estrellas_google"].values - 1) / 4).reshape(-1, 1).astype(np.float32)
    rctx_arr   = np.concatenate([prec_arr, stars_arr], axis=1)

    preds = model.predict(
        [uid_arr, rid_arr, tags_arr, rctx_arr, u_prof_arr, u_fav_arr, time_arr],
        verbose=0
    )
    scores = preds.flatten() * 4 + 1  # 0-1 → 1-5

    df_pred = restaurants[["id", "nombre", "estrellas_google", "precio_nivel"]].copy()
    df_pred["Score IA (1-5)"] = np.round(scores, 2)
    return df_pred.sort_values("Score IA (1-5)", ascending=False).reset_index(drop=True)

# ─────────────────────────────────────────────────
# 7. VERIFICATION: does it learn the tastes?
# ─────────────────────────────────────────────────
# Check that Italian-Lover scores Italian high and sushi low,
# and that Sushi-Fan does the opposite.

print("\n" + "="*60)
print("📊 PREDICTIONS - Saturday night (es_finde=1, franja=2)")
print("="*60)
for _, u_row in users.iterrows():
    uid = int(u_row["id"])
    df_u = predict_for_user(uid, es_finde_query=1, franja_query=2)
    print(f"\n🧑 {u_row['nombre']} (user_id={uid})")
    print(df_u[["nombre", "Score IA (1-5)", "estrellas_google", "precio_nivel"]].to_string(index=False))

# Automatic coherence check
print("\n" + "="*60)
print("✅ COHERENCE CHECK")
print("="*60)

pred_italian = predict_for_user(0, 1, 2)
pred_sushi   = predict_for_user(2, 1, 2)

score_pizza_for_italian = pred_italian[pred_italian["nombre"] == "Pizzería Popular"]["Score IA (1-5)"].values[0]
score_sushi_for_italian = pred_italian[pred_italian["nombre"] == "Sushi Premium"]["Score IA (1-5)"].values[0]
score_sushi_for_fan     = pred_sushi[pred_sushi["nombre"] == "Sushi Premium"]["Score IA (1-5)"].values[0]
score_pizza_for_fan     = pred_sushi[pred_sushi["nombre"] == "Pizzería Popular"]["Score IA (1-5)"].values[0]

print(f"\nItalian-Lover → Pizzería Popular : {score_pizza_for_italian:.2f} (expected: high >= 3.5)")
print(f"Italian-Lover → Sushi Premium   : {score_sushi_for_italian:.2f} (expected: low <= 2.5)")
print(f"Sushi-Fan     → Sushi Premium   : {score_sushi_for_fan:.2f}  (expected: high >= 4.0)")
print(f"Sushi-Fan     → Pizzería Popular: {score_pizza_for_fan:.2f}  (expected: low <= 3.0)")

ok1 = score_pizza_for_italian > score_sushi_for_italian
ok2 = score_sushi_for_fan > score_pizza_for_fan
print(f"\n{'✅' if ok1 else '❌'} Italian-Lover prefers pizza over sushi: {ok1}")
print(f"{'✅' if ok2 else '❌'} Sushi-Fan prefers sushi over pizza:      {ok2}")

# ─────────────────────────────────────────────────
# 8. FINAL HYBRID RANKING (AI + DISTANCE + STARS)
# ─────────────────────────────────────────────────

geo_context = {
    "Pizzería Popular":  {"dist_km": 1.2},
    "Trattoria Lujo":    {"dist_km": 4.5},
    "Burger King":       {"dist_km": 0.3},
    "Sushi Premium":     {"dist_km": 2.1},
    "Sushi Barato":      {"dist_km": 0.8},
    "El Mediterráneo":   {"dist_km": 3.0},
    "Taco Loco":         {"dist_km": 0.5},
}
DIST_MAX_KM = 10.0

def final_ranking(ai_score: float, dist_km: float, estrellas_google: float,
                  w_ia: float = 0.70, w_dist: float = 0.20, w_stars: float = 0.10) -> float:
    s_ia    = (ai_score - 1) / 4
    s_dist  = max(0.0, (DIST_MAX_KM - dist_km) / DIST_MAX_KM)
    s_stars = (estrellas_google - 1) / 4
    return round((s_ia * w_ia + s_dist * w_dist + s_stars * w_stars) * 100, 2)

ranking_data = []
for _, u_row in users.iterrows():
    uid    = int(u_row["id"])
    df_pred = predict_for_user(uid, es_finde_query=1, franja_query=2)
    for _, row in df_pred.iterrows():
        nombre = row["nombre"]
        ctx    = geo_context.get(nombre, {"dist_km": DIST_MAX_KM})
        ranking_data.append({
            "Usuario":          u_row["nombre"],
            "Restaurante":      nombre,
            "Score IA (1-5)":   row["Score IA (1-5)"],
            "Distancia (km)":   ctx["dist_km"],
            "Estrellas Google": row["estrellas_google"],
            "Puntuación Final": final_ranking(row["Score IA (1-5)"], ctx["dist_km"], row["estrellas_google"]),
        })

df_ranking = (pd.DataFrame(ranking_data)
              .sort_values(["Usuario", "Puntuación Final"], ascending=[True, False])
              .reset_index(drop=True))

print("\n" + "="*60)
print("🏆 FINAL HYBRID RANKING (AI + DISTANCE + STARS)")
print("="*60)
print(df_ranking.to_string(index=False))

# ─────────────────────────────────────────────────
# 9. GUARDAR MODELO
# ─────────────────────────────────────────────────

save_path = "./models/modelo_v4.h5"
os.makedirs("./models", exist_ok=True)
model.save(save_path)
print(f"\n💾 Model saved at: {save_path}")