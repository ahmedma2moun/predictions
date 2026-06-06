"use client";
import { useEffect, useState } from "react";
import { Sun, Moon } from "lucide-react";
import { cn } from "@/lib/utils";

type Theme = "dark" | "light";

const HINT_KEY = "theme_hint_v1";

function getCookieTheme(): Theme {
  const m = document.cookie.match(/(?:^|;\s*)theme=([^;]*)/);
  return m?.[1] === "light" ? "light" : "dark";
}

function saveCookie(theme: Theme) {
  document.cookie = `theme=${theme}; path=/; max-age=${60 * 60 * 24 * 365}; SameSite=Lax`;
}

export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme | null>(null);
  const [showHint, setShowHint] = useState(false);

  useEffect(() => {
    setTheme(getCookieTheme());

    if (!localStorage.getItem(HINT_KEY)) {
      const show = setTimeout(() => setShowHint(true), 1200);
      return () => clearTimeout(show);
    }
  }, []);

  useEffect(() => {
    if (!showHint) return;
    localStorage.setItem(HINT_KEY, "1");
    const hide = setTimeout(() => setShowHint(false), 5000);
    return () => clearTimeout(hide);
  }, [showHint]);

  useEffect(() => {
    if (theme === null) return;
    const html = document.documentElement;
    if (theme === "light") {
      html.classList.remove("dark");
      html.classList.add("light");
    } else {
      html.classList.remove("light");
      html.classList.add("dark");
    }
  }, [theme]);

  function toggle() {
    setShowHint(false);
    setTheme(prev => {
      const next: Theme = prev === "dark" ? "light" : "dark";
      saveCookie(next);
      return next;
    });
  }

  if (theme === null) {
    return <span className="inline-block h-7 w-7 shrink-0" aria-hidden />;
  }

  return (
    <div className="relative shrink-0">
      <button
        onClick={toggle}
        aria-label={theme === "dark" ? "Switch to Light theme" : "Switch to Dark theme"}
        title={theme === "dark" ? "Switch to Light theme" : "Switch to Dark theme"}
        className={cn(
          "inline-flex h-7 w-7 items-center justify-center rounded-md transition-colors",
          "hover:bg-accent hover:text-accent-foreground",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        )}
      >
        {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
      </button>

      {showHint && (
        <div
          className={cn(
            "absolute right-0 top-full mt-2 z-[60]",
            "w-max max-w-[160px]",
            "rounded-lg px-3 py-2",
            "bg-primary text-primary-foreground text-xs font-medium shadow-lg",
            "pointer-events-none",
            "animate-in fade-in slide-in-from-top-1 duration-200"
          )}
        >
          <span className="absolute -top-1.5 right-2.5 h-3 w-3 rotate-45 rounded-sm bg-primary" />
          Try the light mode ☀️
        </div>
      )}
    </div>
  );
}
