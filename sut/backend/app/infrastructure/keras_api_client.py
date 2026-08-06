import httpx
from typing import List, Dict, Any, Optional
from app.core.config import settings

class KerasApiClient:
    def __init__(self):
        self.base_url = settings.KERAS_API_URL.rsplit("/predict", 1)[0]
        self.predict_url = settings.KERAS_API_URL
        self.headers = {"x-api-key": settings.KERAS_API_KEY}

    async def get_restaurants_info(self, place_ids: List[str]) -> Dict[str, Any]:
        """Consulta metadatos (tipos/precios) al microservicio de IA."""
        try:
            async with httpx.AsyncClient() as client:
                resp = await client.post(
                    f"{self.base_url}/info", 
                    headers=self.headers, 
                    json={"place_ids": place_ids}, 
                    timeout=5.0
                )
                if resp.status_code == 200:
                    return resp.json().get("info", {})
        except Exception as e:
            print(f"Keras Info Error: {e}")
        return {}

    async def get_predictions(self, payload: Dict[str, Any]) -> Dict[str, float]:
        """Obtiene las predicciones de rating de la IA para un lote de candidatos."""
        try:
            async with httpx.AsyncClient() as client:
                resp = await client.post(
                    self.predict_url, 
                    headers=self.headers, 
                    json=payload, 
                    timeout=15.0
                )
                if resp.status_code == 200:
                    results = resp.json().get("results", [])
                    return {item["place_id"]: item["predicted_rating"] for item in results}
        except Exception as e:
            print(f"Keras Predict Error: {e}")
        return {}

keras_api_client = KerasApiClient()
