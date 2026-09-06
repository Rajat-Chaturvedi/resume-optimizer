export type ContactInfo = {
  name: string;
  title?: string;
  email?: string;
  phone?: string;
  location?: string;
  links: string[];
};

export type ExperienceEntry = {
  company: string;
  role: string;
  location?: string;
  startDate?: string;
  endDate?: string;
  bullets: string[];
};

export type EducationEntry = {
  institution: string;
  degree: string;
  location?: string;
  graduation?: string;
  details: string[];
};

export type ProjectEntry = {
  name: string;
  description?: string;
  bullets: string[];
};

export type SkillGroup = {
  category: string;
  skills: string[];
};

export type StructuredResume = {
  contact: ContactInfo;
  summary?: string;
  skills: SkillGroup[];
  experience: ExperienceEntry[];
  projects: ProjectEntry[];
  education: EducationEntry[];
  certifications: string[];
};

export type KeywordGap = {
  keyword: string;
  /** How often the keyword appears in the job description. */
  jdFrequency: number;
  importance: "critical" | "important" | "nice-to-have";
  category: "hard-skill" | "tool" | "qualification" | "soft-skill" | "domain";
  /** Specialized gaps need user confirmation; semantic gaps may be closed by rewording. */
  gapType: "specialized" | "semantic";
  presentInResume: boolean;
  /** Resume phrase that partially matches (stem/alias hit). */
  partialMatch?: string;
};

export type SectionFinding = {
  section: string;
  severity: "high" | "medium" | "low";
  issue: string;
  recommendation: string;
  /** True when only the candidate can supply the missing facts (e.g. metrics). */
  requiresUserInput?: boolean;
};

export type AtsCheck = {
  id: string;
  label: string;
  standard: string;
  status: "pass" | "warn" | "fail";
  detail: string;
};

export type BulletStats = {
  total: number;
  withoutMetric: number;
  passiveOpeners: number;
};

export type GapReport = {
  matchScore: number;
  keywordCoverage: number;
  missingKeywords: KeywordGap[];
  matchedKeywords: KeywordGap[];
  weakSections: SectionFinding[];
  formattingIssues: AtsCheck[];
  atsChecks: AtsCheck[];
  bulletStats: BulletStats;
  summary: string;
  usedLlm: boolean;
};

export type LengthMode = "as-is" | "condense";

export type OptimizeResult = {
  resume: StructuredResume;
  changeLog: string[];
  injectedKeywords: string[];
  /** JD wording adopted because the resume already evidenced the capability. */
  closedSemanticGaps: { keyword: string; label: string }[];
  /** Specialized skills the user explicitly confirmed having. */
  confirmedSkills: string[];
  lengthMode: LengthMode;
  /** Bullets dropped by the condense pass, so the UI can explain the trade-off. */
  trimmedBullets: number;
  usedLlm: boolean;
};
