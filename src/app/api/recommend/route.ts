import { NextRequest, NextResponse } from "next/server";
import { getRepository } from "@/lib/db/repository";
import type { ClosetItem } from "@/lib/types/closet";

const repository = getRepository();

const CLIP_MODEL_URL = process.env.CLIP_MODEL_URL || "http://localhost:8002";
const ML_SERVER_URL = process.env.ML_SERVER_URL || "http://localhost:8000";

type UIRecommendation = {
  id: string;
  type: "two_piece" | "dress";
  top?: ClosetItem;
  bottom?: ClosetItem;
  dress?: ClosetItem;
  outer?: ClosetItem;
  score: number;
  reason: string;
};

type MLRecommendationRow = {
  outfit_type?: "two_piece" | "dress";
  top_id?: string;
  bottom_id?: string;
  dress_id?: string;
  outer_id?: string | null;
  score: number;
  reason?: string;
};

/**
 * POST /api/recommend
 * 1) ML server recommendation
 * 2) Fallback rule-based recommendation
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { mood, comment, temperature, feelsLike, precipitation } = body;

    if (!mood || mood.length < 3) {
      return NextResponse.json(
        { error: "mood를 3자 이상 입력해 주세요." },
        { status: 400 }
      );
    }

    const allItems = await repository.findAll();
    if (allItems.length === 0) {
      return NextResponse.json(
        { error: "옷장 아이템이 없습니다." },
        { status: 400 }
      );
    }

    const mlResult = await tryMLRecommendation(
      mood,
      comment,
      temperature,
      feelsLike,
      precipitation,
      allItems
    );

    if (mlResult && mlResult.length > 0) {
      return NextResponse.json({ recommendations: mlResult });
    }

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

async function tryMLRecommendation(
  mood: string,
  comment: string | undefined,
  temperature: number | undefined,
  feelsLike: number | undefined,
  precipitation: number | undefined,
  allItems: ClosetItem[]
): Promise<UIRecommendation[] | null> {
  try {
    // Optional narrowing. If vector services are unavailable, continue with all items.
    let candidateItems = allItems;
    try {
      const textVector = await encodeTextToVector(mood, comment);
      const similarItems = await repository.findSimilar(textVector, 100);
      if (similarItems.length > 0) {
        candidateItems = similarItems;
      }
    } catch (vectorError) {
      console.warn("Vector candidate narrowing skipped:", vectorError);
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);

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
          season: item.season,
        })),
        top_k: 10,
      }),
      signal: controller.signal,
    });

    clearTimeout(timeout);
    if (!response.ok) return null;

    const data = await response.json();
    const rows: MLRecommendationRow[] = Array.isArray(data?.recommendations)
      ? data.recommendations
      : [];

    const mapped = rows
      .map((rec, index): UIRecommendation | null => {
        const outfitType =
          rec.outfit_type === "dress" || rec.dress_id ? "dress" : "two_piece";
        const outer = rec.outer_id
          ? candidateItems.find((i) => i.id === rec.outer_id)
          : undefined;

        if (outfitType === "dress") {
          const dress = rec.dress_id
            ? candidateItems.find((i) => i.id === rec.dress_id)
            : undefined;
          if (!dress) return null;

          return {
            id: `rec_${index + 1}`,
            type: "dress",
            dress,
            outer,
            score: Number(rec.score ?? 0),
            reason: rec.reason || generateReason(mood, Number(rec.score ?? 0)),
          };
        }

        const top = rec.top_id
          ? candidateItems.find((i) => i.id === rec.top_id)
          : undefined;
        const bottom = rec.bottom_id
          ? candidateItems.find((i) => i.id === rec.bottom_id)
          : undefined;
        if (!top || !bottom) return null;

        return {
          id: `rec_${index + 1}`,
          type: "two_piece",
          top,
          bottom,
          outer,
          score: Number(rec.score ?? 0),
          reason: rec.reason || generateReason(mood, Number(rec.score ?? 0)),
        };
      })
      .filter((row): row is UIRecommendation => row !== null);

    return mapped;
  } catch (error) {
    console.warn("ML recommendation failed. Fallback will be used:", error);
    return null;
  }
}

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
    throw new Error(`encode-text failed: ${response.status}`);
  }

  const data = await response.json();
  if (!Array.isArray(data?.vector)) {
    throw new Error("encode-text returned invalid vector payload");
  }
  return data.vector;
}

function generateFallbackRecommendations(
  mood: string,
  temperature: number | undefined,
  allItems: ClosetItem[]
): UIRecommendation[] {
  const season = getSeasonFromTemperature(temperature);

  const seasonFiltered = allItems.filter(
    (item) =>
      !item.season ||
      item.season.length === 0 ||
      item.season.includes(season)
  );

  const tops = seasonFiltered.filter((i) => i.attributes.category === "top");
  const bottoms = seasonFiltered.filter(
    (i) => i.attributes.category === "bottom"
  );
  const outers = seasonFiltered.filter((i) => i.attributes.category === "outer");
  const dresses = seasonFiltered.filter((i) => i.attributes.category === "dress");

  const recommendations: UIRecommendation[] = [];
  const needOuter = season === "fall" || season === "winter";

  if (tops.length > 0 && bottoms.length > 0) {
    const maxCombinations = Math.min(3, tops.length * bottoms.length);
    for (let i = 0; i < maxCombinations; i++) {
      const top = tops[i % tops.length];
      const bottom = bottoms[Math.floor(i / tops.length) % bottoms.length];
      const outer = needOuter && outers.length > 0 ? outers[i % outers.length] : undefined;
      const score = 0.6 + i * 0.08;

      recommendations.push({
        id: `rec_${recommendations.length + 1}`,
        type: "two_piece",
        top,
        bottom,
        outer,
        score: Math.min(0.95, Number(score.toFixed(2))),
        reason: generateReason(mood, score),
      });
    }
  }

  if (dresses.length > 0 && recommendations.length < 3) {
    const dress = dresses[0];
    const outer = needOuter && outers.length > 0 ? outers[0] : undefined;
    const score = 0.68;
    recommendations.push({
      id: `rec_${recommendations.length + 1}`,
      type: "dress",
      dress,
      outer,
      score,
      reason: `${mood} 분위기에 맞는 원피스 중심 코디입니다.`,
    });
  }

  if (recommendations.length === 0 && allItems.length >= 2) {
    recommendations.push({
      id: "rec_1",
      type: "two_piece",
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
    score > 0.8 ? "매우 잘 맞는" : score > 0.6 ? "잘 맞는" : "무난한";
  return `${mood} 분위기에 ${scoreLevel} 조합입니다. 날씨와 상황을 함께 반영했습니다.`;
}
