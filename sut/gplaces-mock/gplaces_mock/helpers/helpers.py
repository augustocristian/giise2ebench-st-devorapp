# -*- coding: utf-8 -*-
"""Pure helpers behind the mocked Google endpoints.

Everything here is side-effect free: the dataset is always passed in, so the
search and projection rules can be unit tested without standing up the app.
"""
import base64
import logging
import re
import unicodedata
from typing import Any, Dict, List, Optional

logger = logging.getLogger(__name__)

# Geocoding fixtures. Anything not listed answers ZERO_RESULTS, which is what the
# backend treats as "no location bias".
CITY_COORDS: Dict[str, Dict[str, float]] = {
    "gijon": {"lat": 43.5322, "lng": -5.6611},
    "xixon": {"lat": 43.5322, "lng": -5.6611},
    "oviedo": {"lat": 43.3619, "lng": -5.8494},
    "uvieu": {"lat": 43.3619, "lng": -5.8494},
    "aviles": {"lat": 43.5547, "lng": -5.9248},
    "asturias": {"lat": 43.3614, "lng": -5.8593},
    "madrid": {"lat": 40.4168, "lng": -3.7038},
    "barcelona": {"lat": 41.3874, "lng": 2.1686},
    "valencia": {"lat": 39.4699, "lng": -0.3763},
    "sevilla": {"lat": 37.3891, "lng": -5.9845},
    "bilbao": {"lat": 43.2630, "lng": -2.9350},
    "santander": {"lat": 43.4623, "lng": -3.8100},
    "leon": {"lat": 42.5987, "lng": -5.5671},
}

# Boilerplate the app always wraps around the category labels it derives from
# backend/app/data/tags.json ("<labels> restaurantes en <location>").
STOPWORDS = {
    "restaurantes", "restaurante", "en", "or", "de", "del", "la", "el", "los",
    "las", "y", "a", "para", "con", "un", "una", "cerca", "mejores", "mejor",
}

UNSPECIFIED_PRICE = "PRICE_LEVEL_UNSPECIFIED"


def normalise(text: str) -> str:
    """Lowercase and strip accents so 'Gijón' and 'gijon' are the same token."""
    decomposed = unicodedata.normalize("NFD", text.lower())
    return "".join(ch for ch in decomposed if unicodedata.category(ch) != "Mn")


def public_fields(place: Dict[str, Any]) -> Dict[str, Any]:
    """Drop the mock-only bookkeeping before answering."""
    return {key: value for key, value in place.items() if key != "_mock"}


def parse_field_mask(raw: Optional[str], strip_prefix: Optional[str] = None) -> Optional[set]:
    """Turn an X-Goog-FieldMask header into the set of top-level fields to keep."""
    if not raw:
        return None
    fields = set()
    for item in (part.strip() for part in raw.split(",")):
        if not item:
            continue
        if strip_prefix:
            if item.startswith(strip_prefix):
                item = item[len(strip_prefix):]
            else:
                # e.g. `nextPageToken`: a response field, not a place field.
                continue
        fields.add(item.split(".")[0])
    return fields or None


def project(place: Dict[str, Any], fields: Optional[set]) -> Dict[str, Any]:
    """Apply a field-mask projection, as the real API does."""
    visible = public_fields(place)
    if not fields or "*" in fields:
        return visible
    return {key: value for key, value in visible.items() if key in fields}


def haystack(place: Dict[str, Any]) -> str:
    """The text a query is matched against: name, Google types and Spanish labels."""
    mock = place.get("_mock", {})
    parts = [
        place.get("displayName", {}).get("text", ""),
        " ".join(place.get("types", [])),
        " ".join(mock.get("keywords", [])),
    ]
    return normalise(" ".join(parts)).replace("_", " ")


def match_city(query: str, places: List[Dict[str, Any]]) -> Optional[str]:
    """The city named in the query, whether or not the dataset covers it."""
    known = {place.get("_mock", {}).get("city", "") for place in places} | set(CITY_COORDS)
    for city in sorted((city for city in known if city), key=len, reverse=True):
        if city in query:
            return city
    return None


def search(places: List[Dict[str, Any]], text_query: str,
           price_levels: Optional[List[str]] = None,
           open_now: bool = False) -> List[Dict[str, Any]]:
    """Rank the dataset against a textQuery the way searchText would."""
    query = normalise(text_query)
    city = match_city(query, places)

    candidates = places
    residual = query
    if city:
        # A city the dataset knows narrows the results; a city it only geocodes
        # (Madrid, Barcelona...) legitimately has nothing, which is how a spec
        # drives the "no results for this location" path.
        candidates = [p for p in candidates if p.get("_mock", {}).get("city") == city]
        residual = residual.replace(city, " ")

    terms = [term for term in re.split(r"[^a-z0-9]+", residual) if term and term not in STOPWORDS]

    scored = []
    for place in candidates:
        text = haystack(place)
        if terms:
            score = sum(1 for term in terms if term in text)
            if score == 0:
                continue
        else:
            score = 0  # plain "restaurantes en <city>": everything in town qualifies.
        scored.append((score, place.get("rating") or 0, place))

    if price_levels:
        allowed = set(price_levels)
        keep_unpriced = UNSPECIFIED_PRICE in allowed
        scored = [
            row for row in scored
            if row[2].get("priceLevel") in allowed
            or (keep_unpriced and not row[2].get("priceLevel"))
        ]

    if open_now:
        scored = [
            row for row in scored
            if (row[2].get("regularOpeningHours") or {}).get("openNow") is True
        ]

    scored.sort(key=lambda row: (row[0], row[1]), reverse=True)
    logger.debug("Query '%s' matched %s places", text_query, len(scored))
    return [row[2] for row in scored]


def encode_page_token(offset: int) -> str:
    return base64.urlsafe_b64encode(f"offset:{offset}".encode()).decode().rstrip("=")


def decode_page_token(token: Optional[str]) -> int:
    if not token:
        return 0
    try:
        padded = token + "=" * (-len(token) % 4)
        return int(base64.urlsafe_b64decode(padded.encode()).decode().split(":")[1])
    except (ValueError, IndexError, UnicodeDecodeError):
        logger.warning("Unreadable pageToken '%s', starting from the first page", token)
        return 0


def geocode_city(address: str) -> Optional[Dict[str, float]]:
    """Coordinates for a known city name, or None for ZERO_RESULTS."""
    normalised = normalise(address)
    for city, coords in CITY_COORDS.items():
        if city in normalised:
            return coords
    return None
