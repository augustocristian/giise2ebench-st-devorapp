import asyncio
import os
import json
import math
from typing import List, Dict, Any, Optional, Set
from datetime import datetime
from sqlalchemy import text

from app.core.config import settings
from app.models.dtos.recommendation_dto import RecommendationRequest
from app.infrastructure.database import SessionLocal
from app.infrastructure.google_places_client import google_places_client
from app.infrastructure.keras_api_client import keras_api_client

# Tipos demasiado genéricos para usarlos como señal de preferencia
GENERIC_TYPES = {'restaurant', 'food', 'establishment', 'point_of_interest', 'meal_takeaway', 'meal_delivery', 'store', 'lodging'}

class RecommendationService:
    def __init__(self):
        self._valid_tag_ids = self._load_valid_tags()

    def _load_valid_tags(self) -> Dict[str, str]:
        current_dir = os.path.dirname(os.path.abspath(__file__))
        tags_path = os.path.join(current_dir, "..", "data", "tags.json")
        try:
            with open(tags_path, 'r', encoding='utf-8') as f:
                return {tag["id"]: tag["label"] for tag in json.load(f)}
        except Exception:
            return {"restaurant": "restaurante"}

    # ── Helpers de Cálculo (Lógica de Dominio) ────────────────────────────────
    @staticmethod
    def _haversine(lat1, lon1, lat2, lon2):
        R = 6371.0
        dlat, dlon = math.radians(lat2-lat1), math.radians(lon2-lon1)
        a = math.sin(dlat/2)**2 + math.cos(math.radians(lat1))*math.cos(math.radians(lat2))*math.sin(dlon/2)**2
        return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1-a))

    @staticmethod
    def _dist_to_score(dist_km):
        return max(1.0, 5.0 - (dist_km / 10.0) * 4.0)

    @staticmethod
    def _bayesian_rating(v, r, m=10, c=3.5):
        return (v / (v + m)) * r + (m / (v + m)) * c

    @staticmethod
    def _pearson_similarity(c, o):
        if len(c) >= 2:
            mc, mo = sum(c)/len(c), sum(o)/len(o)
            num = sum((x-mc)*(y-mo) for x,y in zip(c, o))
            den = (sum((x-mc)**2 for x in c) * sum((y-mo)**2 for y in o))**0.5
            return num/den if den > 0 else 0.0
        return 0.4 if abs(c[0]-o[0]) < 0.5 else 0.0

    # ── Flujo Principal de Búsqueda ───────────────────────────────────────────
    async def search_restaurants(self, request: RecommendationRequest, user_id: str = None) -> Dict[str, Any]:
        # 1. Preparar consulta
        query_parts = []
        if request.categories:
            labels = [self._valid_tag_ids.get(cat, cat.replace("_", " ")) for cat in request.categories]
            query_parts.append(" OR ".join(labels))
        query_parts.append(f"restaurantes en {request.location}")
        
        # 2. Geocodificación (Delegada a Infraestructura)
        lat, lng = None, None
        geo_res = await google_places_client.geocode(request.location)
        if geo_res:
            lat, lng = geo_res["lat"], geo_res["lng"]

        # 3. Llamada a Google Places (Delegada a Infraestructura)
        loc_bias = None
        if lat and lng:
            loc_bias = {"circle": {"center": {"latitude": lat, "longitude": lng}, "radius": 30000.0}}

        eff_prices = list(request.prices)
        if request.include_unconfirmed_price:
            eff_prices.append("PRICE_LEVEL_UNSPECIFIED")

        search_res = await google_places_client.search_places(
            text_query=" ".join(query_parts),
            location_bias=loc_bias,
            price_levels=eff_prices,
            open_now=request.open_now,
            page_token=request.page_token,
            max_results=request.max_results
        )

        formatted = self._format_results(search_res["places"])

        # 4. Ordenación y Scoring
        sort_type = getattr(request, 'sort_by', 'recommended')
        if sort_type == 'distance' and lat:
            formatted.sort(key=lambda r: self._haversine(lat, lng, r.get("latitude") or lat, r.get("longitude") or lng))
        elif sort_type == 'recommended' and user_id:
            await self._sort_recommended(formatted, user_id, search_lat=lat, search_lng=lng)
        else:
            formatted.sort(key=lambda r: self._bayesian_rating(r.get("user_ratings_total") or 0, r.get("rating") or 0), reverse=True)

        return {"results": formatted, "next_page_token": search_res["next_page_token"]}

    def _fetch_user_db_features(self, db, user_id: str):
        res = db.execute(text("SELECT r.place_id, AVG((v.calidad+v.precio+v.higiene+v.trato)/4.0), AVG(v.precio) FROM valoraciones v JOIN restaurantes r ON v.restaurante_id = r.id WHERE v.user_id = :uid GROUP BY r.place_id"), {"uid": user_id}).fetchall()
        user_direct_scores = {row[0]: float(row[1]) for row in res}
        user_direct_price = {row[0]: float(row[2]) for row in res}
        user_favs = {row[0] for row in db.execute(text("SELECT r.place_id FROM favoritos f JOIN listas_favoritos l ON f.lista_id = l.id JOIN restaurantes r ON f.restaurante_id = r.id WHERE l.user_id = :uid"), {"uid": user_id}).fetchall()}
        
        res_cf = db.execute(text("SELECT v.user_id, r.place_id, AVG((v.calidad+v.precio+v.higiene+v.trato)/4.0) FROM valoraciones v JOIN restaurantes r ON v.restaurante_id = r.id WHERE v.user_id != :uid GROUP BY v.user_id, r.place_id"), {"uid": user_id}).fetchall()
        other_users = {}
        for row in res_cf:
            if row[0] not in other_users:
                other_users[row[0]] = {}
            other_users[row[0]][row[1]] = float(row[2])
        return user_direct_scores, user_direct_price, user_favs, other_users

    async def _fetch_missing_place_infos(self, user_direct_scores):
        all_info = {}
        if not user_direct_scores:
            return all_info
        all_info = await keras_api_client.get_restaurants_info(list(user_direct_scores.keys()))
        missing_ids = [pid for pid in user_direct_scores if pid not in all_info]
        if missing_ids:
            async def _f(pid):
                d = await google_places_client.get_place_details(pid)
                if d:
                    p_map = {"PRICE_LEVEL_FREE":0, "PRICE_LEVEL_INEXPENSIVE":1, "PRICE_LEVEL_MODERATE":2, "PRICE_LEVEL_EXPENSIVE":3, "PRICE_LEVEL_VERY_EXPENSIVE":4}
                    return pid, {"types": d.get("types", []), "price_level": p_map.get(d.get("priceLevel"), 2)}
                return pid, {"types": [], "price_level": 2}
            
            results = await asyncio.gather(*[_f(pid) for pid in missing_ids])
            for pid, info in results:
                all_info[pid] = info
        return all_info

    def _compute_collaborative_filtering(self, user_direct_scores, other_users):
        user_similarities = {}
        for ouid, rts in other_users.items():
            shared = set(user_direct_scores.keys()) & set(rts.keys())
            if not shared:
                continue
            c, o = [user_direct_scores[p] for p in shared], [rts[p] for p in shared]
            sim = self._pearson_similarity(c, o)
            if sim > 0.15:
                user_similarities[ouid] = sim
        return user_similarities

    async def _fetch_keras_normalized_scores(self, user_id, user_direct_scores, user_favs, formatted):
        p_map_k = {"PRICE_LEVEL_FREE":0, "PRICE_LEVEL_INEXPENSIVE":0, "PRICE_LEVEL_MODERATE":1, "PRICE_LEVEL_EXPENSIVE":2, "PRICE_LEVEL_VERY_EXPENSIVE":3}
        cands = [{"place_id":r["id"], "price_level":p_map_k.get(r.get("price_level"),1) if isinstance(r.get("price_level"),str) else (r.get("price_level") or 1), "rating":r.get("rating",3.5), "types":r.get("types",[])} for r in formatted]
        
        keras_raw = await keras_api_client.get_predictions({
            "user_id": user_id, 
            "avg_rating": sum(user_direct_scores.values())/len(user_direct_scores) if user_direct_scores else 3.5, 
            "num_val": len(user_direct_scores), 
            "user_favs": list(user_favs), 
            "es_finde": 0, "franja": 1, 
            "candidates": cands
        })

        keras_norm = {}
        if keras_raw:
            mi, ma = min(keras_raw.values()), max(keras_raw.values())
            rng = ma - mi
            keras_norm = {pid: 2.5 + 2.5 * (sc-mi)/rng if rng > 0.01 else 3.5 for pid, sc in keras_raw.items()}
        return keras_norm

    def _build_user_profiles(self, user_direct_scores, user_direct_price, all_info):
        type_scores_accum = {}
        high_price_ratings = []
        for pid, score in user_direct_scores.items():
            info = all_info.get(pid, {})
            for t in info.get("types", []):
                if t not in GENERIC_TYPES:
                    type_scores_accum.setdefault(t, []).append(score)
            if info.get("price_level", 2) >= 3:
                high_price_ratings.append(user_direct_price.get(pid, 3.0))

        user_type_profile = {t: sum(sc)/len(sc) for t, sc in type_scores_accum.items()}
        avg_price_at_expensive = sum(high_price_ratings)/len(high_price_ratings) if high_price_ratings else 3.5
        is_price_sensitive = avg_price_at_expensive < 3.0
        return user_type_profile, is_price_sensitive

    def _calculate_restaurant_score(
        self, r, user_direct_scores, user_type_profile, user_similarities,
        other_users, keras_norm, search_lat, search_lng, is_price_sensitive, user_favs
    ):
        pid = r["id"]
        r_types = set(r.get("types") or []) - GENERIC_TYPES
        google_r, keras_s = r.get("rating") or 3.5, keras_norm.get(pid, 3.5)

        if pid in user_direct_scores:
            direct = user_direct_scores[pid]
            return 0.80 * direct + 0.20 * google_r, f"direct({direct:.1f})"

        signals, weights = [keras_s, google_r], [0.10, 0.25]
        type_matches = [user_type_profile[t] for t in r_types if t in user_type_profile]
        if type_matches:
            t_avg = sum(type_matches) / len(type_matches)
            if t_avg < 2.5:
                t_avg *= 0.8
            signals.append(t_avg)
            weights.append(0.35)
        
        cf_p = [(sim, other_users[ouid][pid]) for ouid, sim in user_similarities.items() if pid in other_users.get(ouid, {})]
        if cf_p:
            signals.append(sum(s * sc for s, sc in cf_p) / sum(s for s, _ in cf_p))
            weights.append(0.25)
        
        if search_lat and r.get("latitude"):
            signals.append(self._dist_to_score(self._haversine(search_lat, search_lng, r["latitude"], r["longitude"])))
            weights.append(0.05)

        final = sum(s * (w / sum(weights)) for s, w in zip(signals, weights))
        p_map_i = {"PRICE_LEVEL_FREE": 0, "PRICE_LEVEL_INEXPENSIVE": 1, "PRICE_LEVEL_MODERATE": 2, "PRICE_LEVEL_EXPENSIVE": 3, "PRICE_LEVEL_VERY_EXPENSIVE": 4}
        p_int = p_map_i.get(r.get("price_level"), 2) if isinstance(r.get("price_level"), str) else (r.get("price_level") or 2)
        if is_price_sensitive and p_int >= 3:
            final *= 0.85
        if pid in user_favs:
            final = min(5.0, final + 0.25)
        
        return final, f"hybrid({len(type_matches)}types)"

    async def _sort_recommended(self, formatted: list, user_id: str, search_lat=None, search_lng=None):
        # ── PASO 1: Cargar datos del usuario (Capa DB)
        db = SessionLocal()
        try:
            user_direct_scores, user_direct_price, user_favs, other_users = self._fetch_user_db_features(db, user_id)
        finally:
            db.close()

        # ── PASO 2: Obtener Info de Keras/Google
        all_info = await self._fetch_missing_place_infos(user_direct_scores)

        # ── PASO 3: Construir perfiles
        user_type_profile, is_price_sensitive = self._build_user_profiles(
            user_direct_scores, user_direct_price, all_info
        )

        # ── PASO 4: Collaborative Filtering
        user_similarities = self._compute_collaborative_filtering(user_direct_scores, other_users)

        # ── PASO 5: Keras Scores
        keras_norm = await self._fetch_keras_normalized_scores(user_id, user_direct_scores, user_favs, formatted)

        # ── PASO 6: Scoring Final
        for r in formatted:
            final, source = self._calculate_restaurant_score(
                r, user_direct_scores, user_type_profile, user_similarities,
                other_users, keras_norm, search_lat, search_lng, is_price_sensitive, user_favs
            )
            r["hybrid_score"], r["score_source"] = round(final, 4), source

        formatted.sort(key=lambda x: x.get("hybrid_score", 0.0), reverse=True)

    def _format_results(self, places: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        EXCLUDED_TYPES = {"pharmacy", "supermarket", "store", "gas_station"}
        formatted = []
        for p in places:
            ts = p.get("types", [])
            if any(t in EXCLUDED_TYPES for t in ts) and not any(t in {"restaurant", "bar", "cafe"} or t.endswith("_restaurant") for t in ts): continue
            hours_info = p.get("regularOpeningHours") or {}
            formatted.append({
                "id": p.get("id"),
                "name": p.get("displayName", {}).get("text", "Sin nombre"),
                "address": p.get("formattedAddress"),
                "price_level": p.get("priceLevel"),
                "rating": p.get("rating"),
                "user_ratings_total": p.get("userRatingCount"),
                "types": ts,
                "main_photo": self._get_photo_url(p.get("photos", [])),
                "google_maps_uri": p.get("googleMapsUri"),
                "website_uri": p.get("websiteUri"),
                "latitude": p.get("location", {}).get("latitude"),
                "longitude": p.get("location", {}).get("longitude"),
                "phone_number": p.get("nationalPhoneNumber"),
                "opening_hours": hours_info.get("weekdayDescriptions") if isinstance(hours_info, dict) else None,
                "open_now": hours_info.get("openNow") if isinstance(hours_info, dict) else None
            })
        return formatted

    def _get_photo_url(self, photos: List[Dict[str, Any]]) -> str:
        if not photos or not photos[0].get("name"): return ""
        places_root = (settings.GOOGLE_PLACES_PHOTO_BASE_URL or settings.GOOGLE_PLACES_BASE_URL).rstrip("/")
        return f"{places_root}/{photos[0]['name']}/media?maxHeightPx=400&maxWidthPx=400&key={settings.GOOGLE_API_KEY}"

    async def _geocode_location(self, location: str):
        """Geocodifica una cadena de texto a coordenadas (lat, lng).
        
        Returns:
            Tuple (lat, lng) si la geocodificación fue exitosa, (None, None) en caso contrario.
        """
        geo_res = await google_places_client.geocode(location)
        if geo_res:
            return geo_res["lat"], geo_res["lng"]
        return None, None

    async def get_place_details(self, place_id: str) -> Dict[str, Any]:
        place = await google_places_client.get_place_details(place_id)
        if not place: return {}
        formatted = self._format_results([place])
        return formatted[0] if formatted else {}

recommendation_service = RecommendationService()
