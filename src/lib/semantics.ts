import { findInText } from "./keywords";
import type { KeywordGap, StructuredResume } from "./types";

/**
 * Splits JD gaps into two classes:
 *  - specialized: a named technology, platform or credential that cannot be inferred
 *    from anything else on the resume, so it needs explicit user confirmation.
 *  - semantic: generic engineering/quality/leadership vocabulary that the resume may
 *    already demonstrate under different wording, which the optimizer may realign.
 */
export function isSpecialized(gap: Pick<KeywordGap, "keyword" | "category">): boolean {
  if (gap.category === "tool" || gap.category === "qualification") return true;
  // Named products/platforms occasionally land in other buckets (e.g. "pub/sub").
  return /\b(sdk|api gateway|pub\/sub|pubsub)\b/i.test(gap.keyword);
}

export type SemanticRule = {
  /** Matches the JD keyword that is currently unmatched. */
  match: RegExp;
  /** Competency wording that contains the JD keyword literally, for exact ATS matching. */
  label: string;
  /** Evidence that must already exist in the resume before the wording may be used. */
  evidence: RegExp;
};

export const SEMANTIC_RULES: SemanticRule[] = [
  {
    match: /^(leadership|lead|technical leadership|ownership)$/i,
    label: "Technical Leadership",
    evidence: /\b(led|leading|spearhead|headed|owned|drove|managed|mentor)/i,
  },
  {
    match: /^(mentoring|mentorship|mentor|coaching)$/i,
    label: "Mentoring & Knowledge Sharing",
    evidence: /\b(mentor|coach|guid(ed|ing)|onboard|knowledge shar|pair(ed)? program|junior)/i,
  },
  {
    match: /^(high-quality|quality|code quality)$/i,
    label: "High-Quality, Test-Backed Delivery",
    evidence: /\b(code review|test|jest|cypress|storybook|lint|quality|standard)/i,
  },
  {
    match: /^(secure|security|secure implementation)$/i,
    label: "Secure Implementation Practices",
    evidence: /\b(auth|secur|oauth|jwt|clerk|payment|encryp|pci|owasp|token)/i,
  },
  {
    match: /^(maintainable|maintainability|extendable|extensibility|modular)$/i,
    label: "Maintainable, Extendable Architecture",
    evidence: /\b(maintainab|reusab|modular|component librar|refactor|design system|shared package)/i,
  },
  {
    match: /^(scalable|scalability)$/i,
    label: "Scalable Frontend Systems",
    evidence: /\b(scalab|scale|high-performance|throughput|load|traffic|performance)/i,
  },
  {
    match: /^(architecture|architectural|system design)$/i,
    label: "Application Architecture",
    evidence: /\b(architect|design system|monorepo|micro|module|structure|ssr|ssg)/i,
  },
  {
    match: /^(collaboration|collaborate|cross functional|cross-functional|teamwork)$/i,
    label: "Cross-functional Collaboration",
    evidence: /\b(collaborat|cross[- ]functional|partner|stakeholder|agile|scrum|kanban|product)/i,
  },
  {
    match: /^(problem solving|troubleshooting|debugging)$/i,
    label: "Problem Solving & Root-cause Analysis",
    evidence: /\b(debug|root cause|resolv|troubleshoot|fix|optimiz|incident)/i,
  },
  {
    match: /^(best practices|engineering practices|coding standards|convention)$/i,
    label: "Engineering Best Practices",
    evidence: /\b(best practice|standard|convention|code review|ci\/cd|lint|guideline)/i,
  },
  {
    match: /^(web technologies|modern web|frontend development)$/i,
    label: "Modern Web Technologies",
    evidence: /\b(html|css|javascript|typescript|react|next|vite|webpack|browser)/i,
  },
  {
    match: /^(implementation|delivery|execution|technically)$/i,
    label: "End-to-end Technical Implementation",
    evidence: /\b(built|develop|implement|deliver|shipped|launch|integrat)/i,
  },
  {
    match: /^(accessibility|usability|inclusive design)$/i,
    label: "Accessibility & Usability",
    evidence: /\b(accessib|wcag|a11y|aria|usab|screen reader)/i,
  },
  {
    match: /^(responsive|responsiveness|cross browser|cross-browser)$/i,
    label: "Responsive, Cross-browser Delivery",
    evidence: /\b(responsive|mobile[- ]first|breakpoint|cross[- ]browser|safari|firefox)/i,
  },
  {
    match: /^(performance|optimization|performance optimization)$/i,
    label: "Performance Optimization",
    evidence: /\b(performance|core web vitals|lcp|cls|ttfb|lazy|code splitting|cache)/i,
  },
  {
    match: /^(technical|technical expertise)$/i,
    label: "Technical Ownership",
    evidence: /\b(architect|technical|owned|led|design)/i,
  },
];

/** Resume phrasings that map onto the JD's preferred vocabulary without changing meaning. */
export const TERMINOLOGY_SWAPS: { requires: RegExp; pattern: RegExp; replacement: string }[] = [
  { requires: /mentor/i, pattern: /\bguided\b/gi, replacement: "mentored" },
  { requires: /mentor/i, pattern: /\bcoached\b/gi, replacement: "mentored" },
  { requires: /cross[- ]functional/i, pattern: /\bcross[- ]team\b/gi, replacement: "cross-functional" },
  { requires: /collaborat/i, pattern: /\bworked with\b/gi, replacement: "collaborated with" },
  { requires: /collaborat/i, pattern: /\bteamed up with\b/gi, replacement: "collaborated with" },
  { requires: /maintainab/i, pattern: /\beasy to maintain\b/gi, replacement: "maintainable" },
  { requires: /accessib/i, pattern: /\ba11y\b/gi, replacement: "accessibility" },
];

export function resumeEvidenceText(resume: StructuredResume): string {
  return [
    resume.summary ?? "",
    ...resume.skills.flatMap((g) => [g.category, ...g.skills]),
    ...resume.experience.flatMap((e) => [e.role, e.company, ...e.bullets]),
    ...resume.projects.flatMap((p) => [p.name, p.description ?? "", ...p.bullets]),
    ...resume.certifications,
  ].join("\n");
}

export type SemanticClosure = { keyword: string; label: string };

/** Semantic gaps whose underlying capability the resume already evidences. */
export function findSemanticClosures(gaps: KeywordGap[], resume: StructuredResume): SemanticClosure[] {
  const evidence = resumeEvidenceText(resume);
  const closures: SemanticClosure[] = [];

  for (const gap of gaps) {
    if (isSpecialized(gap)) continue;
    const rule = SEMANTIC_RULES.find((r) => r.match.test(gap.keyword));
    if (!rule || !rule.evidence.test(evidence)) continue;
    // Only claim closure when the competency wording actually contains the JD term.
    if (!findInText(gap.keyword, rule.label.toLowerCase())) continue;
    closures.push({ keyword: gap.keyword, label: rule.label });
  }

  return closures;
}
