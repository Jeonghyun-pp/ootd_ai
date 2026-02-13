"use client";

import { ThumbsUp, ThumbsDown, Shirt, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

import type { ClosetItem } from "@/lib/mock/closet";

export type RecommendationItem = {
  id: string;
  top: ClosetItem;
  bottom: ClosetItem;
  outer?: ClosetItem;
  score: number; // 0.0 ~ 1.0
  reason: string;
};

interface RecommendationResultProps {
  results: RecommendationItem[];
  loading?: boolean;
  onFeedback?: (resultId: string, isPositive: boolean) => void;
}

export default function RecommendationResult({
  results,
  loading = false,
  onFeedback,
}: RecommendationResultProps) {
  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center space-y-4">
          <div className="inline-flex items-center justify-center size-16 rounded-full bg-gradient-to-br from-blue-100 to-purple-100 animate-spin">
            <Sparkles className="size-8 text-blue-600" />
          </div>
          <p className="text-muted-foreground font-medium">
            AI가 최적의 코디를 추천하고 있습니다...
          </p>
        </div>
      </div>
    );
  }

  if (results.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">
          추천 결과가 없습니다. 추천받기 버튼을 눌러보세요.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-xl font-semibold flex items-center gap-2">
          <Sparkles className="size-5 text-blue-600" />
          추천 결과
        </h3>
        <Badge variant="secondary" className="rounded-lg">
          {results.length}개의 코디
        </Badge>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {results.map((result) => (
          <Card
            key={result.id}
            className="overflow-hidden border-border/40 notion-shadow notion-hover group"
          >
            <CardContent className="p-0">
              {/* 코디 이미지 그리드 */}
              <div className="grid grid-cols-2 gap-2 p-4 bg-gradient-to-br from-slate-50 to-blue-50/30">
                {/* 상의 */}
                <div className="relative aspect-square rounded-xl overflow-hidden border border-border/40 bg-white">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={result.top.imageUrl}
                    alt={result.top.name}
                    className="h-full w-full object-cover"
                  />
                  <div className="absolute top-1 left-1 bg-blue-600/80 text-white text-[10px] px-1.5 py-0.5 rounded-md font-medium">
                    상의
                  </div>
                </div>

                {/* 하의 */}
                <div className="relative aspect-square rounded-xl overflow-hidden border border-border/40 bg-white">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={result.bottom.imageUrl}
                    alt={result.bottom.name}
                    className="h-full w-full object-cover"
                  />
                  <div className="absolute top-1 left-1 bg-purple-600/80 text-white text-[10px] px-1.5 py-0.5 rounded-md font-medium">
                    하의
                  </div>
                </div>

                {/* 아우터 (있는 경우) */}
                {result.outer && (
                  <div className="relative aspect-square rounded-xl overflow-hidden border border-border/40 bg-white col-span-2">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={result.outer.imageUrl}
                      alt={result.outer.name}
                      className="h-full w-full object-cover"
                    />
                    <div className="absolute top-1 left-1 bg-orange-600/80 text-white text-[10px] px-1.5 py-0.5 rounded-md font-medium">
                      아우터
                    </div>
                  </div>
                )}
              </div>

              {/* 정보 영역 */}
              <div className="p-4 space-y-3">
                {/* 매칭 점수 */}
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-muted-foreground">
                    매칭 점수
                  </span>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 w-24 h-2 bg-slate-200 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-blue-500 to-purple-600 rounded-full transition-all duration-500"
                        style={{ width: `${result.score * 100}%` }}
                      />
                    </div>
                    <span className="text-sm font-bold text-foreground min-w-[3rem]">
                      {(result.score * 100).toFixed(0)}%
                    </span>
                  </div>
                </div>

                {/* 추천 이유 */}
                <div className="space-y-1">
                  <span className="text-xs font-medium text-muted-foreground">
                    추천 이유
                  </span>
                  <p className="text-sm text-foreground leading-relaxed">
                    {result.reason}
                  </p>
                </div>

                {/* 아이템 이름 */}
                <div className="space-y-1 pt-2 border-t border-border/40">
                  <div className="text-xs text-muted-foreground">
                    <span className="font-medium">상의:</span> {result.top.name}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    <span className="font-medium">하의:</span> {result.bottom.name}
                  </div>
                  {result.outer && (
                    <div className="text-xs text-muted-foreground">
                      <span className="font-medium">아우터:</span> {result.outer.name}
                    </div>
                  )}
                </div>

                {/* 피드백 버튼 */}
                {onFeedback && (
                  <div className="flex gap-2 pt-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1 gap-2 rounded-lg"
                      onClick={() => onFeedback(result.id, true)}
                    >
                      <ThumbsUp className="size-4" />
                      좋아요
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1 gap-2 rounded-lg"
                      onClick={() => onFeedback(result.id, false)}
                    >
                      <ThumbsDown className="size-4" />
                      싫어요
                    </Button>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
