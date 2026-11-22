from fastapi import APIRouter, Depends, HTTPException
from typing import Annotated
from app.models.dtos.recommendation_dto import RecommendationRequest
from app.services.recommendation_service import recommendation_service
from app.core.security import get_current_user
from app.models.entities.usuarios import Usuario
from app.core.config import settings

router = APIRouter(prefix=f"{settings.API_V1_STR}/recommendations", tags=["Recommendations"])

@router.post("/search", summary="Search restaurant recommendations", description=(
    "Documented REST exception: this is a safe read, but the complex search criteria "
    "(lists of categories and prices, flags) are sent in the request body, so it is a POST "
    "that creates nothing and returns 200 without a Location header."
), responses={500: {"description": "Error interno al buscar recomendaciones"}})
async def search_recommendations(
    request: RecommendationRequest,
    current_user: Annotated[Usuario, Depends(get_current_user)]
):
    try:
        response_data = await recommendation_service.search_restaurants(request, current_user.uid)
        return response_data
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error al buscar recomendaciones: {str(e)}")
