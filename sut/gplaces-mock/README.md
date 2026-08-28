# gplaces-mock

A containerised stand-in for the **Google Places API (New)** and the **Google
Geocoding API**, so the DevorApp E2E phase can exercise restaurant search,
details and recommendations without ever calling Google — no API key, no quota,
no billing, and above all no non-deterministic results.

## Why it exists

`sut/backend/app/infrastructure/google_places_client.py` reaches Google on three
endpoints, and `recommendation_service._get_photo_url` builds a fourth URL that
the browser loads directly. Every one of them is a source of flakiness in an E2E
run: results change, opening hours change, quota runs out. This service answers
all four with a fixed dataset.

It is a **server-side** replacement. The frontend's location autocomplete uses
the Google Maps JavaScript SDK in the browser, which both suites already stub
(`cypress-js`'s `support/commands/mocks.js`, `selenium-java`'s
`BaseLoggedClass#injectAutocompleteMock`) — that is a separate concern and is
untouched here.

## Endpoints

| Method | Path | Mirrors |
|---|---|---|
| `POST` | `/v1/places:searchText` | Places (New) text search, paginated |
| `GET` | `/v1/places/{place_id}` | Places (New) place details |
| `GET` | `/v1/places/{id}/photos/{n}/media` | Places (New) photo bytes (a 1×1 PNG) |
| `GET` | `/maps/api/geocode/json` | Legacy Geocoding API |
| `GET` | `/health` | Readiness probe |

Responses keep Google's wire shape — camelCase fields, `places` /
`nextPageToken`, `PRICE_LEVEL_*` enums, geocoding `status` — and honour
`X-Goog-FieldMask`, so the backend's parsing code runs exactly as it does in
production. Requests without a field mask are rejected with `INVALID_ARGUMENT`,
as Google does.

What it deliberately does **not** do is pre-filter non-food results: the
`EXCLUDED_TYPES` rule lives in the SUT, so the dataset ships a pharmacy for that
branch to act on.

## Dataset

`gplaces_mock/data/places.json` holds 12 fixture places across Gijón, Oviedo and
Avilés, chosen to cover the equivalence classes the Base-Choice suites need:

- every `PRICE_LEVEL_*` value, plus one place with **no** price at all
  (only returned when `PRICE_LEVEL_UNSPECIFIED` is in `priceLevels`);
- open and closed places, for the `openNow` filter;
- one place with no phone, no website and no photos, for the optional-field paths;
- one pharmacy, which the backend must drop.

Geocoding knows the three Asturian cities in the dataset plus a handful of other
Spanish cities. A city it can geocode but has no restaurants for (Madrid,
Barcelona…) returns an empty result set — that is the "no results for this
location" scenario. Any other address answers `ZERO_RESULTS`.

## Test-control surface

`/__admin` lets a spec set up its scenario and assert on what the SUT did:

| Method | Path | Use |
|---|---|---|
| `POST` | `/__admin/reset` | Restore the shipped dataset and clear the log. Call between specs. |
| `GET` | `/__admin/requests?endpoint=searchText` | What the SUT requested, to assert it hit Places at all. |
| `PUT` | `/__admin/places` | Replace the dataset (`[]` drives "no results"). |
| `PUT` | `/__admin/behaviour` | `force_status`, `force_empty`, `latency_ms` to drive error and timeout paths. |

```bash
# Force the backend's "Google is down" path
curl -X PUT http://localhost:8002/__admin/behaviour \
     -H 'Content-Type: application/json' -d '{"force_status": 503}'
```

## Running it

Within the E2E stack, `docker-compose.e2e.yml` starts it and repoints the
backend, so nothing else is needed:

```bash
cd sut
docker compose -f docker-compose.yml -f docker-compose.e2e.yml up -d
```

That sets three backend variables, all of which default to the real Google
endpoints when unset:

| Variable | E2E value |
|---|---|
| `GOOGLE_PLACES_BASE_URL` | `http://gplaces-mock:8002/v1` |
| `GOOGLE_GEOCODE_URL` | `http://gplaces-mock:8002/maps/api/geocode/json` |
| `GOOGLE_PLACES_PHOTO_BASE_URL` | `http://localhost:8002/v1` |

The photo variable is separate because photo URLs are handed to the **browser**,
which resolves `localhost`, while the backend's own calls travel over the compose
network as `gplaces-mock`.

Standalone, for development:

```bash
cd sut/gplaces-mock
poetry install
poetry run uvicorn gplaces_mock.core:app --port 8002
poetry run pytest
```

## Configuration

| Variable | Default | Meaning |
|---|---|---|
| `PLACES_DATASET` | packaged `data/places.json` | Path to an alternative dataset. |
| `REQUIRE_FIELD_MASK` | `true` | Reject calls without `X-Goog-FieldMask`, as Google does. |
| `REQUIRE_API_KEY` | `false` | Reject calls without `X-Goog-Api-Key`. |
| `MAX_REQUEST_LOG` | `500` | Requests retained for `/__admin/requests`. |
