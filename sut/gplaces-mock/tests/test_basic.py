# -*- coding: utf-8 -*-
"""Pins the wire contract the DevorApp backend depends on.

Google's camelCase shape, the X-Goog-FieldMask projection, the price/openNow
filters and the paging token are all asserted here: if one of them drifts, the
E2E stages would fail for a reason that has nothing to do with the SUT.
"""
import logging
import unittest

from fastapi.testclient import TestClient

import gplaces_mock

logger = logging.getLogger(__name__)

SEARCH_MASK = (
    "places.id,places.displayName,places.formattedAddress,places.nationalPhoneNumber,"
    "places.priceLevel,places.rating,places.userRatingCount,places.types,places.photos,"
    "places.googleMapsUri,places.websiteUri,places.regularOpeningHours,places.location,"
    "nextPageToken"
)
DETAILS_MASK = (
    "id,displayName,formattedAddress,nationalPhoneNumber,priceLevel,rating,"
    "userRatingCount,types,photos,googleMapsUri,websiteUri,regularOpeningHours,location"
)
SEARCH_HEADERS = {"X-Goog-Api-Key": "dummy_google_key", "X-Goog-FieldMask": SEARCH_MASK}
DETAILS_HEADERS = {"X-Goog-Api-Key": "dummy_google_key", "X-Goog-FieldMask": DETAILS_MASK}


class MockTestCase(unittest.TestCase):
    """Shared client that restores the shipped dataset around every test."""

    def setUp(self):
        self.client = TestClient(gplaces_mock.app)
        self.client.post("/__admin/reset")

    def tearDown(self):
        self.client.post("/__admin/reset")

    def search(self, query, **payload):
        body = {"textQuery": query, "maxResultCount": 20, "languageCode": "es"}
        body.update(payload)
        return self.client.post("/v1/places:searchText", json=body, headers=SEARCH_HEADERS)


class SearchTextTestSuite(MockTestCase):
    """places:searchText, the call behind the recommendation screen."""

    def test_health_reports_dataset_size(self):
        logger.debug("Starting the test: " + self._testMethodName)
        body = self.client.get("/health").json()
        assert body["status"] == "ok"
        assert body["places"] > 0
        logger.debug("Ending the test: " + self._testMethodName)

    def test_search_returns_only_places_of_the_requested_city(self):
        logger.debug("Starting the test: " + self._testMethodName)
        body = self.search("restaurantes en Gijón").json()
        assert body["places"], "the base scenario must return the whole town"
        for place in body["places"]:
            assert "Gijón" in place["formattedAddress"]
        logger.debug("Ending the test: " + self._testMethodName)

    def test_search_narrows_by_category_label(self):
        logger.debug("Starting the test: " + self._testMethodName)
        body = self.search("Pizzería restaurantes en Gijón").json()
        assert [p["displayName"]["text"] for p in body["places"]] == ["Pizzería Bella Napoli"]
        logger.debug("Ending the test: " + self._testMethodName)

    def test_search_honours_the_field_mask(self):
        logger.debug("Starting the test: " + self._testMethodName)
        response = self.client.post(
            "/v1/places:searchText",
            json={"textQuery": "restaurantes en Gijón"},
            headers={"X-Goog-Api-Key": "k", "X-Goog-FieldMask": "places.id,places.rating"},
        )
        for place in response.json()["places"]:
            assert set(place) <= {"id", "rating"}
        logger.debug("Ending the test: " + self._testMethodName)

    def test_search_without_field_mask_is_rejected_like_google(self):
        logger.debug("Starting the test: " + self._testMethodName)
        response = self.client.post(
            "/v1/places:searchText",
            json={"textQuery": "restaurantes en Gijón"},
            headers={"X-Goog-Api-Key": "k"},
        )
        assert response.status_code == 400
        assert response.json()["error"]["status"] == "INVALID_ARGUMENT"
        logger.debug("Ending the test: " + self._testMethodName)

    def test_search_filters_by_price_level(self):
        logger.debug("Starting the test: " + self._testMethodName)
        body = self.search(
            "restaurantes en Gijón", priceLevels=["PRICE_LEVEL_VERY_EXPENSIVE"]
        ).json()
        assert [p["displayName"]["text"] for p in body["places"]] == ["Restaurante Auga"]
        logger.debug("Ending the test: " + self._testMethodName)

    def test_unspecified_price_level_includes_places_without_a_price(self):
        logger.debug("Starting the test: " + self._testMethodName)
        without = self.search(
            "restaurantes en Gijón", priceLevels=["PRICE_LEVEL_MODERATE"]
        ).json()
        with_unpriced = self.search(
            "restaurantes en Gijón",
            priceLevels=["PRICE_LEVEL_MODERATE", "PRICE_LEVEL_UNSPECIFIED"],
        ).json()

        assert "MOCK_GIJON_KEBAB_008" not in {p["id"] for p in without["places"]}
        assert "MOCK_GIJON_KEBAB_008" in {p["id"] for p in with_unpriced["places"]}
        logger.debug("Ending the test: " + self._testMethodName)

    def test_search_filters_by_open_now(self):
        logger.debug("Starting the test: " + self._testMethodName)
        body = self.search("restaurantes en Gijón", openNow=True).json()
        assert body["places"]
        for place in body["places"]:
            assert place["regularOpeningHours"]["openNow"] is True
        logger.debug("Ending the test: " + self._testMethodName)

    def test_search_paginates_with_next_page_token(self):
        logger.debug("Starting the test: " + self._testMethodName)
        first = self.search("restaurantes en Gijón", maxResultCount=2).json()
        assert len(first["places"]) == 2
        assert "nextPageToken" in first

        second = self.search(
            "restaurantes en Gijón", maxResultCount=2, pageToken=first["nextPageToken"]
        ).json()
        first_ids = {p["id"] for p in first["places"]}
        assert first_ids.isdisjoint({p["id"] for p in second["places"]})
        logger.debug("Ending the test: " + self._testMethodName)

    def test_last_page_has_no_next_page_token(self):
        logger.debug("Starting the test: " + self._testMethodName)
        assert "nextPageToken" not in self.search("restaurantes en Gijón", maxResultCount=50).json()
        logger.debug("Ending the test: " + self._testMethodName)

    def test_city_known_only_to_the_geocoder_yields_no_places(self):
        logger.debug("Starting the test: " + self._testMethodName)
        assert self.search("restaurantes en Madrid").json()["places"] == []
        logger.debug("Ending the test: " + self._testMethodName)

    def test_non_food_place_is_still_returned_for_the_backend_to_filter(self):
        """EXCLUDED_TYPES lives in the SUT, so the mock must not pre-filter it."""
        logger.debug("Starting the test: " + self._testMethodName)
        body = self.search("Farmacia restaurantes en Gijón").json()
        assert [p["id"] for p in body["places"]] == ["MOCK_GIJON_FARMACIA_012"]
        logger.debug("Ending the test: " + self._testMethodName)


class PlaceDetailsTestSuite(MockTestCase):
    """GET /v1/places/{id} and the photo-media URL built by the backend."""

    def test_place_details_returns_the_place(self):
        logger.debug("Starting the test: " + self._testMethodName)
        response = self.client.get(
            "/v1/places/MOCK_GIJON_SIDRERIA_001", headers=DETAILS_HEADERS
        )
        assert response.status_code == 200
        body = response.json()
        assert body["id"] == "MOCK_GIJON_SIDRERIA_001"
        assert body["displayName"]["text"] == "Sidrería El Llagar de Cimavilla"
        assert "_mock" not in body
        logger.debug("Ending the test: " + self._testMethodName)

    def test_place_details_unknown_id_is_404(self):
        logger.debug("Starting the test: " + self._testMethodName)
        response = self.client.get("/v1/places/does-not-exist", headers=DETAILS_HEADERS)
        assert response.status_code == 404
        assert response.json()["error"]["status"] == "NOT_FOUND"
        logger.debug("Ending the test: " + self._testMethodName)

    def test_photo_media_returns_a_png(self):
        logger.debug("Starting the test: " + self._testMethodName)
        response = self.client.get(
            "/v1/places/MOCK_GIJON_SIDRERIA_001/photos/photo-1/media?maxHeightPx=400"
        )
        assert response.status_code == 200
        assert response.headers["content-type"] == "image/png"
        assert response.content.startswith(b"\x89PNG")
        logger.debug("Ending the test: " + self._testMethodName)


class GeocodeTestSuite(MockTestCase):
    """The legacy geocoding endpoint the backend uses for the location bias."""

    def test_geocode_known_city(self):
        logger.debug("Starting the test: " + self._testMethodName)
        body = self.client.get(
            "/maps/api/geocode/json", params={"address": "Gijón", "key": "k"}
        ).json()
        assert body["status"] == "OK"
        assert body["results"][0]["geometry"]["location"] == {"lat": 43.5322, "lng": -5.6611}
        logger.debug("Ending the test: " + self._testMethodName)

    def test_geocode_is_accent_insensitive(self):
        logger.debug("Starting the test: " + self._testMethodName)
        body = self.client.get("/maps/api/geocode/json", params={"address": "gijon"}).json()
        assert body["status"] == "OK"
        logger.debug("Ending the test: " + self._testMethodName)

    def test_geocode_unknown_address(self):
        logger.debug("Starting the test: " + self._testMethodName)
        body = self.client.get(
            "/maps/api/geocode/json", params={"address": "Lugar inventado XYZ"}
        ).json()
        assert body["status"] == "ZERO_RESULTS"
        assert body["results"] == []
        logger.debug("Ending the test: " + self._testMethodName)


class AdminTestSuite(MockTestCase):
    """The /__admin surface an E2E spec drives to set up its scenario."""

    def test_requests_are_recorded_for_assertions(self):
        logger.debug("Starting the test: " + self._testMethodName)
        self.search("restaurantes en Gijón")
        self.client.get("/maps/api/geocode/json", params={"address": "Gijón"})

        body = self.client.get("/__admin/requests", params={"endpoint": "searchText"}).json()
        assert body["count"] == 1
        assert body["requests"][0]["payload"]["textQuery"] == "restaurantes en Gijón"
        logger.debug("Ending the test: " + self._testMethodName)

    def test_force_empty_drives_the_no_results_path(self):
        logger.debug("Starting the test: " + self._testMethodName)
        self.client.put("/__admin/behaviour", json={"force_empty": True})
        assert self.search("restaurantes en Gijón").json()["places"] == []
        logger.debug("Ending the test: " + self._testMethodName)

    def test_force_status_drives_the_api_error_path(self):
        logger.debug("Starting the test: " + self._testMethodName)
        self.client.put("/__admin/behaviour", json={"force_status": 503})
        assert self.search("restaurantes en Gijón").status_code == 503
        logger.debug("Ending the test: " + self._testMethodName)

    def test_admin_places_replaces_the_dataset(self):
        logger.debug("Starting the test: " + self._testMethodName)
        self.client.put("/__admin/places", json=[])
        assert self.search("restaurantes en Gijón").json()["places"] == []
        self.client.post("/__admin/reset")
        assert self.search("restaurantes en Gijón").json()["places"]
        logger.debug("Ending the test: " + self._testMethodName)

    def test_reset_clears_forced_behaviour(self):
        logger.debug("Starting the test: " + self._testMethodName)
        self.client.put("/__admin/behaviour", json={"force_status": 500})
        self.client.post("/__admin/reset")
        assert self.search("restaurantes en Gijón").status_code == 200
        logger.debug("Ending the test: " + self._testMethodName)


if __name__ == '__main__':
    unittest.main()
