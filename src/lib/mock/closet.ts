export type ClosetItem = {
  id: string;
  name: string;
  imageUrl: string;
  category: "top" | "bottom" | "outer" | "shoes" | "bag" | "accessory";
  color?: string;
  season?: ("spring" | "summer" | "fall" | "winter")[];
  tags?: string[];
  createdAt: string;
};

export const mockClosetItems: ClosetItem[] = [
  {
    id: "1",
    name: "화이트 오버핏 셔츠",
    imageUrl: "https://picsum.photos/seed/shirt1/400/500",
    category: "top",
    color: "화이트",
    season: ["spring", "summer", "fall"],
    tags: ["미니멀", "캐주얼", "오버핏"],
    createdAt: "2025-01-28",
  },
  {
    id: "2",
    name: "네이비 울 코트",
    imageUrl: "https://picsum.photos/seed/coat1/400/520",
    category: "outer",
    color: "네이비",
    season: ["fall", "winter"],
    tags: ["포멀", "클래식"],
    createdAt: "2025-01-25",
  },
  {
    id: "3",
    name: "블랙 슬림 데님",
    imageUrl: "https://picsum.photos/seed/denim1/400/480",
    category: "bottom",
    color: "블랙",
    season: ["spring", "summer", "fall", "winter"],
    tags: ["캐주얼", "베이직"],
    createdAt: "2025-01-30",
  },
  {
    id: "4",
    name: "베이지 니트 가디건",
    imageUrl: "https://picsum.photos/seed/cardigan1/400/510",
    category: "outer",
    color: "베이지",
    season: ["spring", "fall"],
    tags: ["러블리", "레이어드"],
    createdAt: "2025-01-20",
  },
  {
    id: "5",
    name: "그레이 와이드 슬랙스",
    imageUrl: "https://picsum.photos/seed/slacks1/400/490",
    category: "bottom",
    color: "그레이",
    season: ["spring", "fall", "winter"],
    tags: ["포멀", "미니멀"],
    createdAt: "2025-02-01",
  },
  {
    id: "6",
    name: "화이트 캔버스 스니커즈",
    imageUrl: "https://picsum.photos/seed/sneakers1/400/400",
    category: "shoes",
    color: "화이트",
    season: ["spring", "summer", "fall"],
    tags: ["캐주얼", "스트릿"],
    createdAt: "2025-01-15",
  },
  {
    id: "7",
    name: "블랙 크로스백",
    imageUrl: "https://picsum.photos/seed/bag1/400/450",
    category: "bag",
    color: "블랙",
    season: ["spring", "summer", "fall", "winter"],
    tags: ["미니멀", "데일리"],
    createdAt: "2025-01-22",
  },
  {
    id: "8",
    name: "스트라이프 티셔츠",
    imageUrl: "https://picsum.photos/seed/tshirt1/400/470",
    category: "top",
    color: "네이비/화이트",
    season: ["spring", "summer"],
    tags: ["캐주얼", "프레피"],
    createdAt: "2025-02-03",
  },
  {
    id: "9",
    name: "브라운 레더 부츠",
    imageUrl: "https://picsum.photos/seed/boots1/400/440",
    category: "shoes",
    color: "브라운",
    season: ["fall", "winter"],
    tags: ["클래식", "빈티지"],
    createdAt: "2025-01-18",
  },
  {
    id: "10",
    name: "실버 체인 목걸이",
    imageUrl: "https://picsum.photos/seed/necklace1/400/400",
    category: "accessory",
    color: "실버",
    season: ["spring", "summer", "fall", "winter"],
    tags: ["미니멀", "모던"],
    createdAt: "2025-02-02",
  },
  {
    id: "11",
    name: "카키 카고 팬츠",
    imageUrl: "https://picsum.photos/seed/cargo1/400/500",
    category: "bottom",
    color: "카키",
    season: ["spring", "fall"],
    tags: ["스트릿", "캐주얼"],
    createdAt: "2025-01-27",
  },
  {
    id: "12",
    name: "크림 캐시미어 니트",
    imageUrl: "https://picsum.photos/seed/knit1/400/460",
    category: "top",
    color: "크림",
    season: ["fall", "winter"],
    tags: ["미니멀", "러블리"],
    createdAt: "2025-01-31",
  },
];

const categoryLabels: Record<ClosetItem["category"], string> = {
  top: "상의",
  bottom: "하의",
  outer: "아우터",
  shoes: "신발",
  bag: "가방",
  accessory: "액세서리",
};

export function getCategoryLabel(category: ClosetItem["category"]): string {
  return categoryLabels[category];
}

const seasonLabels: Record<string, string> = {
  spring: "봄",
  summer: "여름",
  fall: "가을",
  winter: "겨울",
};

export function getSeasonLabel(season: string): string {
  return seasonLabels[season] || season;
}
