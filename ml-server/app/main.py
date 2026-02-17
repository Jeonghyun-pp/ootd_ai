"""
FastAPI ML 서버 - 코디 추천 모델 서빙
"""
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from typing import List, Optional
import torch
from transformers import AutoTokenizer
import numpy as np
from model_loader import load_model
from predictor import predict_outfit_score

app = FastAPI(title="OOTD Recommendation API")

# 모델 로드 (서버 시작 시)
model = None
tokenizer = None

@app.on_event("startup")
async def load_models():
    global model, tokenizer
    model = load_model("models/best_model.pt")
    tokenizer = AutoTokenizer.from_pretrained("models/")

class RecommendationRequest(BaseModel):
    mood: str
    comment: Optional[str] = ""
    temperature: float
    feels_like: float
    precipitation: float
    closet_items: List[dict]  # 옷장 아이템 리스트

class RecommendationResponse(BaseModel):
    recommendations: List[dict]  # 추천 결과
    scores: List[float]

@app.post("/recommend", response_model=RecommendationResponse)
async def recommend_outfit(request: RecommendationRequest):
    """
    코디 추천 API
    
    입력:
    - mood: 추구미 텍스트
    - comment: 코멘트
    - temperature: 기온
    - feels_like: 체감 온도
    - precipitation: 강수량
    - closet_items: 옷장 아이템 리스트
    
    출력:
    - 추천된 코디 조합 및 점수
    """
    try:
        # 모든 옷 조합 생성
        tops = [item for item in request.closet_items if item['category'] == 'top']
        bottoms = [item for item in request.closet_items if item['category'] == 'bottom']
        outers = [item for item in request.closet_items if item['category'] == 'outer']
        
        recommendations = []
        scores = []
        
        # 각 조합에 대해 점수 예측
        for top in tops:
            for bottom in bottoms:
                for outer in (outers + [None]):  # 아우터는 선택적
                    score = predict_outfit_score(
                        model=model,
                        tokenizer=tokenizer,
                        mood=request.mood,
                        comment=request.comment,
                        temperature=request.temperature,
                        feels_like=request.feels_like,
                        precipitation=request.precipitation,
                        top=top,
                        bottom=bottom,
                        outer=outer
                    )
                    
                    recommendations.append({
                        'top': top,
                        'bottom': bottom,
                        'outer': outer,
                        'score': float(score)
                    })
                    scores.append(float(score))
        
        # 점수 순으로 정렬
        sorted_indices = np.argsort(scores)[::-1]  # 내림차순
        top_recommendations = [recommendations[i] for i in sorted_indices[:10]]  # Top 10
        
        return RecommendationResponse(
            recommendations=top_recommendations,
            scores=[r['score'] for r in top_recommendations]
        )
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/health")
async def health_check():
    return {"status": "healthy", "model_loaded": model is not None}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
