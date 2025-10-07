'use client';

import { useState, useEffect } from 'react';
import { 
  Cloud, 
  CloudRain, 
  CloudSnow, 
  CloudSun, 
  Droplets, 
  Sun, 
  Wind, 
  AlertCircle,
  RefreshCw
} from 'lucide-react';

// Default to Delengat, Egypt
const DEFAULT_CITY = 'Delengat,EG';

// Cache duration in milliseconds (5 minutes)
const CACHE_DURATION = 5 * 60 * 1000;

interface WeatherData {
  main: {
    temp: number;
    feels_like: number;
    temp_min: number;
    temp_max: number;
    pressure: number;
    humidity: number;
    sea_level?: number;
    grnd_level?: number;
  };
  weather: Array<{
    id: number;
    main: string;
    description: string;
    icon: string;
  }>;
  wind: {
    speed: number;
    deg: number;
    gust?: number;
  };
  clouds: {
    all: number;
  };
  dt: number;
  sys: {
    type: number;
    id: number;
    country: string;
    sunrise: number;
    sunset: number;
  };
  timezone: number;
  id: number;
  name: string;
  cod: number;
}

interface WeatherState {
  data: WeatherData | null;
  loading: boolean;
  error: {
    message: string;
    details?: string;
    retry?: () => void;
  } | null;
  lastUpdated: number | null;
}

const Weather = () => {
  const [state, setState] = useState<WeatherState>({
    data: null,
    loading: true,
    error: null,
    lastUpdated: null,
  });

  const fetchWeather = async (city: string = DEFAULT_CITY) => {
    try {
      setState(prev => ({
        ...prev,
        loading: true,
        error: null,
      }));

      console.log(`🌤️ Fetching weather for: ${city}`);
      
      const response = await fetch(`/api/weather?city=${encodeURIComponent(city)}`);
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.details || data.error || 'فشل في جلب بيانات الطقس');
      }
      
      console.log('✅ Weather data received:', data);
      
      setState({
        data,
        loading: false,
        error: null,
        lastUpdated: Date.now(),
      });
      
      // Save to localStorage for offline use
      if (typeof window !== 'undefined') {
        localStorage.setItem('weatherData', JSON.stringify({
          data,
          timestamp: Date.now(),
        }));
      }
      
      return data;
    } catch (err) {
      console.error('❌ Error fetching weather:', err);
      
      // Try to load cached data if available
      if (typeof window !== 'undefined') {
        const cachedData = localStorage.getItem('weatherData');
        if (cachedData) {
          const { data, timestamp } = JSON.parse(cachedData);
          if (Date.now() - timestamp < CACHE_DURATION * 2) {
            console.log('🔄 Using cached weather data');
            setState(prev => ({
              ...prev,
              data,
              loading: false,
              lastUpdated: timestamp,
            }));
            return;
          }
        }
      }
      
      const errorMessage = err instanceof Error ? err.message : 'حدث خطأ غير متوقع';
      
      setState(prev => ({
        ...prev,
        loading: false,
        error: {
          message: 'تعذر تحميل بيانات الطقس',
          details: errorMessage,
          retry: () => fetchWeather(city),
        },
      }));
      // Do not rethrow; we render a graceful inline error UI instead of crashing the app
    }
  };

  useEffect(() => {
    // Load initial data
    fetchWeather();
    
    // Set up refresh interval
    const intervalId = setInterval(() => {
      fetchWeather();
    }, CACHE_DURATION);
    
    // Cleanup
    return () => clearInterval(intervalId);
  }, []);
  
  // Handle window focus to refresh data
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        // If data is older than cache duration, refresh
        if (state.lastUpdated && (Date.now() - state.lastUpdated > CACHE_DURATION)) {
          fetchWeather();
        }
      }
    };
    
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [state.lastUpdated]);

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

  // Render loading state
  if (state.loading && !state.data) {
    return (
      <div className="flex items-center gap-2 px-3 py-1.5 bg-white/10 backdrop-blur-sm rounded-full text-white">
        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
        <span className="text-sm">جاري تحميل بيانات الطقس...</span>
      </div>
    );
  }

  // Render error state
  if (state.error) {
    return (
      <div className="flex flex-col gap-1 p-2 bg-red-500/10 backdrop-blur-sm rounded-lg text-red-500 max-w-xs">
        <div className="flex items-center gap-2">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span className="text-sm font-medium">{state.error.message}</span>
        </div>
        {state.error.details && (
          <p className="text-xs text-red-400/80 mt-1">{state.error.details}</p>
        )}
        {state.error.retry && (
          <button
            onClick={state.error.retry}
            className="mt-2 flex items-center gap-1 text-xs bg-white/10 hover:bg-white/20 px-2 py-1 rounded-md transition-colors"
            disabled={state.loading}
          >
            {state.loading ? (
              <>
                <RefreshCw className="w-3 h-3 animate-spin" />
                <span>جاري المحاولة...</span>
              </>
            ) : (
              <>
                <RefreshCw className="w-3 h-3" />
                <span>إعادة المحاولة</span>
              </>
            )}
          </button>
        )}
      </div>
    );
  }

  // No data available
  if (!state.data) {
    return null;
  }

  const { data: weather, lastUpdated } = state;
  const temperature = Math.round(weather.main.temp);
  const weatherId = weather.weather[0].id;
  const humidity = weather.main.humidity;
  const windSpeed = Math.round(weather.wind.speed * 3.6); // Convert m/s to km/h
  const locationName = weather.name || 'الدلنجات';
  
  // Format last updated time
  const lastUpdatedTime = lastUpdated ? new Date(lastUpdated) : null;
  const formattedTime = lastUpdatedTime?.toLocaleTimeString('ar-EG', {
    hour: '2-digit',
    minute: '2-digit'
  });

  return (
    <div className="group relative">
      <div className="flex items-center gap-4">
        <div 
          className="flex items-center gap-2 px-3 py-1.5 bg-white/10 hover:bg-white/20 backdrop-blur-sm rounded-full text-white transition-colors cursor-help"
          title={`آخر تحديث: ${formattedTime || 'غير معروف'}`}
        >
          {getWeatherIcon(weatherId)}
          <span className="font-medium">{temperature}°C</span>
          <span className="text-xs opacity-70 mr-1">{locationName}</span>
        </div>
        
        <div className="hidden md:flex items-center gap-4 text-sm text-white/90">
          <div className="flex items-center gap-1" title="الرطوبة">
            <Droplets className="w-4 h-4 text-blue-200" />
            <span>{humidity}%</span>
          </div>
          <div className="flex items-center gap-1" title="سرعة الرياح">
            <Wind className="w-4 h-4 text-gray-200" />
            <span>{windSpeed} كم/س</span>
          </div>
        </div>
      </div>
      
      {/* Tooltip with more info */}
      <div className="hidden group-hover:block absolute z-10 mt-2 w-48 bg-white/90 backdrop-blur-sm text-gray-800 text-xs rounded-lg shadow-lg p-3 transition-opacity">
        <div className="font-medium mb-1">{weather.weather[0].description}</div>
        <div className="grid grid-cols-2 gap-1">
          <span className="text-gray-600">الرطوبة:</span>
          <span>{humidity}%</span>
          
          <span className="text-gray-600">الرياح:</span>
          <span>{windSpeed} كم/س</span>
          
          <span className="text-gray-600">الضغط:</span>
          <span>{weather.main.pressure} هيكتوباسكال</span>
          
          <span className="text-gray-600">آخر تحديث:</span>
          <span>{formattedTime || 'غير معروف'}</span>
        </div>
      </div>
    </div>
  );
};

export default Weather;
