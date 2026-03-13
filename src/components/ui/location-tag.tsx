"use client"

import { useState, useEffect } from "react"

interface Location {
  city: string
  country: string
  timezone: string
  iana: string
}

const LOCATIONS: Location[] = [
  { city: "San Francisco", country: "USA", timezone: "PST", iana: "America/Los_Angeles" },
  { city: "New York", country: "USA", timezone: "EST", iana: "America/New_York" },
  { city: "London", country: "UK", timezone: "GMT", iana: "Europe/London" },
  { city: "Paris", country: "France", timezone: "CET", iana: "Europe/Paris" },
  { city: "Tokyo", country: "Japan", timezone: "JST", iana: "Asia/Tokyo" },
  { city: "Dubai", country: "UAE", timezone: "GST", iana: "Asia/Dubai" },
  { city: "Singapore", country: "Singapore", timezone: "SGT", iana: "Asia/Singapore" },
  { city: "Sydney", country: "Australia", timezone: "AEST", iana: "Australia/Sydney" },
  { city: "Jakarta", country: "Indonesia", timezone: "WIB", iana: "Asia/Jakarta" },
  { city: "Seoul", country: "South Korea", timezone: "KST", iana: "Asia/Seoul" },
]

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

  const location = city
    ? { city, country: country || "", timezone: timezone || "", iana: "" }
    : LOCATIONS[selectedIndex]

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
        <div className="absolute top-full left-1/2 z-50 mt-2 w-56 -translate-x-1/2 rounded-xl border border-border/60 bg-popover p-1.5 shadow-lg animate-in fade-in slide-in-from-top-2 duration-200">
          {LOCATIONS.map((loc, i) => (
            <button
              key={loc.iana}
              onClick={() => selectLocation(i)}
              className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm transition-colors hover:bg-accent ${
                i === selectedIndex ? "bg-accent text-accent-foreground font-medium" : "text-foreground"
              }`}
            >
              <span>{loc.city}, {loc.country}</span>
              <span className="text-xs text-muted-foreground">{loc.timezone}</span>
            </button>
          ))}
        </div>
      )}

      {/* Backdrop to close dropdown */}
      {isOpen && (
        <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
      )}
    </div>
  )
}
