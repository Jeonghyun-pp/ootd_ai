"""
추론 로직
"""
import torch
import numpy as np
from transformers import AutoTokenizer

def predict_outfit_score(
    model,
    tokenizer,
    mood: str,
    comment: str,
    temperature: float,
    feels_like: float,
    precipitation: float,
    top: dict,
    bottom: dict,
    outer: dict = None
) -> float:
    """
    옷 조합의 매칭 점수 예측
    
    Returns:
        점수 (0.0 ~ 1.0)
    """
    device = next(model.parameters()).device
    
    # 텍스트 토크나이징
    combined_text = f"{mood} {comment}"
    encoded = tokenizer(
        combined_text,
        max_length=128,
        padding='max_length',
        truncation=True,
        return_tensors='pt'
    )
    
    input_ids = encoded['input_ids'].to(device)
    attention_mask = encoded['attention_mask'].to(device)
    
    # 수치 특징 추출
    category_map = {
        'top': 0, 'bottom': 1, 'outer': 2,
        'shoes': 3, 'bag': 4, 'accessory': 5
    }
    
    top_cat_idx = category_map.get(top.get('category', 'top'), 0)
    bottom_cat_idx = category_map.get(bottom.get('category', 'bottom'), 1)
    outer_cat_idx = category_map.get(outer.get('category', 'outer'), 2) if outer else 0
    
    features = torch.tensor([[
        temperature,
        feels_like,
        precipitation,
        top_cat_idx,
        bottom_cat_idx,
        outer_cat_idx,
        # 추가 특징들...
    ]], dtype=torch.float32).to(device)
    
    # 추론
    model.eval()
    with torch.no_grad():
        output = model(input_ids, attention_mask, features)
        score = output.item()
    
    return max(0.0, min(1.0, score))  # 0-1 범위로 클리핑
