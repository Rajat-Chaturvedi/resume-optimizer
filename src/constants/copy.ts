export const APP = {
  name: "Resume-to-JD Optimizer",
  description:
    "Upload a resume and a job description to get a keyword/qualification gap report, an ATS compliance audit, a rewritten FAANG-style resume, and ATS-safe PDF/DOCX exports.",
} as const;

export const INPUT_PANEL = {
  title: "1 · Input",
  hint: "PDF, DOCX, or TXT resume up to 8 MB. Scanned images cannot be parsed by an ATS.",
  resumeLabel: "Resume / CV",
  jdLabel: "Job description",
  jdPlaceholder: "Paste the full job description, including requirements and qualifications…",
  run: "Analyze & optimize",
  runAgain: "Run again",
  reportOnly: "Gap report only",
  optimizeNow: "Optimize now",
  idle: "One run produces the gap report, the rewritten resume, and the before/after comparison below.",
  stageAnalyzing: "Parsing your resume and scoring it against the job description…",
  stageOptimizing: "Rewriting bullets, aligning keywords and re-checking ATS compliance…",
  stageConfirming: "Adding your confirmed skills and re-optimizing…",
} as const;

export const VALIDATION = {
  missingResume: "Select a resume file first.",
  shortJd: "Paste a job description (at least 80 characters).",
  analysisFailed: "Analysis failed.",
  optimizationFailed: "Optimization failed.",
  exportFailed: "Export failed.",
} as const;

export const REPORT_PANEL = {
  originalTitle: "2 · Gap report (original resume)",
  optimizedTitle: "3 · Report after optimization",
  editedTitle: "3 · Report after your edits",
  llmBadge: "LLM + rules",
  rulesBadge: "rules engine",
  scoreMatch: "Match score",
  scoreCoverage: "Keyword coverage",
  scoreAts: "ATS structure",
  specializedTitle: "Missing specialized skills",
  specializedHint: "Named technologies or credentials. Only you can confirm these — the optimizer will not claim them.",
  semanticTitle: "Wording / terminology gaps",
  semanticHint:
    "Generic engineering vocabulary. The optimizer adopts this wording wherever your bullets already demonstrate the capability.",
  matchedTitle: (count: number) => `Matched keywords (${count})`,
  weakTitle: "Weak sections",
  needsInputTitle: "Needs your numbers",
  needsInputHint:
    "The optimizer will not invent metrics. These are the only findings it cannot close for you — click a bullet in the preview to add the real figures.",
  fixPrefix: "Fix:",
  atsTitle: "ATS compliance checks",
  atsHint: "Benchmarked against documented parsing behaviour of Workday, Taleo, Greenhouse, Lever and iCIMS.",
  standardPrefix: "Standard:",
} as const;

export const OPTIMIZER_PANEL = {
  title: "What the optimizer changed",
  llmBadge: "LLM rewrite",
  rulesBadge: "rules engine (no LLM key)",
  metric: "Metric",
  before: "Before",
  after: "After",
  delta: "Δ",
  noChange: "no change",
  rowMatch: "Match score",
  rowCoverage: "Keyword coverage",
  rowAts: "ATS structure",
  rowNoMetrics: "Bullets without metrics",
  rowPassive: "Passive / weak openers",
  editsTitle: "Edits applied",
  newlyMatchedTitle: "Keywords now matching the JD",
  closedTitle: "Wording gaps closed automatically",
  closedHint:
    "Your bullets already evidenced these capabilities; the resume now uses the job description's terminology for them.",
  confirmedTitle: "Skills you confirmed",
  checksFixedTitle: "ATS checks fixed",
  confirmCtaTitle: "Have experience with any of these skills? Add them to your resume",
  confirmCtaHint:
    "These are specialized technologies the job description asks for that appear nowhere in your resume. The optimizer will never claim them on your behalf. Tick the ones you genuinely have exposure to and re-run — they will be added to your Skills section and worked into the rewrite.",
  confirmCta: "I have experience with these — optimize my resume",
  clearSelection: "Clear selection",
  lengthTitle: "Resume length",
  lengthHint:
    "Two pages is the industry maximum for most roles, but only you know which bullets matter. Condensing drops the lowest-impact ones (no metrics, no JD keywords, oldest roles first) and never rewords them.",
  lengthAsIs: "Keep every bullet",
  lengthCondense: "Condense to 2 pages",
  trimmedNote: (count: number) => `${count} bullet(s) hidden to fit two pages.`,
  noLlmHint: "Running without an LLM key limits rewriting to structural and phrasing fixes. Set",
  noLlmHintTail: "to enable full JD-targeted rewriting of summary and bullets.",
} as const;

export const TEMPLATE_PANEL = {
  title: "4 · Template library",
  hint:
    "Every template is single-column, table-free, and uses ATS-safe fonts. Selecting one instantly re-renders the preview and export.",
} as const;

export const PREVIEW_PANEL = {
  title: "5 · Preview & export",
  tabOriginal: "Original",
  tabOptimized: "Optimized",
  exportPdf: "Export PDF",
  exportDocx: "Export DOCX",
  zoomOut: "−",
  zoomIn: "+",
  editHint:
    "Click any line to edit it — name, title, contact, skills, dates, bullets, projects, education. Metrics above refresh automatically.",
  rescoring: "re-scoring",
  empty:
    "Run an analysis to see the live preview. Once optimized, click any bullet in the preview to edit it inline before exporting.",
} as const;

/** Section headings shared by the preview, the DOCX export and the PDF export. */
export const SECTION_LABELS = {
  summary: "Summary",
  skills: "Skills",
  experience: "Experience",
  projects: "Projects",
  education: "Education",
  certifications: "Certifications",
} as const;

export const METRICS_WIZARD = {
  title: (count: number) => `Add your numbers (${count} bullet${count === 1 ? "" : "s"})`,
  hint:
    "Only you know the real figures, so the optimizer will not guess them. Type the outcome for any bullet and it will be written in for you — or skip this and edit bullets directly in the preview.",
  cta: "Add my numbers",
  skipHint: "Prefer to do it yourself? Click any bullet in the preview to edit it.",
  placeholder: "e.g. cutting load time by 30% for 200k monthly users",
  needsNumber: "Include a figure (%, $, count, time) — that is the point of the metric.",
  showMore: (count: number) => `Show ${count} more`,
  apply: (count: number) => (count ? `Apply to ${count} bullet${count === 1 ? "" : "s"}` : "Apply"),
  cancel: "Cancel",
} as const;

export const THEME_SWITCHER_LABEL = "Colour theme";
