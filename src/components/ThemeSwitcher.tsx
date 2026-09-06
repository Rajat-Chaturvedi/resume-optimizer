"use client";

import { useEffect, useState } from "react";

export const THEMES = [
  { id: "dark", label: "Dark" },
  { id: "light", label: "Light" },
  { id: "slate", label: "Slate" },
  { id: "contrast", label: "High contrast" },
] as const;

export type ThemeId = (typeof THEMES)[number]["id"];

export const THEME_STORAGE_KEY = "resume-optimizer-theme";

export default function ThemeSwitcher() {
  const [theme, setTheme] = useState<ThemeId>("dark");

  useEffect(() => {
    const stored = document.documentElement.dataset.theme as ThemeId | undefined;
    if (stored) setTheme(stored);
  }, []);

  const apply = (next: ThemeId) => {
    setTheme(next);
    document.documentElement.dataset.theme = next;
    try {
      localStorage.setItem(THEME_STORAGE_KEY, next);
    } catch {
      /* storage unavailable (private mode) */
    }
  };

  return (
    <div className="theme-switcher" role="group" aria-label="Colour theme">
      {THEMES.map((t) => (
        <button
          key={t.id}
          type="button"
          className={theme === t.id ? "active" : ""}
          aria-pressed={theme === t.id}
          onClick={() => apply(t.id)}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}
