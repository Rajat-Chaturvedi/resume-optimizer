import { LLM } from "@/constants/config";
import { ACTION_VERBS, findInText, hasMetric, normalise } from "./keywords";
import { llmEnabled, llmJson } from "./llm";
import { resumeToPlainText, stripBulletGlyph } from "./resumeParser";
import { TERMINOLOGY_SWAPS, findSemanticClosures, isSpecialized, resumeEvidenceText } from "./semantics";
import type { GapReport, LengthMode, OptimizeResult, StructuredResume } from "./types";

const WEAK_OPENER_RULES: { pattern: RegExp; verb: string }[] = [
  { pattern: /^responsible for (managing|leading|owning)\s+/i, verb: "Led" },
  { pattern: /^responsible for\s+/i, verb: "Owned" },
  { pattern: /^worked on\s+/i, verb: "Delivered" },
  { pattern: /^helped (to\s+)?/i, verb: "Drove" },
  { pattern: /^assisted (with|in)\s+/i, verb: "Supported" },
  { pattern: /^involved in\s+/i, verb: "Contributed to" },
  { pattern: /^participated in\s+/i, verb: "Contributed to" },
  { pattern: /^tasked with\s+/i, verb: "Owned" },
  { pattern: /^duties included\s+/i, verb: "Executed" },
  { pattern: /^in charge of\s+/i, verb: "Directed" },
  { pattern: /^part of a team that\s+/i, verb: "Partnered with engineers to" },
];

const IRREGULAR_PAST: Record<string, string> = {
  build: "Built",
  rebuild: "Rebuilt",
  lead: "Led",
  run: "Ran",
  write: "Wrote",
  rewrite: "Rewrote",
  drive: "Drove",
  make: "Made",
  grow: "Grew",
  take: "Took",
  give: "Gave",
  do: "Did",
  set: "Set",
  cut: "Cut",
  bring: "Brought",
  teach: "Taught",
  meet: "Met",
  keep: "Kept",
  hold: "Held",
  win: "Won",
  begin: "Began",
  choose: "Chose",
  ship: "Shipped",
  cast: "Cast",
};

const NON_VERB_STARTERS = new Set(
  "the a an this that these those on in for with by to of and or as our their its my his her all any each every over under across from at into".split(
    " "
  )
);

// Gerunds that are really nouns and must not become "Engineered", "Marketed", etc.
const NOUN_GERUNDS = new Set(
  "engineering marketing training testing monitoring accounting consulting manufacturing planning banking onboarding reporting staffing networking programming advertising".split(
    " "
  )
);

function capitalise(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function toPastTense(word: string): string {
  const lower = word.toLowerCase();
  if (IRREGULAR_PAST[lower]) return IRREGULAR_PAST[lower];
  if (/e$/.test(lower)) return capitalise(`${lower}d`);
  if (/[^aeiou]y$/.test(lower)) return capitalise(`${lower.slice(0, -1)}ied`);
  if (/^[a-z]+[aeiou][bdgklmnprt]$/.test(lower) && lower.length <= 5) {
    return capitalise(`${lower}${lower.slice(-1)}ed`);
  }
  return capitalise(`${lower}ed`);
}

function gerundToPast(word: string): string {
  const stem = word.toLowerCase().replace(/ing$/, "");
  if (IRREGULAR_PAST[stem]) return IRREGULAR_PAST[stem];
  // "migrat" -> "migrate" -> "migrated"; doubled consonants ("shipp") collapse first.
  if (/([bdgklmnprt])\1$/.test(stem)) return capitalise(`${stem}ed`);
  if (/[^aeiou][^aeiouwxy]$/.test(stem) || /[aeiou][^aeiou]$/.test(stem)) return toPastTense(`${stem}e`);
  return toPastTense(stem);
}

/** Picks a lead verb that the rest of the bullet does not already use. */
function leadVerb(preferred: string, rest: string): string {
  const used = (verb: string) => new RegExp(`\\b${verb.replace(/ed$|e$/, "")}`, "i").test(rest);
  if (!used(preferred)) return preferred;
  return ACTION_VERBS.find((v) => !used(v)) ?? preferred;
}

function applyWeakOpenerRule(text: string): string {
  const rule = WEAK_OPENER_RULES.find((r) => r.pattern.test(text));
  if (!rule) return text;

  const rest = text.replace(rule.pattern, "").trim().replace(/^to\s+/i, "");
  const [first, ...tail] = rest.split(/\s+/);
  if (/ing$/i.test(first) && first.length > 4) return [gerundToPast(first), ...tail].join(" ");
  if (first && /^[a-z]+$/.test(first) && !NON_VERB_STARTERS.has(first)) {
    return [toPastTense(first), ...tail].join(" ");
  }
  return `${leadVerb(rule.verb, rest)} ${rest}`;
}

function strengthenBullet(bullet: string, index: number): string {
  let out = stripBulletGlyph(bullet).replace(/^(i|we|my team)\s+/i, "");

  // "Building reusable packages" -> "Built reusable packages": recruiters and ATS
  // keyword parsers both expect completed, past-tense accomplishments.
  const [lead, ...rest] = out.split(/\s+/);
  if (/^[A-Za-z]+ing$/.test(lead) && lead.length > 5 && !NOUN_GERUNDS.has(lead.toLowerCase())) {
    out = [gerundToPast(lead), ...rest].join(" ");
  }

  // Run after the gerund pass: "Working on X" becomes "Worked on X", which is
  // itself a weak opener that still needs replacing.
  out = applyWeakOpenerRule(out);

  const first = out.split(/\s+/)[0] ?? "";
  if (!/^[A-Za-z]+(ed|s)?$/.test(first)) out = `${ACTION_VERBS[index % ACTION_VERBS.length]} ${out}`;
  return capitalise(out).replace(/\s+/g, " ").replace(/[.;]+$/, "");
}

const FILLER_PATTERNS: [RegExp, string][] = [
  [/\bsuccessfully\s+/gi, ""],
  [/\bvarious\s+/gi, ""],
  [/\bseveral\s+/gi, ""],
  [/\bbasically\s+/gi, ""],
  [/\bactually\s+/gi, ""],
  [/\bvery\s+/gi, ""],
  [/\bin order to\b/gi, "to"],
  [/\bas well as\b/gi, "and"],
  [/\bwas responsible for\b/gi, "owned"],
  [/\butilized\b/gi, "used"],
  [/\butilised\b/gi, "used"],
];

function stripFiller(bullet: string): string {
  return FILLER_PATTERNS.reduce((acc, [pattern, replacement]) => acc.replace(pattern, replacement), bullet)
    .replace(/\s{2,}/g, " ")
    .trim();
}

const TITLE_NOUNS = "Engineer|Developer|Manager|Designer|Analyst|Architect|Scientist|Lead|Director|Consultant|Specialist";

const ACRONYMS = new Set(["ui", "ux", "seo", "ssr", "ssg", "pwa", "spa", "api", "css", "html", "sql", "aws", "gcp", "ci", "cd"]);

function displayTerm(term: string): string {
  return term
    .split(" ")
    .map((word) => (ACRONYMS.has(word.toLowerCase()) ? word.toUpperCase() : capitalise(word)))
    .join(" ");
}

/**
 * Rebuilds the summary around the JD's priorities. Every clause is sourced from the
 * candidate's own skills, bullets and dates — nothing new is claimed.
 */
function rewriteSummaryForJd(
  resume: StructuredResume,
  report: GapReport,
  competencies: string[],
  title: string | undefined
): { summary: string; used: string[] } | null {
  const role = title ?? resume.contact.title ?? "Engineer";
  const matched = report.matchedKeywords;

  const years = (() => {
    const stated = resume.summary?.match(/(\d{1,2})\s*\+?\s*years?/i);
    if (stated) return Number(stated[1]);
    const starts = resume.experience
      .map((e) => Number(e.startDate?.match(/(19|20)\d{2}/)?.[0]))
      .filter((y) => Number.isFinite(y) && y > 1950);
    return starts.length ? new Date().getFullYear() - Math.min(...starts) : undefined;
  })();

  // Keep the resume's own spelling ("React.js", "HTML5") for skills the JD also asks for.
  const resumeSkills = resume.skills.flatMap((g) => g.skills);
  const stack: string[] = [];
  for (const skill of resumeSkills) {
    if (stack.length >= 5) break;
    const wanted = matched.some((k) => k.category === "tool" && findInText(k.keyword, normalise(skill)));
    const duplicate = stack.some((s) => normalise(s).startsWith(normalise(skill).slice(0, 4)));
    if (wanted && !duplicate) stack.push(skill);
  }

  const capabilities = [
    ...matched
      .filter((k) => k.category === "hard-skill" && k.importance !== "nice-to-have")
      .sort((a, b) => b.jdFrequency - a.jdFrequency)
      .map((k) => k.keyword),
    ...competencies.map((c) => c.toLowerCase()),
  ]
    .filter((c, i, all) => all.findIndex((other) => findInText(c, other)) === i)
    .slice(0, 4);

  const evidence = resumeEvidenceText(resume);
  const achievement = resume.experience
    .flatMap((e) => e.bullets)
    .filter((b) => hasMetric(b) && b.split(/\s+/).length <= 34)
    .find((b) => matched.some((k) => k.importance === "critical" && findInText(k.keyword, normalise(b))));

  const leads = /\b(led|leading|mentor|coach|managed a team|team of)/i.test(evidence);
  const jdWantsLeadership = report.missingKeywords
    .concat(matched)
    .some((k) => /leadership|mentoring|mentorship/i.test(k.keyword));

  const sentences: string[] = [];
  sentences.push(
    `${role}${years ? ` with ${years}+ years` : ""} building scalable, high-performance web applications${
      stack.length ? ` with ${listOf(stack)}` : ""
    }.`
  );

  // Anything the achievement sentence already says must not be repeated as a capability.
  const covered = achievement ? normalise(achievement) : "";
  const remaining = capabilities.filter((c) => !findInText(c, covered));
  if (remaining.length >= 2) sentences.push(`Hands-on across ${listOf(remaining.map(displayTerm))}.`);
  if (achievement) sentences.push(`${achievement.replace(/[.;]+$/, "")}.`);
  if (leads && jdWantsLeadership && !/\b(mentor|led a team|leadership|coach)/i.test(covered)) {
    sentences.push("Mentored engineers through code reviews and coding standards in Agile, cross-functional teams.");
  }

  if (sentences.length < 3) return null;
  return { summary: sentences.join(" "), used: [...stack, ...capabilities] };
}

function listOf(items: string[]): string {
  if (items.length <= 1) return items[0] ?? "";
  return `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;
}

const CHARS_PER_PAGE = 3500;
const TARGET_PAGES = 2;
const MIN_BULLETS_PER_ROLE = 2;

/**
 * Drops the least relevant bullets until the resume fits two pages. Nothing is
 * reworded or invented — bullets carrying metrics or JD keywords are kept first,
 * and recent roles keep more than older ones.
 */
function condenseToTargetLength(resume: StructuredResume, report: GapReport): number {
  const jdTerms = report.matchedKeywords.map((k) => k.keyword);
  const score = (bullet: string, roleIndex: number) => {
    const text = normalise(bullet);
    const keywordHits = jdTerms.filter((term) => findInText(term, text)).length;
    return (hasMetric(bullet) ? 6 : 0) + Math.min(keywordHits, 4) * 1.5 + Math.max(0, 6 - roleIndex);
  };

  const ranked = resume.experience
    .flatMap((exp, roleIndex) =>
      exp.bullets.map((bullet, bulletIndex) => ({ roleIndex, bulletIndex, value: score(bullet, roleIndex) }))
    )
    .sort((a, b) => a.value - b.value);

  const remaining = new Map<number, Set<number>>();
  resume.experience.forEach((exp, i) => remaining.set(i, new Set(exp.bullets.map((_, j) => j))));

  const budget = CHARS_PER_PAGE * TARGET_PAGES;
  let length = resumeToPlainText(resume).length;
  const dropped: { roleIndex: number; bulletIndex: number }[] = [];

  for (const candidate of ranked) {
    if (length <= budget) break;
    const kept = remaining.get(candidate.roleIndex);
    if (!kept || kept.size <= MIN_BULLETS_PER_ROLE) continue;
    kept.delete(candidate.bulletIndex);
    dropped.push(candidate);
    length -= resume.experience[candidate.roleIndex].bullets[candidate.bulletIndex].length + 3;
  }

  if (!dropped.length) return 0;
  resume.experience = resume.experience.map((exp, i) => ({
    ...exp,
    bullets: exp.bullets.filter((_, j) => remaining.get(i)?.has(j)),
  }));
  return dropped.length;
}

function cleanTitle(text: string): string {
  return text
    // Job posts prefix the title with a label: "Role: Software Engineer".
    .replace(/^\s*(role|position|job title|title|designation|opening|vacancy)\s*[:\-–—]\s*/i, "")
    .replace(/[:.]\s*$/, "")
    .split(/\s*,\s*/)[0]
    .trim();
}

/** Job posts rarely put the title on line one; look for a title-shaped line or an "as a <title>" phrase. */
function detectJobTitle(jdText: string): string | undefined {
  const phrase = jdText.match(
    new RegExp(`\\bas an?\\s+((?:[A-Z][\\w+.#/-]*\\s+){0,3}(?:${TITLE_NOUNS}))\\b`)
  );
  if (phrase) return cleanTitle(phrase[1]);

  const titleLine = jdText
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
    .slice(0, 15)
    .find(
      (l) =>
        l.length <= 60 &&
        l.split(/\s+/).length <= 8 &&
        !/\d/.test(l) &&
        !/^(about|our|we|mission|role overview|what|key|qualification)/i.test(l) &&
        !/\b(experience|responsib|require|team|looking|hiring)\b/i.test(l) &&
        new RegExp(`(${TITLE_NOUNS})\\b`, "i").test(l)
    );

  return titleLine ? cleanTitle(titleLine) : undefined;
}

/** Deterministic optimisation used when no LLM key is configured. */
function optimiseHeuristically(
  resume: StructuredResume,
  report: GapReport,
  jdTitle: string | undefined,
  confirmedSkills: string[],
  lengthMode: LengthMode
): OptimizeResult {
  const clone: StructuredResume = JSON.parse(JSON.stringify(resume));
  const changeLog: string[] = [];
  const rewrittenRoles = new Set<string>();
  let rewritten = 0;
  let fillerRemoved = 0;
  let realigned = 0;

  // Adopt the JD's vocabulary only where the resume already says the same thing.
  const jdVocabulary = [...report.missingKeywords, ...report.matchedKeywords].map((k) => k.keyword).join(" ");
  const activeSwaps = TERMINOLOGY_SWAPS.filter((s) => s.requires.test(jdVocabulary));

  clone.experience = clone.experience.map((exp) => ({
    ...exp,
    bullets: exp.bullets.map((b, i) => {
      const original = stripBulletGlyph(b);
      let text = stripFiller(original);
      if (text !== original) fillerRemoved += 1;

      const beforeSwap = text;
      for (const swap of activeSwaps) text = text.replace(swap.pattern, swap.replacement);
      if (text !== beforeSwap) realigned += 1;

      const improved = strengthenBullet(text, i);
      const openerChanged = improved.split(/\s+/)[0]?.toLowerCase() !== original.split(/\s+/)[0]?.toLowerCase();
      if (openerChanged) {
        rewritten += 1;
        rewrittenRoles.add(exp.role || exp.company);
      }
      return improved;
    }),
  }));

  clone.projects = clone.projects.map((project) => ({
    ...project,
    bullets: project.bullets.map((b, i) => strengthenBullet(stripFiller(stripBulletGlyph(b)), i)),
  }));

  if (rewritten) {
    changeLog.push(
      `Rewrote ${rewritten} bullet(s) across ${rewrittenRoles.size} role(s) to open with past-tense action verbs (${[...rewrittenRoles].slice(0, 3).join(", ")}${rewrittenRoles.size > 3 ? ", …" : ""}).`
    );
  }
  if (fillerRemoved) {
    changeLog.push(`Removed filler wording ("successfully", "various", "in order to") from ${fillerRemoved} bullet(s).`);
  }
  if (realigned) {
    changeLog.push(`Realigned ${realigned} bullet(s) to the JD's vocabulary (e.g. "guided" → "mentored", "worked with" → "collaborated with").`);
  }

  // Only surface keywords the candidate can legitimately claim: those already
  // evidenced somewhere in the resume but missing from a scannable Skills block.
  const resumeBlob = normalise(JSON.stringify(resume));
  const claimable = report.missingKeywords
    .filter((k) => k.category === "tool" || k.category === "hard-skill")
    .filter((k) => findInText(k.keyword, resumeBlob))
    .map((k) => k.keyword);

  const skillGroup = () => clone.skills.find((g) => /skill|tech|tool/i.test(g.category)) ?? clone.skills[0];

  if (claimable.length) {
    const additions = claimable.map(capitalise);
    const group = skillGroup();
    if (group) group.skills = [...new Set([...group.skills, ...additions])];
    else clone.skills.push({ category: "Technical Skills", skills: additions });
    changeLog.push(
      `Added the JD's exact spelling for ${claimable.length} skill(s) you already evidence (${claimable.slice(0, 5).join(", ")}) so literal ATS keyword matches succeed.`
    );
  }

  // Semantic gaps: capabilities the resume demonstrates but names differently.
  const closures = findSemanticClosures(report.missingKeywords, clone);
  const competencies = [...new Set(closures.map((c) => c.label))];
  if (competencies.length) {
    const existing = clone.skills.find((g) => /competenc/i.test(g.category));
    if (existing) existing.skills = [...new Set([...existing.skills, ...competencies])];
    else clone.skills.unshift({ category: "Core Competencies", skills: competencies });
    changeLog.push(
      `Closed ${closures.length} wording gap(s) with a Core Competencies line backed by your existing bullets (${competencies.slice(0, 4).join(", ")}).`
    );
  }

  if (confirmedSkills.length) {
    const additions = confirmedSkills.map((s) => s.trim()).filter(Boolean).map(capitalise);
    const group = skillGroup();
    if (group) group.skills = [...new Set([...group.skills, ...additions])];
    else clone.skills.push({ category: "Technical Skills", skills: additions });
    changeLog.push(`Added ${additions.length} skill(s) you confirmed having: ${additions.join(", ")}.`);
  }

  if (jdTitle) {
    const title = jdTitle;
    if (clone.contact.title !== title) {
      changeLog.push(`Aligned the headline title with the target role ("${clone.contact.title ?? "none"}" → "${title}").`);
      clone.contact.title = title;
    }
  }

  const newSummary = rewriteSummaryForJd(clone, report, competencies, jdTitle);
  if (newSummary) {
    changeLog.push(
      clone.summary
        ? `Rewrote the summary around this JD: target title first, then ${newSummary.used.slice(0, 4).join(", ")} and your strongest quantified result.`
        : "Added a JD-targeted professional summary built from your existing skills and results."
    );
    clone.summary = newSummary.summary;
  }

  const trimmedBullets = lengthMode === "condense" ? condenseToTargetLength(clone, report) : 0;
  if (trimmedBullets) {
    changeLog.push(
      `Condensed to two pages by dropping ${trimmedBullets} lower-impact bullet(s) — those without metrics or JD keywords, oldest roles first.`
    );
  }

  return {
    resume: clone,
    changeLog,
    injectedKeywords: [...claimable, ...confirmedSkills],
    closedSemanticGaps: closures,
    confirmedSkills,
    lengthMode,
    trimmedBullets,
    usedLlm: false,
  };
}

const OPTIMIZE_SYSTEM_PROMPT = `You rewrite resumes to match a target job description while staying strictly truthful.

Rules:
1. Never fabricate employers, dates, degrees, or specialized technologies the candidate has not used. You may re-word and re-emphasise existing content only.
2. Distinguish two kinds of job-description gap:
   - Specialized skills (named languages, frameworks, platforms, credentials): NEVER add unless they are listed as confirmed by the candidate.
   - Semantic/wording gaps (leadership, mentoring, quality, security, maintainability, scalability, architecture, collaboration, best practices): DO adopt the job description's terminology wherever an existing bullet already demonstrates that capability.
3. Every experience bullet: strong past-tense action verb + specific work + quantified impact. 18-30 words. No pronouns, no buzzword padding.
4. Preserve any existing numbers exactly. If a bullet has no metric, keep it qualitative rather than inventing one, but sharpen the scope.
5. Output ATS-safe plain content only: no tables, columns, emojis, graphics, or special characters.
6. Section order: summary, skills, experience, projects, education, certifications.

Respond ONLY with JSON matching:
{"resume":{"contact":{"name":string,"title":string,"email":string,"phone":string,"location":string,"links":string[]},"summary":string,"skills":[{"category":string,"skills":string[]}],"experience":[{"company":string,"role":string,"location":string,"startDate":string,"endDate":string,"bullets":string[]}],"projects":[{"name":string,"description":string,"bullets":string[]}],"education":[{"institution":string,"degree":string,"location":string,"graduation":string,"details":string[]}],"certifications":string[]},"changeLog":string[],"injectedKeywords":string[]}`;

function coerceResume(input: unknown, fallback: StructuredResume): StructuredResume {
  const data = (input ?? {}) as Partial<StructuredResume>;
  const arr = <T,>(v: unknown, fb: T[]): T[] => (Array.isArray(v) ? (v as T[]) : fb);
  return {
    contact: {
      name: data.contact?.name || fallback.contact.name,
      title: data.contact?.title ?? fallback.contact.title,
      email: data.contact?.email ?? fallback.contact.email,
      phone: data.contact?.phone ?? fallback.contact.phone,
      location: data.contact?.location ?? fallback.contact.location,
      links: arr(data.contact?.links, fallback.contact.links),
    },
    summary: data.summary ?? fallback.summary,
    skills: arr(data.skills, fallback.skills),
    experience: arr(data.experience, fallback.experience).map((e) => ({
      ...e,
      bullets: arr<string>(e.bullets, []).map(stripBulletGlyph).filter(Boolean),
    })),
    projects: arr(data.projects, fallback.projects).map((p) => ({
      ...p,
      bullets: arr<string>(p.bullets, []).map(stripBulletGlyph).filter(Boolean),
    })),
    education: arr(data.education, fallback.education).map((e) => ({ ...e, details: arr(e.details, []) })),
    certifications: arr<string>(data.certifications, fallback.certifications).map(stripBulletGlyph),
  };
}

export async function optimiseResume(
  resume: StructuredResume,
  report: GapReport,
  jdText: string,
  confirmedSkills: string[] = [],
  lengthMode: LengthMode = "as-is"
): Promise<OptimizeResult> {
  const jdTitle = detectJobTitle(jdText);
  const heuristic = optimiseHeuristically(resume, report, jdTitle, confirmedSkills, lengthMode);
  if (!llmEnabled()) return heuristic;

  const semanticGaps = report.missingKeywords.filter((k) => !isSpecialized(k)).map((k) => k.keyword);
  const specializedGaps = report.missingKeywords
    .filter((k) => isSpecialized(k) && !confirmedSkills.includes(k.keyword))
    .map((k) => k.keyword);

  const llm = await llmJson<{ resume: unknown; changeLog?: string[]; injectedKeywords?: string[] }>(
    [
      { role: "system", content: OPTIMIZE_SYSTEM_PROMPT },
      {
        role: "user",
        content: `JOB DESCRIPTION:\n${jdText.slice(0, 6000)}\n\nCURRENT RESUME (structured JSON):\n${JSON.stringify(
          resume
        ).slice(0, 12000)}\n\nSEMANTIC GAPS — adopt this JD wording wherever the existing bullets already demonstrate the capability: ${semanticGaps
          .slice(0, 30)
          .join(", ")}\n\nSPECIALIZED SKILLS THE CANDIDATE HAS NOT CLAIMED — never add these: ${specializedGaps
          .slice(0, 30)
          .join(", ")}\n\nSKILLS THE CANDIDATE CONFIRMED HAVING — weave these in naturally: ${
          confirmedSkills.join(", ") || "none"
        }\n\nWEAK SECTIONS: ${report.weakSections.map((s) => `${s.section}: ${s.issue}`).join(" | ")}`,
      },
    ],
    LLM.rewriteMaxTokens
  );

  if (!llm?.resume) return heuristic;

  const optimised = coerceResume(llm.resume, resume);
  const trimmedBullets = lengthMode === "condense" ? condenseToTargetLength(optimised, report) : 0;
  return {
    resume: optimised,
    changeLog: llm.changeLog?.length ? llm.changeLog : heuristic.changeLog,
    injectedKeywords: llm.injectedKeywords ?? heuristic.injectedKeywords,
    closedSemanticGaps: findSemanticClosures(report.missingKeywords, optimised),
    confirmedSkills,
    lengthMode,
    trimmedBullets,
    usedLlm: true,
  };
}
