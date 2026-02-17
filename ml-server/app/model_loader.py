"""
모델 로더
"""
import torch
from train.train_model import OutfitRecommendationModel

def load_model(model_path: str, device: str = None):
    """
    학습된 모델 로드
    
    Args:
        model_path: 모델 파일 경로
        device: 디바이스 ('cuda' or 'cpu')
    
    Returns:
        로드된 모델
    """
    if device is None:
        device = 'cuda' if torch.cuda.is_available() else 'cpu'
    
    # 모델 구조 재생성
    vocab_size = 32000  # 토크나이저 vocab size에 맞게 조정
    model = OutfitRecommendationModel(vocab_size=vocab_size)
    
    # 가중치 로드
    model.load_state_dict(torch.load(model_path, map_location=device))
    model.to(device)
    model.eval()
    
    return model
