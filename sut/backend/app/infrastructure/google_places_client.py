import httpx
from typing import List, Dict, Any, Optional
from app.core.config import settings

class GooglePlacesClient:
    def __init__(self):
        self.api_key = settings.GOOGLE_API_KEY
        self.base_url = "https://places.googleapis.com/v1/places:searchText"
        self.details_url = "https://places.googleapis.com/v1/places/"
        self.geocode_url = "https://maps.googleapis.com/maps/api/geocode/json"

    async def geocode(self, location: str) -> Optional[Dict[str, float]]:
        try:
            async with httpx.AsyncClient() as client:
                resp = await client.get(
                    f"{self.geocode_url}?address={location}&key={self.api_key}",
                    timeout=5.0
                )
                if resp.status_code == 200:
                    data = resp.json()
                    if data.get("results"):
                        return data["results"][0]["geometry"]["location"]
        except (httpx.TimeoutException, httpx.RequestError) as e:
            print(f"[GooglePlacesClient] geocode timeout/error for '{location}': {e}")
        return None


    async def search_places(self, text_query: str, location_bias: Optional[Dict] = None, 
                             price_levels: Optional[List[str]] = None, 
                             open_now: bool = False, 
                             page_token: Optional[str] = None,
                             max_results: int = 20) -> Dict[str, Any]:
        
        headers = {
            "Content-Type": "application/json",
            "X-Goog-Api-Key": self.api_key,
            "X-Goog-FieldMask": "places.id,places.displayName,places.formattedAddress,places.nationalPhoneNumber,places.priceLevel,places.rating,places.userRatingCount,places.types,places.photos,places.googleMapsUri,places.websiteUri,places.regularOpeningHours,places.location,nextPageToken"
        }

        payload: Dict[str, Any] = {
            "textQuery": text_query,
            "maxResultCount": max_results,
            "languageCode": "es"
        }

        if location_bias:
            payload["locationBias"] = location_bias
        if page_token:
            payload["pageToken"] = page_token
        if price_levels:
            payload["priceLevels"] = price_levels
        if open_now:
            payload["openNow"] = True

        async with httpx.AsyncClient() as client:
            resp = await client.post(self.base_url, headers=headers, json=payload, timeout=10.0)
            if resp.status_code != 200:
                print(f"Google API Error: {resp.text}")
                return {"places": [], "next_page_token": None}
            
            data = resp.json()
            return {
                "places": data.get("places", []),
                "next_page_token": data.get("nextPageToken")
            }

    async def get_place_details(self, place_id: str) -> Optional[Dict[str, Any]]:
        headers = {
            "Content-Type": "application/json",
            "X-Goog-Api-Key": self.api_key,
            "X-Goog-FieldMask": "id,displayName,formattedAddress,nationalPhoneNumber,priceLevel,rating,userRatingCount,types,photos,googleMapsUri,websiteUri,regularOpeningHours,location"
        }
        async with httpx.AsyncClient() as client:
            resp = await client.get(f"{self.details_url}{place_id}", headers=headers, timeout=10.0)
            if resp.status_code == 200:
                return resp.json()
        return None

google_places_client = GooglePlacesClient()
