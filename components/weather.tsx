'use client';

import { useEffect, useState } from 'react';
import { Droplets, Wind, Cloud, Sun, CloudRain, CloudSnow, CloudSun } from 'lucide-react';

type WeatherData = {
  temp: number;
  humidity: number;
  wind_speed: number;
  weather: Array<{
    main: string;
    description: string;
    icon: string;
    id: number;
  }>;
};

const Weather = ({ city }: { city?: string }) => {
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchWeather = async () => {
      try {
        const CITY = city || 'Cairo,Egypt';
        const response = await fetch(`/api/weather?city=${encodeURIComponent(CITY)}`);

        if (!response.ok) {
          throw new Error('فشل في جلب بيانات الطقس');
        }

        const data = await response.json();
        setWeather(data);
      } catch (err) {
        console.error('خطأ في جلب بيانات الطقس:', err);
        setError('تعذر تحميل بيانات الطقس');
      } finally {
        setLoading(false);
      }
    };

    fetchWeather();
    const interval = setInterval(fetchWeather, 5 * 60 * 1000); // تحديث كل 5 دقائق

    return () => clearInterval(interval);
  }, [city]);

  const getWeatherIcon = (weatherId: number) => {
    if (weatherId >= 200 && weatherId < 300) {
      return <CloudRain className="w-5 h-5" />;
    } else if (weatherId >= 300 && weatherId < 600) {
      return <CloudRain className="w-5 h-5" />;
    } else if (weatherId >= 600 && weatherId < 700) {
      return <CloudSnow className="w-5 h-5" />;
    } else if (weatherId >= 700 && weatherId < 800) {
      return <Cloud className="w-5 h-5" />;
    } else if (weatherId === 800) {
      return <Sun className="w-5 h-5 text-yellow-500" />;
    } else if (weatherId > 800) {
      return <CloudSun className="w-5 h-5" />;
    }
    return <Cloud className="w-5 h-5" />;
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 px-3 py-1.5 bg-white/10 backdrop-blur-sm rounded-full">
        <div className="w-5 h-5 bg-gray-300/50 rounded-full animate-pulse"></div>
        <div className="w-12 h-4 bg-gray-300/50 rounded animate-pulse"></div>
      </div>
    );
  }

  if (error || !weather) {
    return null; // إخفاء المكون في حالة الخطأ
  }

  const temperature = Math.round(weather.temp);
  const weatherId = weather.weather[0].id;
  const humidity = weather.humidity;
  const windSpeed = Math.round(weather.wind_speed * 3.6); // تحويل من م/ث إلى كم/ساعة

  return (
    <div className="flex items-center gap-4">
      <div className="flex items-center gap-2 px-3 py-1.5 bg-white/10 backdrop-blur-sm rounded-full text-white">
        {getWeatherIcon(weatherId)}
        <span className="font-medium">{temperature}°C</span>
      </div>
      <div className="hidden md:flex items-center gap-4 text-sm text-white/90">
        <div className="flex items-center gap-1">
          <Droplets className="w-4 h-4 text-blue-200" />
          <span>{humidity}%</span>
        </div>
        <div className="flex items-center gap-1">
          <Wind className="w-4 h-4 text-gray-200" />
          <span>{windSpeed} كم/س</span>
        </div>
      </div>
    </div>
  );
};

export default Weather;
