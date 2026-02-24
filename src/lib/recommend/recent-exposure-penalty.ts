import { getDb } from "@/lib/db/neon-client";

type RecommendationLike = {
  score: number;
  top?: { id?: string };
  bottom?: { id?: string };
  dress?: { id?: string };
  outer?: { id?: string };
  top_id?: string;
  bottom_id?: string;
  dress_id?: string;
  outer_id?: string | null;
};

type ExposurePenaltyOptions = {
  lookbackRecommendations?: number;
  penaltyPerHit?: number;
  maxPenalty?: number;
  minScore?: number;
  halfLifeRecommendations?: number;
  recencyBoostRecommendations?: number;
  recencyBoostMultiplier?: number;
};

const DEFAULT_OPTIONS: Required<ExposurePenaltyOptions> = {
  lookbackRecommendations: 40,
  penaltyPerHit: 0.08,
  maxPenalty: 0.6,
  minScore: 0,
  halfLifeRecommendations: 8,
  recencyBoostRecommendations: 3,
  recencyBoostMultiplier: 1.8,
};

function extractItemIds(rec: RecommendationLike): string[] {
  const ids = new Set<string>();

  if (typeof rec.top?.id === "string") ids.add(rec.top.id);
  if (typeof rec.bottom?.id === "string") ids.add(rec.bottom.id);
  if (typeof rec.dress?.id === "string") ids.add(rec.dress.id);
  if (typeof rec.outer?.id === "string") ids.add(rec.outer.id);

  if (typeof rec.top_id === "string") ids.add(rec.top_id);
  if (typeof rec.bottom_id === "string") ids.add(rec.bottom_id);
  if (typeof rec.dress_id === "string") ids.add(rec.dress_id);
  if (typeof rec.outer_id === "string") ids.add(rec.outer_id);

  return Array.from(ids);
}

async function getRecentExposureCountsFromDB(
  config: Required<ExposurePenaltyOptions>
): Promise<Map<string, number>> {
  const counts = new Map<string, number>();
  const lookback = Math.max(1, config.lookbackRecommendations);

  const sql = getDb();
  const rows = await sql`
    SELECT recommended_items
    FROM recommendation_history
    ORDER BY created_at DESC
    LIMIT ${lookback}
  `;

  for (const [ageByRecommendation, row] of rows.entries()) {
    const items = row.recommended_items;
    if (!Array.isArray(items)) continue;

    const stepDecay = Math.exp(
      (-Math.log(2) * ageByRecommendation) /
        Math.max(1, config.halfLifeRecommendations)
    );
    const recencyBoost =
      ageByRecommendation < config.recencyBoostRecommendations
        ? config.recencyBoostMultiplier
        : 1;
    const snapshotWeight = stepDecay * recencyBoost;

    for (const rec of items) {
      for (const itemId of extractItemIds(rec as RecommendationLike)) {
        counts.set(itemId, (counts.get(itemId) ?? 0) + snapshotWeight);
      }
    }
  }

  return counts;
}

export async function rerankWithRecentExposurePenalty<T extends RecommendationLike>(
  recommendations: T[],
  options: ExposurePenaltyOptions = {}
): Promise<T[]> {
  if (recommendations.length <= 1) {
    return recommendations;
  }

  const config = { ...DEFAULT_OPTIONS, ...options };

  try {
    const exposure = await getRecentExposureCountsFromDB(config);
    if (exposure.size === 0) {
      return recommendations;
    }

    const reranked = recommendations
      .map((rec, index) => {
        const hits = extractItemIds(rec).reduce(
          (sum, itemId) => sum + (exposure.get(itemId) ?? 0),
          0
        );
        const penalty = Math.min(config.maxPenalty, hits * config.penaltyPerHit);
        const score = Math.max(config.minScore, rec.score - penalty);
        return { rec, score, index };
      })
      .sort((a, b) => b.score - a.score || a.index - b.index)
      .map(({ rec, score }) => ({ ...rec, score }));

    return reranked as T[];
  } catch (error) {
    console.warn("Recent exposure penalty skipped:", error);
    return recommendations;
  }
}
