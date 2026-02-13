"use client";

import { Cloud, Droplets, MapPin } from "lucide-react";
import { useState } from "react";

const DAY_NAMES = ["일", "월", "화", "수", "목", "금", "토"];

// 날씨 타입에 따른 아이콘 매핑
const getWeatherIcon = (weather: string) => {
  const lowerWeather = weather.toLowerCase();
  if (lowerWeather.includes("mist") || lowerWeather.includes("fog")) {
    return <Cloud className="size-5 text-slate-400" />;
  }
  if (lowerWeather.includes("rain") || lowerWeather.includes("drizzle")) {
    return <Droplets className="size-5 text-blue-500" />;
  }
  return <Cloud className="size-5 text-slate-500" />;
};

export default function DateWeatherHeader() {
  const [location] = useState("Chongdong"); // 추후 사용자 선택 기능 추가 가능
  const now = new Date();
  const month = now.getMonth() + 1;
  const date = now.getDate();
  const day = DAY_NAMES[now.getDay()];

  // Mock 데이터 - 추후 API로 교체
  const weatherData = {
    location: location,
    temperature: 5.1,
    feelsLike: 4.6,
    weather: "Mist",
    precipitation: 0.0,
  };

  return (
    <div className="space-y-3">
      {/* 날짜 */}
      <div className="flex items-center justify-between rounded-xl bg-gradient-to-r from-blue-50/50 to-purple-50/30 p-4 border border-border/40">
        <span className="text-xl font-semibold text-foreground tracking-tight">
          {month}/{date} ({day})
        </span>
      </div>

      {/* 날씨 정보 */}
      <div className="rounded-xl bg-gradient-to-br from-slate-50/80 to-blue-50/40 p-4 border border-border/40 space-y-3">
        {/* 위치 */}
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <MapPin className="size-4 text-blue-600" />
          <span className="font-medium text-foreground/80">현재 위치: {weatherData.location}</span>
        </div>

        {/* 기온 정보 */}
        <div className="grid grid-cols-2 gap-3">
          <div className="flex items-center gap-2">
            <div className="flex-1">
              <div className="text-xs text-muted-foreground mb-0.5">현재 기온</div>
              <div className="text-lg font-bold text-foreground">
                {weatherData.temperature}°C
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex-1">
              <div className="text-xs text-muted-foreground mb-0.5">체감</div>
              <div className="text-lg font-bold text-foreground">
                {weatherData.feelsLike}°C
              </div>
            </div>
          </div>
        </div>

        {/* 날씨 및 강수 */}
        <div className="flex items-center justify-between pt-2 border-t border-border/30">
          <div className="flex items-center gap-2">
            {getWeatherIcon(weatherData.weather)}
            <div>
              <div className="text-xs text-muted-foreground">날씨</div>
              <div className="text-sm font-semibold text-foreground">
                {weatherData.weather}
              </div>
            </div>
          </div>
          <div className="text-right">
            <div className="text-xs text-muted-foreground">강수</div>
            <div className="text-sm font-semibold text-foreground">
              {weatherData.precipitation}mm
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
