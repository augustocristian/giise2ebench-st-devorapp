from pydantic import BaseModel
from typing import List, Optional

class RecommendationRequest(BaseModel):
    categories: List[str]
    prices: List[str]
    include_unconfirmed_price: bool
    location: str
    sort_by: Optional[str] = "rating"
    max_results: Optional[int] = 10
    page_token: Optional[str] = None
    open_now: Optional[bool] = None
