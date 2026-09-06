import { analyseSections, runAtsChecks, scoreFromChecks } from "./ats";
import type { ExtractedDocument } from "./extract";
import { extractKeywords, findInText, focusRequirements, normalise, type Keyword } from "./keywords";
import { llmEnabled, llmJson } from "./llm";
import { resumeToPlainText } from "./resumeParser";
import { isSpecialized } from "./semantics";
import type { GapReport, KeywordGap, StructuredResume } from "./types";

const FORMATTING_CHECK_IDS = new Set([
  "single-column",
  "no-tables",
  "no-graphics",
  "fonts",
  "characters",
  "length",
  "file-format",
]);

function classifyImportance(keyword: Keyword, rank: number): KeywordGap["importance"] {
  const concrete = keyword.category === "tool" || keyword.category === "hard-skill" || keyword.category === "qualification";
  if (concrete && (keyword.frequency >= 2 || rank < 12)) return "critical";
  if (concrete) return "important";
  if (keyword.frequency >= 3) return "important";
  return "nice-to-have";
}

/**
 * Scores a structured resume as the exporter will render it: single column, no
 * tables, no graphics, standard fonts.
 */
export async function verifyResume(resume: StructuredResume, jdText: string): Promise<GapReport> {
  const text = resumeToPlainText(resume);
  return buildGapReport(
    text,
    jdText,
    {
      source: "docx",
      pageCount: Math.max(1, Math.round(text.length / 3500)),
      hasImages: false,
      hasTables: false,
      multiColumn: false,
      nonStandardFonts: [],
      embeddedFonts: [],
      charCount: text.length,
    },
    resume,
    { useLlm: false }
  );
}

export async function buildGapReport(
  resumeText: string,
  jdText: string,
  signals: ExtractedDocument["signals"],
  resume: StructuredResume,
  options: { useLlm?: boolean } = {}
): Promise<GapReport> {
  const jdKeywords = extractKeywords(focusRequirements(jdText), 55);
  const resumeHaystack = normalise(`${resumeText}\n${resumeToPlainText(resume)}`);

  const matched: KeywordGap[] = [];
  const missing: KeywordGap[] = [];

  jdKeywords.forEach((kw, index) => {
    const hit = findInText(kw.term, resumeHaystack);
    const gap: KeywordGap = {
      keyword: kw.term,
      jdFrequency: kw.frequency,
      importance: classifyImportance(kw, index),
      category: kw.category,
      gapType: isSpecialized({ keyword: kw.term, category: kw.category }) ? "specialized" : "semantic",
      presentInResume: Boolean(hit),
      partialMatch: hit && hit !== kw.term ? hit : undefined,
    };
    (hit ? matched : missing).push(gap);
  });

  const weights = { critical: 3, important: 2, "nice-to-have": 1 } as const;
  const totalWeight = jdKeywords.reduce((sum, kw, i) => sum + weights[classifyImportance(kw, i)], 0);
  const matchedWeight = matched.reduce((sum, k) => sum + weights[k.importance], 0);
  const keywordCoverage = totalWeight ? Math.round((matchedWeight / totalWeight) * 100) : 0;

  const atsChecks = runAtsChecks(resumeText, signals, resume);
  const formattingIssues = atsChecks.filter((c) => FORMATTING_CHECK_IDS.has(c.id) && c.status !== "pass");
  const atsScore = scoreFromChecks(atsChecks);

  let weakSections = analyseSections(resume);
  let summary = `Keyword coverage against the job description is ${keywordCoverage}% with ${missing.length} unmatched terms; ATS structural compliance scores ${atsScore}/100.`;
  let usedLlm = false;

  if (options.useLlm !== false && llmEnabled()) {
    const llm = await llmJson<{
      summary?: string;
      weakSections?: { section: string; severity: string; issue: string; recommendation: string }[];
      missingQualifications?: string[];
    }>([
      {
        role: "system",
        content:
          "You are a technical recruiter and ATS specialist. Compare a resume with a job description. Respond ONLY with JSON: {\"summary\": string (<=90 words), \"weakSections\": [{\"section\": string, \"severity\": \"high\"|\"medium\"|\"low\", \"issue\": string, \"recommendation\": string}], \"missingQualifications\": string[]}. Never invent experience the candidate does not have.",
      },
      {
        role: "user",
        content: `JOB DESCRIPTION:\n${jdText.slice(0, 6000)}\n\nRESUME:\n${resumeText.slice(0, 9000)}\n\nDeterministic findings: coverage ${keywordCoverage}%, missing keywords: ${missing
          .slice(0, 25)
          .map((m) => m.keyword)
          .join(", ")}.`,
      },
    ], 1600);

    if (llm) {
      usedLlm = true;
      if (llm.summary) summary = llm.summary;
      const extra = (llm.weakSections ?? [])
        .filter((s) => s.section && s.issue)
        .map((s) => ({
          section: s.section,
          severity: (["high", "medium", "low"].includes(s.severity) ? s.severity : "medium") as
            | "high"
            | "medium"
            | "low",
          issue: s.issue,
          recommendation: s.recommendation ?? "",
        }));
      const seen = new Set(weakSections.map((s) => `${s.section}|${s.issue}`));
      weakSections = [...weakSections, ...extra.filter((s) => !seen.has(`${s.section}|${s.issue}`))];

      for (const qual of llm.missingQualifications ?? []) {
        if (!missing.some((m) => m.keyword.toLowerCase() === qual.toLowerCase())) {
          missing.push({
            keyword: qual,
            jdFrequency: 1,
            importance: "critical",
            category: "qualification",
            gapType: "specialized",
            presentInResume: false,
          });
        }
      }
    }
  }

  const matchScore = Math.round(keywordCoverage * 0.6 + atsScore * 0.4);

  return {
    matchScore,
    keywordCoverage,
    missingKeywords: missing,
    matchedKeywords: matched,
    weakSections,
    formattingIssues,
    atsChecks,
    summary,
    usedLlm,
  };
}
