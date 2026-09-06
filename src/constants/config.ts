/** Tunable limits shared by the UI and the API routes. */
export const UPLOAD = {
  maxBytes: 8 * 1024 * 1024,
  allowedExtensions: ["pdf", "docx", "txt", "md"] as const,
  accept: ".pdf,.docx,.txt,.md",
  minJdCharacters: 80,
  minResumeCharacters: 120,
} as const;

export const PREVIEW = {
  minZoom: 0.45,
  maxZoom: 1.2,
  zoomStep: 0.1,
  defaultZoom: 0.8,
  /** Idle time before an edit is re-scored against the job description. */
  rescoreDelayMs: 700,
} as const;

export const OPTIMIZER = {
  maxConfirmedSkills: 25,
  maxConfirmedSkillLength: 60,
} as const;

export const LLM = {
  defaultModel: "gpt-4o-mini",
  defaultBaseUrl: "https://api.openai.com/v1",
  timeoutMs: 60_000,
  analysisMaxTokens: 1600,
  rewriteMaxTokens: 4000,
  temperature: 0.2,
} as const;
