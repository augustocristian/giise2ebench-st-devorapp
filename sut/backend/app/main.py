from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.core.config import settings
from app.presentation.routers import auth_router, recommendation_router, historial_router, favoritos_router, mas_tarde_router, valoraciones_router
from app.infrastructure.firebase.firebase_admin import get_firebase_app
import os

# Inicializar Firebase antes de aceptar peticiones
get_firebase_app()

app = FastAPI(
    title=settings.PROJECT_NAME,
    openapi_url=f"{settings.API_V1_STR}/openapi.json",
)

# Necesario para que el frontend (React) pueda hacer peticiones al backend
_extra_origins = [o.strip() for o in os.getenv("EXTRA_ORIGINS", "").split(",") if o.strip()]
_allowed_origins = [
    "https://localhost:5173",
    "https://127.0.0.1:5173",
    "http://localhost:5173",
    "http://localhost",
    "https://localhost",
    "capacitor://localhost",
    # Para desarrollo local sin TLS, añadir http://localhost:5173 en EXTRA_ORIGINS
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
        if request.method == "OPTIONS" or "/login" in request.url.path:
            print(f"\n--- [DEBUG] NUEVA PETICION ---")
            print(f"Método: {request.method}")
            print(f"Ruta: {request.url.path}")
            print("Cabeceras:")
            for key, value in request.headers.items():
                print(f"  {key}: {value}")
            print("-----------------------------\n")
        return await call_next(request)

app.add_middleware(DebugMiddleware)

# Registrar rutas
app.include_router(auth_router.router)
app.include_router(recommendation_router.router)
app.include_router(historial_router.router)
app.include_router(favoritos_router.router)
app.include_router(mas_tarde_router.router)
app.include_router(valoraciones_router.router)

@app.get("/")
def read_root():
    return {"message": "Bienvenido a la API del TFG"}

@app.get("/health")
def health_check():
    return {"status": "ok"}

