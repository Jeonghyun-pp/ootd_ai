"use client";

import { Cloud, Sun } from "lucide-react";

const DAY_NAMES = ["일", "월", "화", "수", "목", "금", "토"];

export default function DateWeatherHeader() {
  const now = new Date();
  const month = now.getMonth() + 1;
  const date = now.getDate();
  const day = DAY_NAMES[now.getDay()];

  return (
    <div className="flex items-center justify-between rounded-xl bg-gradient-to-r from-blue-50/50 to-purple-50/30 p-4 border border-border/40 notion-hover">
      <span className="text-xl font-semibold text-foreground tracking-tight">
        {month}/{date} ({day})
      </span>
      <div className="flex items-center gap-2 text-sm text-muted-foreground bg-white/60 rounded-lg px-3 py-1.5 border border-border/30">
        <Sun className="size-4 text-amber-500" />
        <Cloud className="size-4 text-slate-400 -ml-2.5" />
        <div className="flex flex-col">
          <span className="font-medium">맑음 3°C</span>
          <span className="text-[10px] text-muted-foreground/70">강수 없음</span>
        </div>
      </div>
    </div>
  );
}
