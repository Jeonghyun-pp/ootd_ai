from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Dict, List, Optional, Sequence, Tuple

import torch

from .model_loader import ArtifactsBundle, normalize_temp_range


TARGET_PARTS = ("상의", "하의", "아우터", "원피스")
TEMP_MARGIN = 2.0

PART_ALIASES = {
    "top": "상의",
    "upper": "상의",
    "상의": "상의",
    "bottom": "하의",
    "pants": "하의",
    "trousers": "하의",
    "skirt": "하의",
    "하의": "하의",
    "outer": "아우터",
    "outerwear": "아우터",
    "coat": "아우터",
    "jacket": "아우터",
    "아우터": "아우터",
    "dress": "원피스",
    "onepiece": "원피스",
    "원피스": "원피스",
}

CATEGORY_ALIASES = {
    "top": "티셔츠",
    "bottom": "팬츠",
    "outer": "재킷",
    "dress": "드레스",
    "shirt": "셔츠",
    "tshirt": "티셔츠",
    "t-shirt": "티셔츠",
    "tee": "티셔츠",
    "blouse": "블라우스",
    "knit": "니트웨어",
    "knitwear": "니트웨어",
    "hoodie": "후드티",
    "hooded": "후드티",
    "pants": "팬츠",
    "trousers": "팬츠",
    "jeans": "청바지",
    "jogger": "조거팬츠",
    "leggings": "래깅스",
    "skirt": "스커트",
    "jacket": "재킷",
    "jumper": "점퍼",
    "zipup": "짚업",
    "zip-up": "짚업",
    "coat": "코트",
    "padding": "패딩",
    "cardigan": "가디건",
    "vest": "베스트",
    "bra top": "브라탑",
    "bralette": "브라탑",
    "sleeveless": "탑",
    "dress": "드레스",
    "jumpsuit": "점프수트",
}

COLOR_ALIASES = {
    "black": "블랙",
    "white": "화이트",
    "gray": "그레이",
    "grey": "그레이",
    "blue": "블루",
    "skyblue": "스카이블루",
    "navy": "네이비",
    "red": "레드",
    "pink": "핑크",
    "purple": "퍼플",
    "lavender": "라벤더",
    "green": "그린",
    "mint": "민트",
    "yellow": "옐로우",
    "orange": "오렌지",
    "brown": "브라운",
    "beige": "베이지",
    "khaki": "카키",
    "gold": "골드",
    "silver": "실버",
    "none": "없음",
}

SLEEVE_ALIASES = {
    "sleeveless": "민소매",
    "tank": "민소매",
    "short": "반팔",
    "shortsleeve": "반팔",
    "half": "반팔",
    "long": "긴팔",
    "longsleeve": "긴팔",
    "3/4": "7부소매",
    "7부": "7부소매",
    "cap": "캡",
    "none": "없음",
}

LENGTH_ALIASES = {
    "crop": "크롭",
    "cropped": "크롭",
    "mini": "미니",
    "midi": "미디",
    "maxi": "맥시",
    "long": "롱",
    "normal": "노멀",
    "regular": "노멀",
    "half": "하프",
    "ankle": "발목",
    "none": "없음",
}

FIT_ALIASES = {
    "regular": "노멀",
    "normal": "노멀",
    "loose": "루즈",
    "oversized": "오버사이즈",
    "wide": "와이드",
    "skinny": "스키니",
    "tight": "타이트",
    "bellbottom": "벨보텀",
    "none": "없음",
}

COLLAR_ALIASES = {
    "shirt collar": "셔츠칼라",
    "shirt": "셔츠칼라",
    "band": "밴드칼라",
    "china": "차이나칼라",
    "tailored": "테일러드칼라",
    "polo": "폴로칼라",
    "sailor": "세일러칼라",
    "shawl": "숄칼라",
    "bow": "보우칼라",
    "peter pan": "피터팬칼라",
    "none": "없음",
}

STYLE_ALIASES = {
    "casual": "스트리트",
    "street": "스트리트",
    "sporty": "스포티",
    "feminine": "페미닌",
    "classic": "클래식",
    "modern": "모던",
    "romantic": "로맨틱",
    "preppy": "프레피",
    "hiphop": "힙합",
    "none": "없음",
}

SEASON_TEMP_RANGE = {
    "spring": (12, 20),
    "summer": (23, 36),
    "fall": (8, 19),
    "winter": (-20, 10),
}


@dataclass
class PreparedItem:
    item_id: str
    part: str
    temp_range: Tuple[int, int]
    similarity: float = 0.0


def _normalize_text(value: Any) -> Optional[str]:
    if value is None:
        return None
    text = str(value).strip()
    if not text:
        return None
    lower = text.lower()
    if lower in {"none", "null", "nan"}:
        return None
    return text


def _pick_map_index(
    value: Any,
    mapping: Dict[str, int],
    aliases: Optional[Dict[str, str]] = None,
) -> int:
    unk_idx = mapping.get("<unk>", 0)

    normalized = _normalize_text(value)
    if normalized is None:
        return mapping.get("없음", unk_idx)

    if normalized in mapping:
        return mapping[normalized]

    lower = normalized.lower()
    if lower in mapping:
        return mapping[lower]

    if aliases is not None:
        alias_value = aliases.get(lower)
        if alias_value and alias_value in mapping:
            return mapping[alias_value]

    return unk_idx


def _normalize_part(value: Any) -> Optional[str]:
    text = _normalize_text(value)
    if text is None:
        return None

    if text in TARGET_PARTS:
        return text

    lower = text.lower()
    return PART_ALIASES.get(lower)


def _weather_label_from_temp(
    weather_ranges: Dict[str, Tuple[int, int]], temperature: float
) -> str:
    if not weather_ranges:
        return "선선"

    # 1) direct in-range match
    for label, (low, high) in weather_ranges.items():
        if low <= temperature <= high:
            return label

    # 2) nearest range center fallback
    best_label = "선선"
    best_dist = float("inf")
    for label, (low, high) in weather_ranges.items():
        center = (low + high) / 2.0
        dist = abs(center - temperature)
        if dist < best_dist:
            best_dist = dist
            best_label = label
    return best_label


def _temp_range_from_seasons(seasons: Any) -> Tuple[int, int]:
    if not isinstance(seasons, Sequence):
        return (-50, 50)

    ranges: List[Tuple[int, int]] = []
    for season in seasons:
        if season is None:
            continue
        key = str(season).strip().lower()
        if key in SEASON_TEMP_RANGE:
            ranges.append(SEASON_TEMP_RANGE[key])

    if not ranges:
        return (-50, 50)

    return min(low for low, _ in ranges), max(high for _, high in ranges)


def _similarity_to_score(similarity: float) -> float:
    return max(0.0, min(1.0, (similarity + 1.0) / 2.0))


def _build_reason(mood: str, temperature: float, has_outer: bool, is_dress: bool) -> str:
    base = f"{mood} 무드와 {temperature:.1f}°C 날씨를 반영한 조합입니다."
    if is_dress:
        if has_outer:
            return f"{base} 원피스 중심에 아우터를 더해 밸런스를 맞췄습니다."
        return f"{base} 원피스 단독 실루엣으로 간결하게 구성했습니다."
    if has_outer:
        return f"{base} 상의/하의에 아우터를 레이어드해 체감 온도에 대응했습니다."
    return f"{base} 상의/하의 중심으로 가볍게 입기 좋은 구성입니다."


def _add_scored_combo(
    combos: Dict[Tuple[str, str, Optional[str], Optional[str]], Tuple[float, bool]],
    key: Tuple[str, str, Optional[str], Optional[str]],
    score: float,
    is_dress: bool,
) -> None:
    prev = combos.get(key)
    if prev is None or score > prev[0]:
        combos[key] = (score, is_dress)


def _prepare_item_features(
    bundle: ArtifactsBundle,
    item: Dict[str, Any],
    weather_label: str,
) -> Tuple[Optional[PreparedItem], Optional[Dict[str, int]]]:
    item_id_raw = item.get("id")
    if item_id_raw is None:
        return None, None

    item_id = str(item_id_raw)
    attrs = item.get("attributes") or {}
    if not isinstance(attrs, dict):
        attrs = {}

    def pick(*keys: str) -> Any:
        for key in keys:
            if key in attrs and attrs.get(key) is not None:
                return attrs.get(key)
            if key in item and item.get(key) is not None:
                return item.get(key)
        return None

    part = _normalize_part(pick("part", "category", "카테고리"))
    if part not in TARGET_PARTS:
        return None, None

    map_part = bundle.maps.get("part", {})
    feature_row = {
        "part": _pick_map_index(part, map_part),
        "카테고리": _pick_map_index(
            pick("sub_type", "category", "카테고리"),
            bundle.maps.get("카테고리", {}),
            CATEGORY_ALIASES,
        ),
        "색상": _pick_map_index(
            pick("color", "색상"),
            bundle.maps.get("색상", {}),
            COLOR_ALIASES,
        ),
        "서브색상": _pick_map_index(
            pick("sub_color", "서브색상"),
            bundle.maps.get("서브색상", {}),
            COLOR_ALIASES,
        ),
        "소매기장": _pick_map_index(
            pick("sleeve_length", "소매기장"),
            bundle.maps.get("소매기장", {}),
            SLEEVE_ALIASES,
        ),
        "기장": _pick_map_index(
            pick("length", "기장"),
            bundle.maps.get("기장", {}),
            LENGTH_ALIASES,
        ),
        "핏": _pick_map_index(
            pick("fit", "핏"),
            bundle.maps.get("핏", {}),
            FIT_ALIASES,
        ),
        "옷깃": _pick_map_index(
            pick("collar", "옷깃"),
            bundle.maps.get("옷깃", {}),
            COLLAR_ALIASES,
        ),
        "서브스타일": _pick_map_index(
            # User clarified style label is the primary training signal.
            pick("스타일", "style", "서브스타일", "sub_style"),
            bundle.maps.get("서브스타일", {}),
            STYLE_ALIASES,
        ),
        "날씨": _pick_map_index(
            weather_label,
            bundle.maps.get("날씨", {}),
        ),
    }

    # Keep only model feature cols to avoid mismatch if schema evolves.
    feature_row = {k: feature_row[k] for k in bundle.feature_cols}

    temp_range = None
    item_table_entry = bundle.item_table_min.get(item_id)
    if isinstance(item_table_entry, dict):
        temp_range = normalize_temp_range(item_table_entry.get("temp_range"))

    if temp_range is None:
        temp_range = _temp_range_from_seasons(item.get("season"))

    prepared = PreparedItem(
        item_id=item_id,
        part=part,
        temp_range=temp_range,
    )
    return prepared, feature_row


def recommend_outfits(
    bundle: ArtifactsBundle,
    mood: str,
    comment: str,
    temperature: float,
    closet_items: List[Dict[str, Any]],
    top_k: int = 10,
) -> List[Dict[str, Any]]:
    if not closet_items:
        return []

    query = f"{mood} {comment}".strip()
    if not query:
        query = mood.strip() or "데일리 코디"

    weather_label = _weather_label_from_temp(
        bundle.weather_label_to_temp_range, temperature
    )

    feature_bucket: Dict[str, List[int]] = {col: [] for col in bundle.feature_cols}
    prepared_items: List[PreparedItem] = []

    for item in closet_items:
        prepared, feature_row = _prepare_item_features(bundle, item, weather_label)
        if prepared is None or feature_row is None:
            continue
        for col in bundle.feature_cols:
            feature_bucket[col].append(feature_row[col])
        prepared_items.append(prepared)

    if not prepared_items:
        return []

    item_embs = bundle.encode_items(feature_bucket)
    text_emb = bundle.encode_text(query)

    similarities = (text_emb @ item_embs.T).squeeze(0)
    for idx, prepared in enumerate(prepared_items):
        prepared.similarity = float(similarities[idx].item())

    temp_mask = []
    for prepared in prepared_items:
        low, high = prepared.temp_range
        is_ok = (low - TEMP_MARGIN) <= temperature <= (high + TEMP_MARGIN)
        temp_mask.append(is_ok)

    # If every item is filtered out, keep all items instead of returning empty.
    if not any(temp_mask):
        temp_mask = [True] * len(prepared_items)

    part_ranked: Dict[str, List[PreparedItem]] = {part: [] for part in TARGET_PARTS}
    for keep, prepared in zip(temp_mask, prepared_items):
        if not keep:
            continue
        part_ranked[prepared.part].append(prepared)

    for part in TARGET_PARTS:
        part_ranked[part].sort(key=lambda x: x.similarity, reverse=True)

    tops = part_ranked["상의"][:12]
    bottoms = part_ranked["하의"][:12]
    outers = part_ranked["아우터"][:6]
    dresses = part_ranked["원피스"][:8]

    cold_weather = temperature <= 18.0

    # key = (outfit_type, primary_id, secondary_id, outer_id)
    # two_piece: (two_piece, top_id, bottom_id, outer_id)
    # dress:     (dress, dress_id, None, outer_id)
    combos: Dict[Tuple[str, str, Optional[str], Optional[str]], Tuple[float, bool]] = {}

    # top + bottom combinations
    if tops and bottoms:
        for top_item in tops:
            for bottom_item in bottoms:
                no_outer_score = 0.5 * top_item.similarity + 0.5 * bottom_item.similarity
                if cold_weather:
                    no_outer_score -= 0.03
                _add_scored_combo(
                    combos,
                    ("two_piece", top_item.item_id, bottom_item.item_id, None),
                    no_outer_score,
                    False,
                )

                if outers:
                    for outer_item in outers[:3]:
                        layered_score = (
                            0.4 * top_item.similarity
                            + 0.4 * bottom_item.similarity
                            + 0.2 * outer_item.similarity
                            + 0.02
                        )
                        if not cold_weather:
                            layered_score -= 0.01
                        _add_scored_combo(
                            combos,
                            (
                                "two_piece",
                                top_item.item_id,
                                bottom_item.item_id,
                                outer_item.item_id,
                            ),
                            layered_score,
                            False,
                        )

    # dress combinations
    for dress_item in dresses:
        solo_score = dress_item.similarity + 0.01
        if cold_weather:
            solo_score -= 0.02
        _add_scored_combo(
            combos,
            ("dress", dress_item.item_id, None, None),
            solo_score,
            True,
        )

        if outers:
            for outer_item in outers[:3]:
                layered_score = (
                    0.75 * dress_item.similarity + 0.25 * outer_item.similarity + 0.02
                )
                _add_scored_combo(
                    combos,
                    ("dress", dress_item.item_id, None, outer_item.item_id),
                    layered_score,
                    True,
                )

    if not combos:
        return []

    ranked = sorted(
        combos.items(),
        key=lambda kv: kv[1][0],
        reverse=True,
    )[: max(1, min(int(top_k), 30))]

    results: List[Dict[str, Any]] = []
    for (
        outfit_type,
        primary_id,
        secondary_id,
        outer_id,
    ), (raw_score, is_dress) in ranked:
        score = _similarity_to_score(raw_score)
        if outfit_type == "dress":
            results.append(
                {
                    "outfit_type": "dress",
                    "dress_id": primary_id,
                    "outer_id": outer_id,
                    "score": round(score, 4),
                    "reason": _build_reason(
                        mood=mood.strip() or "입력한",
                        temperature=temperature,
                        has_outer=outer_id is not None,
                        is_dress=True,
                    ),
                }
            )
        else:
            if secondary_id is None:
                continue
            results.append(
                {
                    "outfit_type": "two_piece",
                    "top_id": primary_id,
                    "bottom_id": secondary_id,
                    "outer_id": outer_id,
                    "score": round(score, 4),
                    "reason": _build_reason(
                        mood=mood.strip() or "입력한",
                        temperature=temperature,
                        has_outer=outer_id is not None,
                        is_dress=is_dress,
                    ),
                }
            )

    return results
