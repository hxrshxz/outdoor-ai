import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const city = req.nextUrl.searchParams.get("city");
  if (!city) return NextResponse.json({ error: "City required" }, { status: 400 });

  const apiKey = process.env.OPENWEATHER_API_KEY;
  const lang = req.nextUrl.searchParams.get("lang") || "ja";

  try {
    const geoRes = await fetch(`http://api.openweathermap.org/geo/1.0/direct?q=${encodeURIComponent(city)}&limit=1&appid=${apiKey}`);
    const geoData = await geoRes.json();
    if (!geoData.length) return NextResponse.json({ error: "City not found" }, { status: 404 });

    const { lat, lon, name, country } = geoData[0];

    const weatherRes = await fetch(`https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&appid=${apiKey}&units=metric&lang=${lang}`);
    const weather = await weatherRes.json();

    return NextResponse.json({
      city: name,
      country,
      temp: Math.round(weather.main.temp),
      feels_like: Math.round(weather.main.feels_like),
      humidity: weather.main.humidity,
      description: weather.weather[0].description,
      icon: weather.weather[0].icon,
      wind: weather.wind.speed,
    });
  } catch (err) {
    console.error("Weather error:", err);
    return NextResponse.json({ error: "Weather fetch failed" }, { status: 500 });
  }
}
