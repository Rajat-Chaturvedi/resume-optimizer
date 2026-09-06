import type { ExtractedDocument } from "./extract";
import { detectedSections } from "./resumeParser";
import { detectWeakOpeners, hasMetric, startsWithActionVerb } from "./keywords";
import type { AtsCheck, SectionFinding, StructuredResume } from "./types";

/**
 * Checks encode publicly documented parsing behaviour of mainstream ATS platforms
 * (Workday, Taleo/Oracle, Greenhouse, Lever, iCIMS) and the resume-scan criteria
 * published by Jobscan / Harvard OCS / FAANG recruiting guidance.
 */
export function runAtsChecks(
  raw: string,
  signals: ExtractedDocument["signals"],
  resume: StructuredResume
): AtsCheck[] {
  const checks: AtsCheck[] = [];
  const sections = detectedSections(raw);
  const wordCount = raw.split(/\s+/).filter(Boolean).length;

  checks.push({
    id: "file-format",
    label: "File format",
    standard: "PDF (text layer) or DOCX; never scanned images",
    status: signals.charCount > 400 ? "pass" : "fail",
    detail:
      signals.charCount > 400
        ? `${signals.source.toUpperCase()} with an extractable text layer (${signals.charCount} characters).`
        : "Almost no machine-readable text was found — the file is likely image-based and will score near zero in an ATS.",
  });

  checks.push({
    id: "single-column",
    label: "Single-column layout",
    standard: "ATS parsers read left-to-right; columns interleave content",
    status: signals.multiColumn ? "fail" : "pass",
    detail: signals.multiColumn
      ? "Multi-column layout detected. Sidebars are commonly merged into body text in the wrong reading order."
      : "Linear single-column reading order detected.",
  });

  checks.push({
    id: "no-tables",
    label: "No tables",
    standard: "Table cells are frequently dropped or flattened",
    status: signals.hasTables ? "fail" : "pass",
    detail: signals.hasTables
      ? "Table structures found. Move the content into plain paragraphs and bullet lists."
      : "No table structures detected.",
  });

  checks.push({
    id: "no-graphics",
    label: "No images, logos, or charts",
    standard: "Graphics carry no extractable text; headshots also raise bias-screening flags",
    status: signals.hasImages ? "warn" : "pass",
    detail: signals.hasImages
      ? "Images or vector graphics detected. Any information conveyed visually is invisible to the parser."
      : "No embedded graphics detected.",
  });

  checks.push({
    id: "fonts",
    label: "Standard fonts",
    standard: "Arial, Calibri, Helvetica, Garamond, Georgia, Times New Roman",
    status: signals.nonStandardFonts.length > 0 ? "warn" : "pass",
    detail: signals.nonStandardFonts.length
      ? `Non-standard font families detected (${signals.nonStandardFonts.slice(0, 4).join(", ")}). Decorative fonts can produce ligature/encoding errors on extraction.`
      : "Only ATS-safe font families detected.",
  });

  const required = ["experience", "education", "skills"];
  const missingSections = required.filter((s) => !sections.includes(s));
  checks.push({
    id: "standard-headings",
    label: "Standard section headings",
    standard: "Experience / Education / Skills spelled conventionally",
    status: missingSections.length === 0 ? "pass" : missingSections.length === 1 ? "warn" : "fail",
    detail: missingSections.length
      ? `Missing or non-standard headings: ${missingSections.join(", ")}. Creative headings such as "Where I've Made an Impact" are not mapped to ATS fields.`
      : "All core headings use conventional, parsable wording.",
  });

  checks.push({
    id: "contact-block",
    label: "Machine-readable contact details",
    standard: "Contact info in the body, not the header/footer region",
    status: resume.contact.email && resume.contact.phone ? "pass" : "warn",
    detail:
      resume.contact.email && resume.contact.phone
        ? "Name, email, and phone parsed successfully."
        : `Could not parse ${[!resume.contact.email && "email", !resume.contact.phone && "phone"].filter(Boolean).join(" and ")}. Many parsers ignore document headers and footers.`,
  });

  const dated = resume.experience.filter((e) => e.startDate || e.endDate).length;
  checks.push({
    id: "date-format",
    label: "Consistent date formats",
    standard: "MMM YYYY – MMM YYYY (or Present) on every role",
    status: resume.experience.length === 0 ? "warn" : dated === resume.experience.length ? "pass" : "warn",
    detail:
      resume.experience.length === 0
        ? "No work history entries were parsed."
        : `${dated}/${resume.experience.length} roles expose a parsable date range. Missing ranges are read as employment gaps.`,
  });

  checks.push({
    id: "length",
    label: "Length",
    standard: "1 page (<10 yrs experience) or 2 pages maximum",
    status: signals.pageCount <= 2 ? "pass" : "warn",
    detail: `${signals.pageCount} page(s), ~${wordCount} words.`,
  });

  const specials = raw.match(/[^\x00-\x7F]/g)?.filter((c) => !"–—•’‘“”…".includes(c)) ?? [];
  checks.push({
    id: "characters",
    label: "Safe character set",
    standard: "ASCII text with standard bullet glyphs",
    status: specials.length > 12 ? "warn" : "pass",
    detail: specials.length > 12
      ? `${specials.length} unusual glyphs detected (e.g. ${[...new Set(specials)].slice(0, 6).join(" ")}). Icon fonts and symbols often extract as garbage characters.`
      : "Character set is extraction-safe.",
  });

  return checks;
}

export function analyseSections(resume: StructuredResume): SectionFinding[] {
  const findings: SectionFinding[] = [];
  const bullets = resume.experience.flatMap((e) => e.bullets);

  if (!resume.summary || resume.summary.split(/\s+/).length < 15) {
    findings.push({
      section: "Summary",
      severity: "medium",
      issue: "No targeted professional summary, or it is too thin to carry role keywords.",
      recommendation: "Add a 2–3 line summary naming the target title, years of experience, and top JD keywords.",
    });
  }

  if (resume.skills.length === 0) {
    findings.push({
      section: "Skills",
      severity: "high",
      issue: "No parsable skills section was found.",
      recommendation: "Add a categorised Skills section (Languages, Frameworks, Cloud, Tools) with comma-separated terms.",
    });
  }

  if (bullets.length === 0) {
    findings.push({
      section: "Experience",
      severity: "high",
      issue: "No achievement bullets were parsed from the experience section.",
      recommendation: "Use one bullet per achievement, each starting with '•' on its own line.",
    });
  } else {
    const noMetric = bullets.filter((b) => !hasMetric(b));
    if (noMetric.length / bullets.length > 0.4) {
      findings.push({
        section: "Experience",
        severity: "high",
        issue: `${noMetric.length} of ${bullets.length} bullets contain no quantified outcome.`,
        recommendation:
          "Add the numbers only you know (%, $, latency, users, scale) — click any bullet in the preview to edit it.",
        requiresUserInput: true,
      });
    }

    const weak = bullets.filter((b) => detectWeakOpeners(b));
    if (weak.length) {
      findings.push({
        section: "Experience",
        severity: "medium",
        issue: `${weak.length} bullet(s) open with passive phrasing such as "responsible for" or "worked on".`,
        recommendation: "Replace with strong past-tense action verbs (Led, Built, Reduced, Migrated, Scaled).",
      });
    }

    const noVerb = bullets.filter((b) => !startsWithActionVerb(b));
    if (noVerb.length / bullets.length > 0.3) {
      findings.push({
        section: "Experience",
        severity: "medium",
        issue: `${noVerb.length} bullet(s) do not start with an action verb.`,
        recommendation: "Start every bullet with a verb; drop pronouns and articles.",
      });
    }

    const long = bullets.filter((b) => b.split(/\s+/).length > 32);
    if (long.length) {
      findings.push({
        section: "Experience",
        severity: "low",
        issue: `${long.length} bullet(s) exceed 32 words.`,
        recommendation: "Keep bullets to 1–2 lines (roughly 20–30 words) for recruiter scan-ability.",
      });
    }
  }

  if (resume.education.length === 0) {
    findings.push({
      section: "Education",
      severity: "medium",
      issue: "No education entries were parsed.",
      recommendation: "Include degree, institution, and graduation year — several ATS platforms filter on this field.",
    });
  }

  return findings;
}

export function scoreFromChecks(checks: AtsCheck[]): number {
  const weights = { pass: 1, warn: 0.6, fail: 0 };
  const total = checks.reduce((sum, c) => sum + weights[c.status], 0);
  return Math.round((total / checks.length) * 100);
}
