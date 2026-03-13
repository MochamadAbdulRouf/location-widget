"use client"

import { useState, useEffect, useCallback } from "react"

interface Location {
  city: string
  country: string
  timezone: string
  iana: string
  lat: number
  lon: number
}

interface WeatherData {
  temperature: number
  weatherCode: number
}

const LOCATIONS: Location[] = [
  { city: "San Francisco", country: "USA", timezone: "PST", iana: "America/Los_Angeles", lat: 37.77, lon: -122.42 },
  { city: "New York", country: "USA", timezone: "EST", iana: "America/New_York", lat: 40.71, lon: -74.01 },
  { city: "London", country: "UK", timezone: "GMT", iana: "Europe/London", lat: 51.51, lon: -0.13 },
  { city: "Paris", country: "France", timezone: "CET", iana: "Europe/Paris", lat: 48.86, lon: 2.35 },
  { city: "Tokyo", country: "Japan", timezone: "JST", iana: "Asia/Tokyo", lat: 35.68, lon: 139.69 },
  { city: "Dubai", country: "UAE", timezone: "GST", iana: "Asia/Dubai", lat: 25.20, lon: 55.27 },
  { city: "Singapore", country: "Singapore", timezone: "SGT", iana: "Asia/Singapore", lat: 1.35, lon: 103.82 },
  { city: "Sydney", country: "Australia", timezone: "AEST", iana: "Australia/Sydney", lat: -33.87, lon: 151.21 },
  { city: "Jakarta", country: "Indonesia", timezone: "WIB", iana: "Asia/Jakarta", lat: -6.21, lon: 106.85 },
  { city: "Seoul", country: "South Korea", timezone: "KST", iana: "Asia/Seoul", lat: 37.57, lon: 126.98 },
]

function getWeatherEmoji(code: number): string {
  if (code === 0) return "☀️"
  if (code <= 3) return "⛅"
  if (code <= 48) return "🌫️"
  if (code <= 57) return "🌦️"
  if (code <= 65) return "🌧️"
  if (code <= 67) return "🌨️"
  if (code <= 77) return "❄️"
  if (code <= 82) return "🌧️"
  if (code <= 86) return "🌨️"
  if (code <= 99) return "⛈️"
  return "🌡️"
}

function getWeatherLabel(code: number): string {
  if (code === 0) return "Clear"
  if (code <= 3) return "Cloudy"
  if (code <= 48) return "Foggy"
  if (code <= 57) return "Drizzle"
  if (code <= 65) return "Rain"
  if (code <= 67) return "Freezing Rain"
  if (code <= 77) return "Snow"
  if (code <= 82) return "Showers"
  if (code <= 86) return "Snow Showers"
  if (code <= 99) return "Thunderstorm"
  return "Unknown"
}

interface LocationTagProps {
  city?: string
  country?: string
  timezone?: string
}

export function LocationTag({ city, country, timezone }: LocationTagProps) {
  const [isHovered, setIsHovered] = useState(false)
  const [currentTime, setCurrentTime] = useState("")
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [isOpen, setIsOpen] = useState(false)
  const [weatherMap, setWeatherMap] = useState<Record<string, WeatherData>>({})

  const location = city
    ? { city, country: country || "", timezone: timezone || "", iana: "", lat: 0, lon: 0 }
    : LOCATIONS[selectedIndex]

  const fetchWeather = useCallback(async () => {
    const lats = LOCATIONS.map((l) => l.lat).join(",")
    const lons = LOCATIONS.map((l) => l.lon).join(",")

    try {
      // Fetch all at once using individual calls (Open-Meteo doesn't support batch, so we do parallel)
      const results = await Promise.all(
        LOCATIONS.map(async (loc) => {
          const res = await fetch(
            `https://api.open-meteo.com/v1/forecast?latitude=${loc.lat}&longitude=${loc.lon}&current=temperature_2m,weather_code`
          )
          if (!res.ok) return null
          const data = await res.json()
          return {
            iana: loc.iana,
            temperature: Math.round(data.current.temperature_2m),
            weatherCode: data.current.weather_code,
          }
        })
      )

      const map: Record<string, WeatherData> = {}
      results.forEach((r) => {
        if (r) map[r.iana] = { temperature: r.temperature, weatherCode: r.weatherCode }
      })
      setWeatherMap(map)
    } catch (e) {
      console.error("Failed to fetch weather:", e)
    }
  }, [])

  useEffect(() => {
    fetchWeather()
    const interval = setInterval(fetchWeather, 10 * 60 * 1000) // refresh every 10 min
    return () => clearInterval(interval)
  }, [fetchWeather])

  useEffect(() => {
    const updateTime = () => {
      const now = new Date()
      const options: Intl.DateTimeFormatOptions = {
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      }
      if (location.iana) {
        options.timeZone = location.iana
      }
      setCurrentTime(now.toLocaleTimeString("en-US", options))
    }
    updateTime()
    const interval = setInterval(updateTime, 1000)
    return () => clearInterval(interval)
  }, [location.iana])

  const handleClick = () => {
    if (!city) {
      setIsOpen((prev) => !prev)
    }
  }

  const selectLocation = (index: number) => {
    setSelectedIndex(index)
    setIsOpen(false)
  }

  const currentWeather = location.iana ? weatherMap[location.iana] : undefined

  return (
    <div className="relative">
      <button
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        onClick={handleClick}
        className="group relative flex items-center gap-3 rounded-full border border-border/60 bg-secondary/50 px-4 py-2.5 transition-all duration-500 ease-out hover:border-foreground/20 hover:bg-secondary/80 hover:shadow-[0_0_20px_rgba(0,0,0,0.04)]"
      >
        {/* Live pulse indicator */}
        <div className="relative flex items-center justify-center">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-500 opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
          </span>
        </div>

        {/* Location text */}
        <div className="flex items-center gap-2 overflow-hidden">
          <span
            className="text-sm font-medium text-foreground transition-all duration-500"
            style={{
              transform: isHovered ? "translateY(-100%)" : "translateY(0)",
              opacity: isHovered ? 0 : 1,
            }}
          >
            {currentWeather && (
              <span className="mr-1.5">{getWeatherEmoji(currentWeather.weatherCode)}</span>
            )}
            {location.city}, {location.country}
          </span>
          <span
            className="absolute left-11 text-sm font-medium text-foreground transition-all duration-500"
            style={{
              transform: isHovered ? "translateY(0)" : "translateY(100%)",
              opacity: isHovered ? 1 : 0,
            }}
          >
            {currentTime} {location.timezone}
            {currentWeather && (
              <span className="ml-2 text-muted-foreground">{currentWeather.temperature}°C</span>
            )}
          </span>
        </div>

        {/* Arrow indicator */}
        <svg
          className="h-3 w-3 text-muted-foreground transition-all duration-300"
          style={{
            transform: isHovered ? "translateX(2px) rotate(-45deg)" : "translateX(0) rotate(0)",
            opacity: isHovered ? 1 : 0.5,
          }}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 19.5l15-15m0 0H8.25m11.25 0v11.25" />
        </svg>
      </button>

      {/* Dropdown */}
      {isOpen && (
        <div className="absolute top-full left-1/2 z-50 mt-2 w-72 -translate-x-1/2 rounded-xl border border-border/60 bg-popover p-1.5 shadow-lg animate-in fade-in slide-in-from-top-2 duration-200">
          {LOCATIONS.map((loc, i) => {
            const w = weatherMap[loc.iana]
            return (
              <button
                key={loc.iana}
                onClick={() => selectLocation(i)}
                className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm transition-colors hover:bg-accent ${
                  i === selectedIndex ? "bg-accent text-accent-foreground font-medium" : "text-foreground"
                }`}
              >
                <span className="flex items-center gap-2">
                  {w && <span>{getWeatherEmoji(w.weatherCode)}</span>}
                  <span>{loc.city}, {loc.country}</span>
                </span>
                <span className="flex items-center gap-2 text-xs text-muted-foreground">
                  {w && <span>{w.temperature}°C</span>}
                  <span>{loc.timezone}</span>
                </span>
              </button>
            )
          })}
        </div>
      )}

      {/* Backdrop to close dropdown */}
      {isOpen && (
        <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
      )}
    </div>
  )
}
