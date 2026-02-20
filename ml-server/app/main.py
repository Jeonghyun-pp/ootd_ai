from __future__ import annotations

import os
from typing import Any, Dict, List, Optional, Literal

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field

from .model_loader import ArtifactsBundle, load_artifacts
from .predictor import recommend_outfits


app = FastAPI(title="OOTD Recommendation API")

artifacts: Optional[ArtifactsBundle] = None


class WeatherPayload(BaseModel):
    temperature: float = 0.0
    feels_like: float = 0.0
    precipitation: float = 0.0


class UserContextPayload(BaseModel):
    text: str
    comment: str = ""
    weather: WeatherPayload


class ClosetItemPayload(BaseModel):
    id: str
    vector: Optional[List[float]] = None
    attributes: Dict[str, Any] = Field(default_factory=dict)
    season: Optional[List[str]] = None


class RecommendRequest(BaseModel):
    user_context: UserContextPayload
    closet_items: List[ClosetItemPayload]
    top_k: int = 10


class RecommendationRow(BaseModel):
    outfit_type: Literal["two_piece", "dress"] = "two_piece"
    top_id: Optional[str] = None
    bottom_id: Optional[str] = None
    dress_id: Optional[str] = None
    outer_id: Optional[str] = None
    score: float
    reason: str


class RecommendResponse(BaseModel):
    recommendations: List[RecommendationRow]


@app.on_event("startup")
async def startup_event() -> None:
    global artifacts
    artifacts_path = (
        os.getenv("ARTIFACTS_PATH")
        or os.getenv("MODEL_ARTIFACTS_PATH")
        or None
    )
    artifacts = load_artifacts(artifacts_path=artifacts_path)


@app.post("/recommend", response_model=RecommendResponse)
async def recommend(request: RecommendRequest) -> RecommendResponse:
    if artifacts is None:
        raise HTTPException(status_code=500, detail="model artifacts not loaded")

    mood = request.user_context.text.strip()
    if len(mood) < 2:
        raise HTTPException(status_code=400, detail="text must be at least 2 characters")

    try:
        rows = recommend_outfits(
            bundle=artifacts,
            mood=mood,
            comment=request.user_context.comment or "",
            temperature=float(request.user_context.weather.temperature or 0.0),
            closet_items=[item.model_dump() for item in request.closet_items],
            top_k=int(request.top_k or 10),
        )
        return RecommendResponse(recommendations=rows)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@app.get("/health")
async def health() -> Dict[str, Any]:
    return {
        "status": "healthy",
        "model_loaded": artifacts is not None,
        "feature_cols": artifacts.feature_cols if artifacts else [],
    }


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=8000)
