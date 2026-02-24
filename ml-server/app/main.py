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
    dominant_color_lab: Optional[List[float]] = None  # Phase 2: pre-computed LAB
    clip_score: Optional[float] = None  # CLIP 텍스트-이미지 유사도 (route.ts에서 계산)


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
    selected_items: Dict[str, List[str]] = Field(default_factory=dict)
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
        result = recommend_outfits(
            bundle=artifacts,
            mood=mood,
            comment=request.user_context.comment or "",
            temperature=float(request.user_context.weather.temperature or 0.0),
            closet_items=[item.model_dump() for item in request.closet_items],
            top_k=int(request.top_k or 10),
        )
        return RecommendResponse(
            selected_items=result.get("selected_items", {}),
            recommendations=result.get("recommendations", []),
        )
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

    port = int(os.getenv("PORT", "8000"))
    uvicorn.run(app, host="0.0.0.0", port=port)
