import os
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    PROJECT_NAME: str = "TFG Backend API"
    API_V1_STR: str = "/api/v1"

    # Firebase
    FIREBASE_PROJECT_ID: str = "epi-devorapp"
    FIREBASE_API_KEY: str = ""
    FIREBASE_SERVICE_ACCOUNT_PATH: str = "firebase-service-account.json"
    # Identity Toolkit endpoint; docker-compose.dev.yml points it at the emulator.
    FIREBASE_AUTH_BASE_URL: str = "https://identitytoolkit.googleapis.com/v1"

    # Google Maps & OAuth
    GOOGLE_API_KEY: str = ""
    GOOGLE_CLIENT_ID: str = ""

    # Google Places / Geocoding endpoints; docker-compose.dev.yml points them at gplaces-mock.
    GOOGLE_PLACES_BASE_URL: str = os.getenv(
        "GOOGLE_PLACES_BASE_URL", "https://places.googleapis.com/v1"
    )
    GOOGLE_GEOCODE_URL: str = os.getenv(
        "GOOGLE_GEOCODE_URL", "https://maps.googleapis.com/maps/api/geocode/json"
    )
    # Photo URLs are loaded by the browser, so in dev they need the host-reachable mock
    # address. Empty means "same as GOOGLE_PLACES_BASE_URL".
    GOOGLE_PLACES_PHOTO_BASE_URL: str = os.getenv("GOOGLE_PLACES_PHOTO_BASE_URL", "")

    # PostgreSQL (SQLAlchemy) - Override via DATABASE_URL env var
    DATABASE_URL: str = os.getenv("DATABASE_URL", "postgresql://postgres:password@localhost:5432/tfg_db")

    # Microservicio IA (Keras)
    KERAS_API_URL: str = os.getenv("KERAS_API_URL", "https://keras-api:8001/predict")
    KERAS_API_KEY: str = ""

    # Only the dev stack turns this off (plain HTTP; API clients drop Secure cookies).
    COOKIE_SECURE: bool = True

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
