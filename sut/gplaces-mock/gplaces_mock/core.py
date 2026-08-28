# -*- coding: utf-8 -*-
"""Containerised stand-in for the Google Places API (New) and the Geocoding API.

It replicates the endpoints ``sut/backend/app/infrastructure/google_places_client.py``
actually calls, plus the photo-media URL built in
``recommendation_service._get_photo_url``:

    POST /v1/places:searchText              text search, paginated
    GET  /v1/places/{place_id}              place details
    GET  /v1/places/{id}/photos/{n}/media   photo bytes
    GET  /maps/api/geocode/json             address -> lat/lng

Responses keep Google's wire shape (camelCase, ``places``/``nextPageToken``,
``PRICE_LEVEL_*`` enums, geocoding ``status``) and honour ``X-Goog-FieldMask``,
so the backend's parsing code runs exactly as it does against Google.

The ``/__admin`` surface lets a test suite seed places, force error responses
and inspect what the SUT requested. See README.md.
"""
import base64
import json
import logging
import os
import time
from copy import deepcopy
from pathlib import Path
from typing import Any, Dict, List, Optional

from fastapi import Body, FastAPI, Header, Query, Response
from fastapi.responses import JSONResponse

from gplaces_mock.helpers import helpers

logger = logging.getLogger(__name__)

PACKAGE_DIR = Path(__file__).resolve().parent
DATASET_PATH = Path(os.getenv("PLACES_DATASET", PACKAGE_DIR / "data" / "places.json"))

# Google rejects a Places (New) call without a field mask; keeping that behaviour
# means a backend that forgets the header fails here as it would in production.
REQUIRE_FIELD_MASK = os.getenv("REQUIRE_FIELD_MASK", "true").lower() == "true"
# Off by default: the E2E stack passes a dummy key and the mock is not a gatekeeper.
REQUIRE_API_KEY = os.getenv("REQUIRE_API_KEY", "false").lower() == "true"
MAX_REQUEST_LOG = int(os.getenv("MAX_REQUEST_LOG", "500"))

# A valid 1x1 PNG, returned for every photo-media request.
PLACEHOLDER_PNG = base64.b64decode(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk"
    "+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="
)

app = FastAPI(
    title="gplaces-mock",
    description="Google Places API (New) and Geocoding mock for the DevorApp E2E phase.",
    version="2026.08.1",
)


def load_dataset() -> List[Dict[str, Any]]:
    """Read the fixture restaurants shipped with the package."""
    with open(DATASET_PATH, encoding="utf-8") as handle:
        return json.load(handle)


class MockState:
    """Everything a test can mutate through /__admin."""

    def __init__(self) -> None:
        self.places: List[Dict[str, Any]] = []
        self.requests: List[Dict[str, Any]] = []
        self.behaviour: Dict[str, Any] = {}
        self.reset()

    def reset(self) -> None:
        self.places = load_dataset()
        self.requests = []
        # force_status/force_empty/latency_ms let a spec drive the SUT's error paths.
        self.behaviour = {"force_status": None, "force_empty": False, "latency_ms": 0}
        logger.info("Mock state reset with %s places", len(self.places))

    def record(self, entry: Dict[str, Any]) -> None:
        self.requests.append(entry)
        if len(self.requests) > MAX_REQUEST_LOG:
            del self.requests[: len(self.requests) - MAX_REQUEST_LOG]


state = MockState()


def google_error(status_code: int, message: str, status: str) -> JSONResponse:
    """An error body shaped like the one the real API returns."""
    return JSONResponse(
        status_code=status_code,
        content={"error": {"code": status_code, "message": message, "status": status}},
    )


def guard(api_key: Optional[str], field_mask: Optional[str]) -> Optional[JSONResponse]:
    """Reproduce the two errors Google returns before it even looks at the query."""
    if REQUIRE_API_KEY and not api_key:
        return google_error(403, "The request is missing a valid API key.", "PERMISSION_DENIED")
    if REQUIRE_FIELD_MASK and not field_mask:
        return google_error(
            400,
            "Request must specify a field mask in the X-Goog-FieldMask header.",
            "INVALID_ARGUMENT",
        )
    return None


def apply_behaviour() -> Optional[JSONResponse]:
    """Honour the latency/failure knobs set through /__admin/behaviour."""
    if state.behaviour.get("latency_ms"):
        time.sleep(state.behaviour["latency_ms"] / 1000.0)
    forced = state.behaviour.get("force_status")
    if forced:
        return google_error(
            int(forced), "Forced failure requested via /__admin/behaviour.", "UNAVAILABLE"
        )
    return None


# ── Google Places API (New) ──────────────────────────────────────────────────

@app.post("/v1/places:searchText")
async def search_text(
    payload: Dict[str, Any] = Body(default_factory=dict),
    x_goog_api_key: Optional[str] = Header(default=None, alias="X-Goog-Api-Key"),
    x_goog_field_mask: Optional[str] = Header(default=None, alias="X-Goog-FieldMask"),
):
    """Text search, mirroring places:searchText."""
    state.record({"endpoint": "searchText", "payload": payload, "field_mask": x_goog_field_mask})

    rejected = guard(x_goog_api_key, x_goog_field_mask) or apply_behaviour()
    if rejected:
        return rejected

    if state.behaviour.get("force_empty"):
        return {"places": []}

    max_results = int(payload.get("maxResultCount") or 20)
    offset = helpers.decode_page_token(payload.get("pageToken"))

    matches = helpers.search(
        places=state.places,
        text_query=payload.get("textQuery") or "",
        price_levels=payload.get("priceLevels") or [],
        open_now=bool(payload.get("openNow")),
    )

    page = matches[offset: offset + max_results]
    fields = helpers.parse_field_mask(x_goog_field_mask, strip_prefix="places.")

    body: Dict[str, Any] = {"places": [helpers.project(place, fields) for place in page]}
    if offset + max_results < len(matches):
        body["nextPageToken"] = helpers.encode_page_token(offset + max_results)
    return body


@app.get("/v1/places/{place_id}")
async def place_details(
    place_id: str,
    x_goog_api_key: Optional[str] = Header(default=None, alias="X-Goog-Api-Key"),
    x_goog_field_mask: Optional[str] = Header(default=None, alias="X-Goog-FieldMask"),
):
    """Place details, mirroring GET /v1/places/{id}."""
    state.record({"endpoint": "placeDetails", "place_id": place_id, "field_mask": x_goog_field_mask})

    rejected = guard(x_goog_api_key, x_goog_field_mask) or apply_behaviour()
    if rejected:
        return rejected

    for place in state.places:
        if place["id"] == place_id:
            return helpers.project(place, helpers.parse_field_mask(x_goog_field_mask))

    return google_error(404, f"Place not found: {place_id}", "NOT_FOUND")


@app.get("/v1/places/{place_id}/photos/{photo_id}/media")
async def photo_media(place_id: str, photo_id: str, key: Optional[str] = Query(default=None)):
    """Bytes behind the URL recommendation_service builds for main_photo."""
    state.record({"endpoint": "photoMedia", "place_id": place_id, "photo_id": photo_id})
    return Response(content=PLACEHOLDER_PNG, media_type="image/png")


# ── Google Geocoding API ─────────────────────────────────────────────────────

@app.get("/maps/api/geocode/json")
async def geocode(address: str = Query(default=""), key: Optional[str] = Query(default=None)):
    """Address to coordinates, mirroring the legacy geocoding endpoint."""
    state.record({"endpoint": "geocode", "address": address})

    forced = apply_behaviour()
    if forced:
        return forced

    coords = helpers.geocode_city(address)
    if not coords:
        return {"status": "ZERO_RESULTS", "results": []}

    return {
        "status": "OK",
        "results": [
            {
                "formatted_address": address,
                "geometry": {"location": coords, "location_type": "APPROXIMATE"},
                "place_id": f"MOCK_GEOCODE_{helpers.normalise(address).strip().upper()}",
                "types": ["locality", "political"],
            }
        ],
    }


# ── Operational and test-control surface ─────────────────────────────────────

@app.get("/health")
async def health():
    """Readiness probe, polled by the E2E startup action."""
    return {"status": "ok", "places": len(state.places), "requests": len(state.requests)}


@app.post("/__admin/reset")
async def admin_reset():
    """Restore the on-disk dataset and clear the log. Call between specs."""
    state.reset()
    return {"status": "reset", "places": len(state.places)}


@app.get("/__admin/requests")
async def admin_requests(endpoint: Optional[str] = Query(default=None)):
    """What the SUT asked for, so a spec can assert the backend hit Places at all."""
    entries = state.requests
    if endpoint:
        entries = [entry for entry in entries if entry["endpoint"] == endpoint]
    return {"count": len(entries), "requests": entries}


@app.put("/__admin/places")
async def admin_set_places(places: List[Dict[str, Any]] = Body(...)):
    """Replace the dataset, e.g. to drive a 'no results' or single-result scenario."""
    state.places = deepcopy(places)
    logger.info("Dataset replaced through /__admin/places: %s places", len(state.places))
    return {"status": "ok", "places": len(state.places)}


@app.put("/__admin/behaviour")
async def admin_behaviour(behaviour: Dict[str, Any] = Body(...)):
    """Set force_status (int), force_empty (bool) or latency_ms (int)."""
    for key in ("force_status", "force_empty", "latency_ms"):
        if key in behaviour:
            state.behaviour[key] = behaviour[key]
    logger.info("Behaviour updated: %s", state.behaviour)
    return {"status": "ok", "behaviour": state.behaviour}
