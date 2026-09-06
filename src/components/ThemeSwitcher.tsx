"use client";

import { useEffect, useState } from "react";
import { THEME_SWITCHER_LABEL } from "@/constants/copy";
import { DEFAULT_THEME, THEMES, THEME_STORAGE_KEY, type ThemeId } from "@/constants/themes";

export default function ThemeSwitcher() {
  const [theme, setTheme] = useState<ThemeId>(DEFAULT_THEME);

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
    <div className="theme-switcher" role="group" aria-label={THEME_SWITCHER_LABEL}>
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
