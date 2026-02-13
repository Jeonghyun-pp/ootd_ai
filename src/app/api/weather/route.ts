import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const location = searchParams.get("location") || "Chongdong";

    // 환경 변수에서 API 키 가져오기
    const apiKey = process.env.WEATHER_API_KEY;
    const apiUrl = process.env.WEATHER_API_URL;

    if (!apiKey || !apiUrl) {
      // 환경 변수가 없으면 Mock 데이터 반환 (개발용)
      return NextResponse.json({
        location: location,
        temperature: 5.1,
        feelsLike: 4.6,
        weather: "Mist",
        precipitation: 0.0,
      });
    }

    // 실제 API 호출
    const response = await fetch(
      `${apiUrl}?location=${encodeURIComponent(location)}&key=${apiKey}`
    );

    if (!response.ok) {
      throw new Error(`Weather API error: ${response.statusText}`);
    }

    const data = await response.json();

    // API 응답을 표준 형식으로 변환
    return NextResponse.json({
      location: data.location || location,
      temperature: data.temperature || data.temp || data.main?.temp || 0,
      feelsLike: data.feelsLike || data.feels_like || data.main?.feels_like || 0,
      weather: data.weather || data.weatherMain || data.weather?.[0]?.main || "Clear",
      precipitation: data.precipitation || data.rain?.amount || data.rain?.["1h"] || 0.0,
    });
  } catch (error) {
    console.error("Weather API error:", error);
    return NextResponse.json(
      { error: "날씨 정보를 가져오는데 실패했습니다." },
      { status: 500 }
    );
  }
}
