import { NextRequest, NextResponse } from "next/server";
import { getRepository } from "@/lib/db/repository";
import type { ClosetItem } from "@/lib/types/closet";

const repository = getRepository();

const CLIP_MODEL_URL = process.env.CLIP_MODEL_URL || "http://localhost:8002";
const ML_SERVER_URL = process.env.ML_SERVER_URL || "http://localhost:8000";

/**
 * POST /api/recommend
 * 코디 추천 API
 *
 * 1. 텍스트 벡터 생성 → pgvector 검색 (가능한 경우)
 * 2. ML 서버 호출 (가능한 경우)
 * 3. Fallback: 카테고리 + 날씨/시즌 기반 규칙 추천
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { mood, comment, temperature, feelsLike, precipitation } = body;

    if (!mood || mood.length < 3) {
      return NextResponse.json(
        { error: "mood는 3자 이상 입력해주세요." },
        { status: 400 }
      );
    }

    // 모든 옷장 아이템 로드
    const allItems = await repository.findAll();
    if (allItems.length === 0) {
      return NextResponse.json(
        { error: "옷장에 아이템이 없습니다." },
        { status: 400 }
      );
    }

    // ML 서버 기반 추천 시도
    const mlResult = await tryMLRecommendation(
      mood,
      comment,
      temperature,
      feelsLike,
      precipitation,
      allItems
    );

    if (mlResult) {
      return NextResponse.json({ recommendations: mlResult });
    }

    // Fallback: 규칙 기반 추천
    const fallbackResults = generateFallbackRecommendations(
      mood,
      temperature,
      allItems
    );

    return NextResponse.json({ recommendations: fallbackResults });
  } catch (error) {
    console.error("Recommendation API error:", error);
    return NextResponse.json(
      {
        error: "코디 추천에 실패했습니다.",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}

/**
 * ML 서버 기반 추천 (실패 시 null 반환)
 */
async function tryMLRecommendation(
  mood: string,
  comment: string | undefined,
  temperature: number | undefined,
  feelsLike: number | undefined,
  precipitation: number | undefined,
  allItems: ClosetItem[]
): Promise<unknown[] | null> {
  try {
    // 1. 텍스트 벡터 생성
    const textVector = await encodeTextToVector(mood, comment);

    // 2. pgvector로 유사 아이템 검색
    const similarItems = await repository.findSimilar(textVector, 100);
    const candidateItems =
      similarItems.length > 0 ? similarItems : allItems;

    // 3. ML 서버 호출
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);

    const response = await fetch(`${ML_SERVER_URL}/recommend`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        user_context: {
          text: mood,
          comment: comment || "",
          weather: {
            temperature: temperature || 0,
            feels_like: feelsLike || 0,
            precipitation: precipitation || 0,
          },
        },
        closet_items: candidateItems.map((item) => ({
          id: item.id,
          vector: item.imageVector,
          attributes: item.attributes,
        })),
        top_k: 10,
      }),
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!response.ok) return null;

    const data = await response.json();

    return data.recommendations.map((rec: any, index: number) => {
      const top = candidateItems.find((i) => i.id === rec.top_id);
      const bottom = candidateItems.find((i) => i.id === rec.bottom_id);
      const outer = rec.outer_id
        ? candidateItems.find((i) => i.id === rec.outer_id)
        : undefined;

      return {
        id: `rec_${index + 1}`,
        top,
        bottom,
        outer,
        score: rec.score,
        reason: rec.reason || generateReason(mood, rec.score),
      };
    });
  } catch (error) {
    console.warn("ML 추천 실패, fallback 사용:", error);
    return null;
  }
}

/**
 * 텍스트 벡터 생성 (CLIP 모델)
 */
async function encodeTextToVector(
  text: string,
  comment?: string
): Promise<number[]> {
  const combinedText = comment ? `${text} ${comment}` : text;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);

  const response = await fetch(`${CLIP_MODEL_URL}/encode-text`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text: combinedText }),
    signal: controller.signal,
  });

  clearTimeout(timeout);

  if (!response.ok) {
    throw new Error("텍스트 벡터 생성 실패");
  }

  const data = await response.json();
  return data.vector;
}

/**
 * Fallback: 카테고리별 필터링 + 날씨-시즌 매칭으로 조합 생성
 */
function generateFallbackRecommendations(
  mood: string,
  temperature: number | undefined,
  allItems: ClosetItem[]
): unknown[] {
  // 현재 시즌 결정
  const season = getSeasonFromTemperature(temperature);

  // 시즌에 맞는 아이템 필터링
  const seasonFiltered = allItems.filter(
    (item) => !item.season || item.season.length === 0 || item.season.includes(season)
  );

  // 카테고리별 분류
  const tops = seasonFiltered.filter(
    (i) => i.attributes.category === "top"
  );
  const bottoms = seasonFiltered.filter(
    (i) => i.attributes.category === "bottom"
  );
  const outers = seasonFiltered.filter(
    (i) => i.attributes.category === "outer"
  );
  const dresses = seasonFiltered.filter(
    (i) => i.attributes.category === "dress"
  );

  const recommendations: unknown[] = [];
  const needOuter = season === "fall" || season === "winter";

  // top + bottom 조합 생성
  if (tops.length > 0 && bottoms.length > 0) {
    const maxCombinations = Math.min(3, tops.length * bottoms.length);
    const usedPairs = new Set<string>();

    for (let i = 0; i < maxCombinations; i++) {
      const topIdx = i % tops.length;
      const bottomIdx = Math.floor(i / tops.length) % bottoms.length;
      const pairKey = `${topIdx}-${bottomIdx}`;

      if (usedPairs.has(pairKey)) continue;
      usedPairs.add(pairKey);

      const top = tops[topIdx];
      const bottom = bottoms[bottomIdx];
      const outer =
        needOuter && outers.length > 0
          ? outers[i % outers.length]
          : undefined;

      const score = 0.6 + Math.random() * 0.3;

      recommendations.push({
        id: `rec_${recommendations.length + 1}`,
        top,
        bottom,
        outer,
        score: parseFloat(score.toFixed(2)),
        reason: generateReason(mood, score),
      });
    }
  }

  // dress 조합 추가
  if (dresses.length > 0 && recommendations.length < 3) {
    const dress = dresses[0];
    const outer =
      needOuter && outers.length > 0 ? outers[0] : undefined;
    const score = 0.65 + Math.random() * 0.25;

    recommendations.push({
      id: `rec_${recommendations.length + 1}`,
      top: dress,
      bottom: dress,
      outer,
      score: parseFloat(score.toFixed(2)),
      reason: `${mood} 스타일에 어울리는 원피스 코디입니다.`,
    });
  }

  // 결과가 없으면 임의 조합
  if (recommendations.length === 0 && allItems.length >= 2) {
    recommendations.push({
      id: "rec_1",
      top: allItems[0],
      bottom: allItems[1],
      outer: allItems.length > 2 ? allItems[2] : undefined,
      score: 0.6,
      reason: generateReason(mood, 0.6),
    });
  }

  return recommendations;
}

function getSeasonFromTemperature(
  temperature: number | undefined
): "spring" | "summer" | "fall" | "winter" {
  if (temperature === undefined) {
    const month = new Date().getMonth() + 1;
    if (month >= 3 && month <= 5) return "spring";
    if (month >= 6 && month <= 8) return "summer";
    if (month >= 9 && month <= 11) return "fall";
    return "winter";
  }

  if (temperature >= 28) return "summer";
  if (temperature >= 20) return "spring";
  if (temperature >= 10) return "fall";
  return "winter";
}

function generateReason(mood: string, score: number): string {
  const scoreLevel =
    score > 0.8 ? "매우 적합한" : score > 0.6 ? "적합한" : "괜찮은";
  return `${mood} 스타일에 ${scoreLevel} 조합입니다. 날씨와 상황을 고려한 코디입니다.`;
}
