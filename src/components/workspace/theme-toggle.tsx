"use client"

import { useEffect, useState, useRef } from "react"
import { MoonStarIcon, SunIcon, MonitorIcon } from "lucide-react"
import { cn } from "@/lib/utils"

export function ThemeToggle() {
  const [theme, setTheme] = useState<"dark" | "light" | "system">("dark")
  const [isOpen, setIsOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const stored = localStorage.getItem("lobiie-theme") as "dark" | "light" | "system" | null
    Promise.resolve().then(() => {
      if (stored) {
        setTheme(stored)
      } else {
        setTheme("dark") // Default to dark mode
      }
    })
  }, [])

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  function applyTheme(newTheme: "dark" | "light" | "system") {
    setTheme(newTheme)
    localStorage.setItem("lobiie-theme", newTheme)
    
    let isDark = newTheme === "dark"
    if (newTheme === "system") {
      isDark = window.matchMedia("(prefers-color-scheme: dark)").matches
    }
    
    document.documentElement.classList.toggle("dark", isDark)
    setIsOpen(false)
  }

  const activeIcon = {
    light: <SunIcon className="size-4 text-amber-500" />,
    dark: <MoonStarIcon className="size-4 text-blue-500" />,
    system: <MonitorIcon className="size-4 text-zinc-500" />
  }[theme]

  return (
    <div className="relative shrink-0" ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex size-9 items-center justify-center rounded-xl border border-zinc-200/80 bg-white/80 shadow-2xs hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900/80 dark:hover:bg-zinc-800 transition"
        aria-label="Select theme"
      >
        {activeIcon}
      </button>

      {isOpen && (
        <div className="absolute right-0 top-full mt-2 w-32 rounded-xl border border-zinc-200 bg-white p-1 shadow-md dark:border-zinc-800 dark:bg-zinc-900 z-50 animate-in fade-in slide-in-from-top-1 duration-100">
          <button
            type="button"
            onClick={() => applyTheme("light")}
            className={cn(
              "w-full text-left px-2.5 py-1.5 rounded-lg flex items-center gap-2 text-xs transition hover:bg-zinc-100 dark:hover:bg-zinc-800",
              theme === "light" ? "bg-zinc-100 font-semibold text-foreground dark:bg-zinc-800" : "text-muted-foreground"
            )}
          >
            <SunIcon className="size-3.5 text-amber-500" />
            <span>Light</span>
          </button>
          <button
            type="button"
            onClick={() => applyTheme("dark")}
            className={cn(
              "w-full text-left px-2.5 py-1.5 rounded-lg flex items-center gap-2 text-xs transition hover:bg-zinc-100 dark:hover:bg-zinc-800",
              theme === "dark" ? "bg-zinc-100 font-semibold text-foreground dark:bg-zinc-800" : "text-muted-foreground"
            )}
          >
            <MoonStarIcon className="size-3.5 text-blue-500" />
            <span>Dark</span>
          </button>
          <button
            type="button"
            onClick={() => applyTheme("system")}
            className={cn(
              "w-full text-left px-2.5 py-1.5 rounded-lg flex items-center gap-2 text-xs transition hover:bg-zinc-100 dark:hover:bg-zinc-800",
              theme === "system" ? "bg-zinc-100 font-semibold text-foreground dark:bg-zinc-800" : "text-muted-foreground"
            )}
          >
            <MonitorIcon className="size-3.5 text-zinc-500" />
            <span>System</span>
          </button>
        </div>
      )}
    </div>
  )
}
