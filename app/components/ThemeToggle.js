"use client";

import { useEffect, useState } from "react";
import { useTheme } from "next-themes";
import { Sun, Moon, Monitor } from "lucide-react";

/**
 * @param {{ variant?: 'default' | 'landing', className?: string }} props
 * `landing`: buttons styled for the dark marketing header (high contrast).
 */
export default function ThemeToggle({ variant = "default", className = "" }) {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <div
        className={`h-9 min-w-[7.25rem] shrink-0 rounded-md border border-transparent ${className}`}
        aria-hidden
      />
    );
  }

  const landing = variant === "landing";
  const btn =
    "flex h-9 w-9 shrink-0 items-center justify-center rounded-md border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 " +
    (landing
      ? "border-white/30 bg-white/5 text-white hover:bg-white/15 focus-visible:ring-offset-[#0A0A0F]"
      : "border-border bg-background text-foreground hover:bg-muted");

  const pressLanding = "bg-white/20 border-white/50";
  const pressDefault = "bg-muted border-border";

  const isLight = theme === "light";
  const isDark = theme === "dark";
  const isSystem = theme === "system";

  return (
    <div
      className={`inline-flex items-center gap-0.5 rounded-lg ${landing ? "border border-white/20 bg-black/20 p-0.5" : "p-0.5"} ${className}`}
      role="group"
      aria-label="Color theme"
    >
      <button
        type="button"
        aria-label="Use light theme"
        aria-pressed={isLight}
        className={`${btn} ${isLight ? (landing ? pressLanding : pressDefault) : ""}`}
        onClick={() => setTheme("light")}
      >
        <Sun className="h-4 w-4" aria-hidden />
      </button>
      <button
        type="button"
        aria-label="Use dark theme"
        aria-pressed={isDark}
        className={`${btn} ${isDark ? (landing ? pressLanding : pressDefault) : ""}`}
        onClick={() => setTheme("dark")}
      >
        <Moon className="h-4 w-4" aria-hidden />
      </button>
      <button
        type="button"
        aria-label="Use system theme"
        aria-pressed={isSystem}
        className={`${btn} ${isSystem ? (landing ? pressLanding : pressDefault) : ""}`}
        onClick={() => setTheme("system")}
      >
        <Monitor className="h-4 w-4" aria-hidden />
      </button>
    </div>
  );
}
