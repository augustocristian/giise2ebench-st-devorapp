from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.core.config import settings
from app.presentation.routers import auth_router, recommendation_router, history_router, favorites_router, saved_for_later_router, ratings_router
from app.infrastructure.firebase.firebase_admin import get_firebase_app
import os

# Initialize Firebase before accepting requests
get_firebase_app()

app = FastAPI(
    title=settings.PROJECT_NAME,
    openapi_url="/openapi.json",
)

# Required so the React frontend can call the backend
_extra_origins = [o.strip() for o in os.getenv("EXTRA_ORIGINS", "").split(",") if o.strip()]
_allowed_origins = [
    "https://localhost:5173",
    "https://127.0.0.1:5173",
    "http://localhost:5173",
    "http://localhost",
    "https://localhost",
    "capacitor://localhost",
    # For local development without TLS, add http://localhost:5173 to EXTRA_ORIGINS
] + _extra_origins

app.add_middleware(
    CORSMiddleware,
    allow_origins=_allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

from starlette.middleware.base import BaseHTTPMiddleware
from fastapi import Request

class DebugMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        if request.method == "OPTIONS" or "/sessions" in request.url.path:
            print(f"\n--- [DEBUG] NEW REQUEST ---")
            print(f"Method: {request.method}")
            print(f"Path: {request.url.path}")
            print("Headers:")
            for key, value in request.headers.items():
                print(f"  {key}: {value}")
            print("-----------------------------\n")
        return await call_next(request)

app.add_middleware(DebugMiddleware)

# Registrar rutas
app.include_router(auth_router.router)
app.include_router(recommendation_router.router)
app.include_router(history_router.router)
app.include_router(favorites_router.router)
app.include_router(saved_for_later_router.router)
app.include_router(ratings_router.router)

@app.get("/")
def read_root():
    return {"message": "Bienvenido a la API del TFG"}

@app.get("/health")
def health_check():
    return {"status": "ok"}

