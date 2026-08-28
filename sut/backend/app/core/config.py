import os
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    PROJECT_NAME: str = "TFG Backend API"
    API_V1_STR: str = "/api/v1"

    # Firebase
    FIREBASE_PROJECT_ID: str = "epi-devorapp"
    FIREBASE_API_KEY: str = ""
    FIREBASE_SERVICE_ACCOUNT_PATH: str = "firebase-service-account.json"

    # Google Maps & OAuth
    GOOGLE_API_KEY: str = ""
    GOOGLE_CLIENT_ID: str = ""

    # Google Places / Geocoding endpoints. Defaults hit Google; the E2E stack
    # points them at the gplaces-mock container (see docker-compose.e2e.yml).
    GOOGLE_PLACES_BASE_URL: str = os.getenv(
        "GOOGLE_PLACES_BASE_URL", "https://places.googleapis.com/v1"
    )
    GOOGLE_GEOCODE_URL: str = os.getenv(
        "GOOGLE_GEOCODE_URL", "https://maps.googleapis.com/maps/api/geocode/json"
    )
    # Photo URLs are resolved by the browser, not by the backend, so under the
    # E2E stack they need the host-reachable address of the mock rather than its
    # compose-network name. Empty means "same as GOOGLE_PLACES_BASE_URL".
    GOOGLE_PLACES_PHOTO_BASE_URL: str = os.getenv("GOOGLE_PLACES_PHOTO_BASE_URL", "")

    # PostgreSQL (SQLAlchemy) - Override via DATABASE_URL env var
    DATABASE_URL: str = os.getenv("DATABASE_URL", "postgresql://postgres:password@localhost:5432/tfg_db")

    # Microservicio IA (Keras)
    KERAS_API_URL: str = os.getenv("KERAS_API_URL", "https://keras-api:8001/predict")
    KERAS_API_KEY: str = ""

    # Test helpers
    SKIP_EMAIL_VERIFICATION: bool = False

    # JWT
    SECRET_KEY: str = os.getenv(
        "SECRET_KEY", "CAMBIA_ESTO_EN_PRODUCCION_usa_openssl_rand_hex_32"
    )
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60

    class Config:
        env_file = ".env"
        case_sensitive = True


settings = Settings()
