export type ThemeId = "dark" | "light" | "slate" | "contrast";

export type ThemeTokens = {
  bg: string;
  panel: string;
  panel2: string;
  border: string;
  text: string;
  muted: string;
  accent: string;
  /** Text drawn on top of an accent-filled surface. */
  onAccent: string;
  pass: string;
  warn: string;
  fail: string;
  previewBg: string;
};

export type Theme = {
  id: ThemeId;
  label: string;
  tokens: ThemeTokens;
};

export const THEME_STORAGE_KEY = "resume-optimizer-theme";
export const DEFAULT_THEME: ThemeId = "dark";

/**
 * Status colours are tuned per theme so tinted chips clear 4.5:1 contrast
 * against their own background.
 */
export const THEMES: Theme[] = [
  {
    id: "dark",
    label: "Dark",
    tokens: {
      bg: "#0b1020",
      panel: "#131a2f",
      panel2: "#182142",
      border: "#26305a",
      text: "#e8ecf8",
      muted: "#9aa6c8",
      accent: "#6ea8fe",
      onAccent: "#07142c",
      pass: "#35c48a",
      warn: "#e6b455",
      fail: "#ef6b6b",
      previewBg: "#6b7390",
    },
  },
  {
    id: "light",
    label: "Light",
    tokens: {
      bg: "#f4f6fb",
      panel: "#ffffff",
      panel2: "#eef2fa",
      border: "#d3dbea",
      text: "#1a2233",
      muted: "#5c6880",
      accent: "#2563eb",
      onAccent: "#ffffff",
      pass: "#0e6b4d",
      warn: "#8a5600",
      fail: "#a51919",
      previewBg: "#c3cad9",
    },
  },
  {
    id: "slate",
    label: "Slate",
    tokens: {
      bg: "#1b1f24",
      panel: "#23282f",
      panel2: "#2b313a",
      border: "#3a424d",
      text: "#e6e9ee",
      muted: "#a3adba",
      accent: "#7fd1b9",
      onAccent: "#10231d",
      pass: "#6fd6ab",
      warn: "#e5b45c",
      fail: "#ff8f8a",
      previewBg: "#6f7580",
    },
  },
  {
    id: "contrast",
    label: "High contrast",
    tokens: {
      bg: "#000000",
      panel: "#0a0a0a",
      panel2: "#141414",
      border: "#ffffff",
      text: "#ffffff",
      muted: "#d9d9d9",
      accent: "#ffd400",
      onAccent: "#000000",
      pass: "#00e676",
      warn: "#ffd400",
      fail: "#ff5252",
      previewBg: "#333333",
    },
  },
];

const CSS_VARIABLE: Record<keyof ThemeTokens, string> = {
  bg: "--bg",
  panel: "--panel",
  panel2: "--panel-2",
  border: "--border",
  text: "--text",
  muted: "--muted",
  accent: "--accent",
  onAccent: "--on-accent",
  pass: "--pass",
  warn: "--warn",
  fail: "--fail",
  previewBg: "--preview-bg",
};

function declarations(tokens: ThemeTokens): string {
  return (Object.keys(CSS_VARIABLE) as (keyof ThemeTokens)[])
    .map((key) => `${CSS_VARIABLE[key]}:${tokens[key]};`)
    .join("");
}

/** Renders the palettes as CSS custom properties for the document stylesheet. */
export function themeCss(): string {
  const fallback = THEMES.find((t) => t.id === DEFAULT_THEME) ?? THEMES[0];
  const blocks = THEMES.map((theme) => `[data-theme="${theme.id}"]{${declarations(theme.tokens)}}`);
  return [`:root{${declarations(fallback.tokens)}}`, ...blocks].join("");
}
