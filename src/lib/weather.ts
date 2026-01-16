export type ForecastItem = {
  time: string;
  date: string;
  temp: number;
  description: string;
  icon: string;
};

export type WeatherData = {
  city: string;
  country: string;
  temp: number;
  feels_like: number;
  humidity: number;
  description: string;
  icon: string;
  wind: number;
  forecast: ForecastItem[];
};

function getDateLabel(date: Date, lang: string): string {
  const now = new Date();
  
  const dateKey = (d: Date) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
  
  const targetKey = dateKey(date);
  const todayKey = dateKey(now);

  const tomorrow = new Date(now);
  tomorrow.setDate(now.getDate() + 1);
  const tomorrowKey = dateKey(tomorrow);

  if (targetKey === todayKey) return lang === 'ja' ? '今日' : 'Today';
  if (targetKey === tomorrowKey) return lang === 'ja' ? '明日' : 'Tomorrow';
  
  return date.toLocaleDateString(lang === 'ja' ? 'ja-JP' : 'en-US', { 
    weekday: 'short',
    month: 'short',
    day: 'numeric'
  });
}

export async function getWeather(city: string, lang = "ja", days = 1): Promise<WeatherData | null> {
  const apiKey = process.env.OPENWEATHER_API_KEY;
  if (!apiKey) {
    console.error("OPENWEATHER_API_KEY is not set");
    return null;
  }

  try {
    let query = city;
    
    
    const countryNormalization: Record<string, string> = {
      'UK': 'GB',
      'USA': 'US',
      'United States': 'US',
      'United Kingdom': 'GB',
      'England': 'GB',
    };
    
    for (const [variant, iso] of Object.entries(countryNormalization)) {
      if (query.toLowerCase().endsWith(`, ${variant.toLowerCase()}`)) {
        query = query.slice(0, -variant.length) + iso;
        break;
      }
    }
    
    if (lang === 'ja' && !city.includes(',') && !city.toLowerCase().includes('japan')) {
      if (city === '京都') query = 'Kyoto, JP';
      else query = `${city}, JP`;
    }
    const geoRes = await fetch(`http://api.openweathermap.org/geo/1.0/direct?q=${encodeURIComponent(query)}&limit=1&appid=${apiKey}`);
    let geoData = await geoRes.json();
    
    if (!geoData?.length && query !== city) {
      const retryRes = await fetch(`http://api.openweathermap.org/geo/1.0/direct?q=${encodeURIComponent(city)}&limit=1&appid=${apiKey}`);
      geoData = await retryRes.json();
    }

    if (!geoData?.length) return null;

    const { lat, lon, name, country } = geoData[0];

    const weatherRes = await fetch(`https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&appid=${apiKey}&units=metric&lang=${lang}`);
    const weather = await weatherRes.json();
    if (!weather?.main) return null;

    const forecastRes = await fetch(`https://api.openweathermap.org/data/2.5/forecast?lat=${lat}&lon=${lon}&appid=${apiKey}&units=metric&lang=${lang}`);
    const forecastData = await forecastRes.json();
    
    let processedList: any[] = [];
    
    if (days > 1) {
      const dailyMap = new Map<string, any>();
      
      (forecastData.list || []).forEach((item: any) => {
        const dateObj = new Date(item.dt * 1000);
        const dateKey = `${dateObj.getFullYear()}-${dateObj.getMonth()}-${dateObj.getDate()}`;
        
        if (!dailyMap.has(dateKey)) {
          dailyMap.set(dateKey, item);
        } else {
          const existing = dailyMap.get(dateKey);
          const existingHour = new Date(existing.dt * 1000).getHours();
          const currentHour = dateObj.getHours();
          
          if (Math.abs(currentHour - 12) < Math.abs(existingHour - 12)) {
            dailyMap.set(dateKey, item);
          }
        }
      });
      
      processedList = Array.from(dailyMap.values()).slice(0, 5);
    } else {
      processedList = (forecastData.list || []).slice(0, 1);
    }

    const forecast: ForecastItem[] = processedList.map((item: any, index: number) => {
      const forecastDate = new Date(item.dt * 1000);
      const dateLabel = getDateLabel(forecastDate, lang);

      if (index === 0 && (dateLabel === 'Today' || dateLabel === '今日')) {
        return {
          time: "Now",
          date: dateLabel,
          temp: Math.round(weather.main.temp),
          description: weather.weather[0].description,
          icon: weather.weather[0].icon
        };
      }

      return {
        time: forecastDate.toLocaleTimeString(lang === 'ja' ? 'ja-JP' : 'en-US', { hour: '2-digit', minute: '2-digit' }),
        date: dateLabel,
        temp: Math.round(item.main.temp),
        description: item.weather[0].description,
        icon: item.weather[0].icon
      };
    });

    return {
      city: name,
      country,
      temp: Math.round(weather.main.temp),
      feels_like: Math.round(weather.main.feels_like),
      humidity: weather.main.humidity,
      description: weather.weather[0].description,
      icon: weather.weather[0].icon,
      wind: weather.wind.speed,
      forecast
    };
  } catch (err) {
    console.error("Weather fetch error:", err);
    return null;
  }
}
