"use client";

import { useState, useMemo } from "react";
import { toast } from "sonner";
import { RotateCcw, Wand2 } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

import OotdHeader from "@/components/ootd/OotdHeader";
import DateWeatherHeader from "@/components/ootd/DateWeatherHeader";
import OotdUploadCard from "@/components/ootd/OotdUploadCard";
import MoodInput from "@/components/ootd/MoodInput";
import ClosetGrid from "@/components/ootd/ClosetGrid";
import RecommendationResult, {
  type RecommendationItem,
} from "@/components/ootd/RecommendationResult";
import Footer from "@/components/landing/Footer";

import { mockClosetItems } from "@/lib/mock/closet";

export default function OotdPage() {
  const [moodText, setMoodText] = useState("");
  const [commentText, setCommentText] = useState("");
  const [ootdFile, setOotdFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState("");
  const [selectedClosetItemId, setSelectedClosetItemId] = useState<
    string | null
  >(null);
  const [recommendationResults, setRecommendationResults] = useState<
    RecommendationItem[]
  >([]);
  const [isLoading, setIsLoading] = useState(false);

  const selectedItem = useMemo(
    () => mockClosetItems.find((i) => i.id === selectedClosetItemId) ?? null,
    [selectedClosetItemId]
  );

  function handleUpload(file: File) {
    setOotdFile(file);
    setPreviewUrl(URL.createObjectURL(file));
  }

  function handleRemoveImage() {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setOotdFile(null);
    setPreviewUrl("");
  }

  function handleReset() {
    handleRemoveImage();
    setMoodText("");
    setCommentText("");
    setSelectedClosetItemId(null);
    setRecommendationResults([]);
    toast.info("초기화되었습니다.");
  }

  function handleRecommend() {
    if (moodText.length <= 2) {
      toast.warning("mood를 3자 이상 입력해주세요.");
      return;
    }

    setIsLoading(true);
    setRecommendationResults([]);

    // 시뮬레이션: API 호출 시뮬레이션
    setTimeout(() => {
      // Mock 추천 결과 생성
      const mockResults: RecommendationItem[] = [
        {
          id: "1",
          top: mockClosetItems[0],
          bottom: mockClosetItems[2],
          outer: mockClosetItems[1],
          score: 0.87,
          reason: `${moodText} 스타일에 최적화된 조합입니다. 날씨와 상황을 고려한 세련된 코디입니다.`,
        },
        {
          id: "2",
          top: mockClosetItems[7],
          bottom: mockClosetItems[4],
          score: 0.82,
          reason: `캐주얼하면서도 포멀한 느낌의 ${moodText} 룩입니다.`,
        },
        {
          id: "3",
          top: mockClosetItems[11],
          bottom: mockClosetItems[3],
          outer: mockClosetItems[4],
          score: 0.79,
          reason: `따뜻하고 편안한 ${moodText} 스타일입니다.`,
        },
      ];

      setRecommendationResults(mockResults);
      setIsLoading(false);
      toast.success("코디 추천이 완료되었습니다!", {
        description: `${mockResults.length}개의 코디를 추천했습니다.`,
        duration: 3000,
      });
    }, 2000);
  }

  function handleFeedback(resultId: string, isPositive: boolean) {
    toast.success(
      isPositive ? "피드백 감사합니다!" : "피드백이 반영되었습니다.",
      {
        description: "다음 추천에 반영하겠습니다.",
        duration: 2000,
      }
    );
    // TODO: 실제 API 호출
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 relative overflow-hidden">
      {/* Background Decoration */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-20 left-10 w-72 h-72 bg-blue-200/20 rounded-full blur-3xl animate-float" />
        <div className="absolute bottom-20 right-10 w-96 h-96 bg-purple-200/20 rounded-full blur-3xl animate-float delay-1000" />
      </div>

      <OotdHeader />

      <div className="pt-16 min-h-screen">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8 lg:py-12">
          {/* Page Title */}
          <div className="mb-8 lg:mb-12 text-center lg:text-left">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-blue-100/50 border border-blue-200/50 text-blue-700 text-sm font-medium mb-4">
              <Wand2 className="size-4" />
              AI 기반 스마트 추천
            </div>
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold mb-4">
              <span className="bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 bg-clip-text text-transparent">
                AI 코디 추천
              </span>
            </h1>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto lg:mx-0">
              날씨와 상황에 맞는 완벽한 코디를 추천받아보세요
            </p>
          </div>

          {/* 추천 입력 영역 */}
          <Card className="overflow-hidden border-border/40 notion-shadow-xl backdrop-blur-sm bg-white/90 relative z-10 mb-8">
            <CardContent className="p-0">
              <div className="grid grid-cols-1 lg:grid-cols-[420px_1fr]">
                {/* ===================== LEFT COLUMN ===================== */}
                <div className="space-y-6 border-b border-border/40 bg-gradient-to-br from-slate-50/90 to-blue-50/50 p-8 lg:border-r lg:border-b-0">
                  {/* [A] Date & Weather */}
                  <DateWeatherHeader />

                  {/* [B] OOTD Upload Card */}
                  <OotdUploadCard
                    previewUrl={previewUrl}
                    onUpload={handleUpload}
                    onRemove={handleRemoveImage}
                  />

                  {/* [C] One-line Comment */}
                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-foreground/80">
                      한줄 코멘트
                    </label>
                    <Input
                      value={commentText}
                      onChange={(e) => setCommentText(e.target.value)}
                      placeholder="오늘 코디 한마디"
                      className="text-sm rounded-xl border-border/60 bg-background/80 focus:bg-background transition-all"
                    />
                  </div>
                </div>

                {/* ===================== RIGHT COLUMN ===================== */}
                <div className="flex flex-col gap-6 p-8 bg-gradient-to-br from-white/80 to-slate-50/50">
                  {/* [D] Mood Input */}
                  <MoodInput value={moodText} onChange={setMoodText} />

                  {/* [E] Closet Grid */}
                  <div className="flex-1 overflow-y-auto max-h-[600px] pr-2">
                    <ClosetGrid
                      items={mockClosetItems}
                      selectedId={selectedClosetItemId}
                      onSelect={setSelectedClosetItemId}
                    />
                  </div>

                  {/* [F] Action Buttons */}
                  <div className="flex items-center gap-3 pt-4 border-t border-border/40">
                    <Button
                      onClick={handleRecommend}
                      size="lg"
                      disabled={isLoading}
                      className="flex-1 gap-2 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground disabled:opacity-50"
                    >
                      <Wand2 className="size-4" />
                      {isLoading ? "추천 중..." : "추천받기"}
                    </Button>
                    <Button
                      variant="outline"
                      size="lg"
                      onClick={handleReset}
                      disabled={isLoading}
                      className="gap-2 rounded-xl"
                    >
                      <RotateCcw className="size-4" />
                      초기화
                    </Button>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* 추천 결과 영역 */}
          {(isLoading || recommendationResults.length > 0) && (
            <Card className="overflow-hidden border-border/40 notion-shadow-xl backdrop-blur-sm bg-white/90 relative z-10">
              <CardContent className="p-8">
                <RecommendationResult
                  results={recommendationResults}
                  loading={isLoading}
                  onFeedback={handleFeedback}
                />
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      <Footer />
    </div>
  );
}
