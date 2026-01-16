import { MapPin, Thermometer, Droplets, Wind, Sun, Cloud, CloudRain, CloudSnow, CloudLightning, Moon } from "lucide-react";
import { WeatherData } from "@/lib/weather";

type WeatherCardProps = {
  data: WeatherData;
};

export default function WeatherCard({ data }: WeatherCardProps) {
  let gradientClass = "from-blue-500 to-blue-600";
  if (data.temp >= 30) gradientClass = "from-orange-500 to-red-500";
  else if (data.temp >= 20) gradientClass = "from-yellow-400 to-orange-500";
  else if (data.temp <= 5) gradientClass = "from-indigo-500 to-purple-600";

  const getWeatherIcon = (desc: string, size = 32) => {
    const d = desc.toLowerCase();
    if (d.includes("clear") || d.includes("sun")) return <Sun size={size} className="text-yellow-300 animate-spin-slow" />;
    if (d.includes("cloud")) return <Cloud size={size} className="text-gray-200" />;
    if (d.includes("rain") || d.includes("drizzle")) return <CloudRain size={size} className="text-blue-200" />;
    if (d.includes("snow")) return <CloudSnow size={size} className="text-white" />;
    if (d.includes("thunder")) return <CloudLightning size={size} className="text-yellow-400" />;
    return <Sun size={size} />;
  };

  return (
    <div className={`bg-gradient-to-br ${gradientClass} rounded-3xl p-5 text-white shadow-xl mb-4 mx-auto w-full max-w-md backdrop-blur-md border border-white/20 relative overflow-hidden group hover:scale-[1.02] transition-transform duration-300`}>
      <div className="absolute top-0 right-0 w-32 h-32 bg-white/20 rounded-full blur-3xl -mr-10 -mt-10" />
      
      <div className="flex items-center justify-between gap-4 relative z-10">
        <div className="flex-1">
          <div className="flex items-center gap-2 text-white/90 text-sm mb-2 font-medium tracking-wide">
            <MapPin size={14} />
            {data.city}, {data.country}
          </div>
          <div className="flex items-center gap-3">
            <span className="text-5xl font-thin tracking-tighter" style={{ fontFamily: "var(--font-outfit)" }}>{data.temp}°</span>
            {getWeatherIcon(data.description)}
          </div>
          <div className="text-white/90 capitalize mt-1 font-medium">{data.description}</div>
        </div>
        
        <div className="bg-white/10 rounded-xl p-3 backdrop-blur-sm border border-white/10 space-y-1.5 text-xs">
          <div className="flex items-center justify-between gap-2">
            <Thermometer size={12} className="text-white/70" /> 
            <span className="font-semibold">{data.feels_like}°</span>
          </div>
          <div className="flex items-center justify-between gap-2">
            <Droplets size={12} className="text-white/70" />
            <span className="font-semibold">{data.humidity}%</span>
          </div>
          <div className="flex items-center justify-between gap-2">
            <Wind size={12} className="text-white/70" />
            <span className="font-semibold">{data.wind}m/s</span>
          </div>
        </div>
      </div>

      {data.forecast && data.forecast.length > 1 && (
        <div className="mt-4 pt-3 border-t border-white/20">
          <div className="flex justify-between gap-1 overflow-x-auto pb-1 scrollbar-hide">
            {data.forecast.map((item, i) => {
              const showDate = i === 0 || item.date !== data.forecast[i-1].date;
              return (
                <div key={i} className="flex flex-col items-center gap-0.5 min-w-[3.8rem] bg-white/5 rounded-xl p-2 backdrop-blur-sm">
                  <span className="text-[10px] font-semibold text-white/90 h-4">
                    {showDate ? item.date : ""}
                  </span>
                  <span className="text-[10px] text-white/60">{item.time}</span>
                  {getWeatherIcon(item.description, 20)}
                  <span className="text-sm font-bold">{item.temp}°</span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
