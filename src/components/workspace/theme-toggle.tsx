"use client"

import { useEffect, useState } from "react"
import { MoonStarIcon, SunIcon } from "lucide-react"

import { Button } from "@/components/ui/button"

export function ThemeToggle() {
  const [dark, setDark] = useState(false)

  useEffect(() => {
    const stored = localStorage.getItem("lobiie-theme")

    if (
      stored === "dark" ||
      (!stored && window.matchMedia("(prefers-color-scheme: dark)").matches)
    ) {
      document.documentElement.classList.add("dark")
      setDark(true)
    }
  }, [])

  function toggle() {
    const next = !dark
    setDark(next)
    document.documentElement.classList.toggle("dark", next)
    localStorage.setItem("lobiie-theme", next ? "dark" : "light")
  }

  return (
    <Button
      variant="outline"
      size="icon"
      onClick={toggle}
      className="shrink-0"
      aria-label="Toggle theme"
    >
      {dark ? <SunIcon className="size-4" /> : <MoonStarIcon className="size-4" />}
    </Button>
  )
}
