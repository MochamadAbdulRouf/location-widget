"use client"

import { useState, useEffect } from "react"
import { ArrowUpRight } from "lucide-react"

interface LocationTagProps {
  city?: string
  country?: string
  timezone?: string
}

export function LocationTag({ city = "San Francisco", country = "USA", timezone = "PST" }: LocationTagProps) {
  const [isHovered, setIsHovered] = useState(false)
  const [currentTime, setCurrentTime] = useState("")

  useEffect(() => {
    const updateTime = () => {
      const now = new Date()
      setCurrentTime(
        now.toLocaleTimeString("en-US", {
          hour: "2-digit",
          minute: "2-digit",
          hour12: false,
        }),
      )
    }
    updateTime()
    const interval = setInterval(updateTime, 1000)
    return () => clearInterval(interval)
  }, [])

  return (
    <div
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className="group relative flex items-center gap-3 rounded-full border border-border/60 bg-secondary/50 px-4 py-2.5 transition-all duration-500 ease-out hover:border-foreground/20 hover:bg-secondary/80 hover:shadow-[0_0_20px_rgba(0,0,0,0.04)] cursor-pointer"
    >
      {/* Live pulse indicator */}
      <div className="relative flex h-2.5 w-2.5 items-center justify-center">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
        <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
      </div>

      {/* Location text */}
      <div className="flex flex-col">
        <span className="text-sm font-medium text-foreground leading-tight">
          {city}, {country}
        </span>
        <span className="text-xs text-muted-foreground leading-tight">
          {currentTime} {timezone}
        </span>
      </div>

      {/* Arrow indicator */}
      <ArrowUpRight
        className={`h-3.5 w-3.5 text-muted-foreground transition-all duration-300 ${
          isHovered ? "translate-x-0.5 -translate-y-0.5 text-foreground" : ""
        }`}
      />
    </div>
  )
}
