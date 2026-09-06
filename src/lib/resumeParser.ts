import type {
  EducationEntry,
  ExperienceEntry,
  ProjectEntry,
  SkillGroup,
  StructuredResume,
} from "./types";

// Section headings recognised by mainstream ATS parsers (Workday, Taleo, Greenhouse, Lever).
export const CANONICAL_SECTIONS: Record<string, string[]> = {
  summary: ["summary", "professional summary", "profile", "about", "objective", "overview"],
  skills: ["skills", "technical skills", "core competencies", "technologies", "expertise", "competencies"],
  experience: [
    "experience",
    "work experience",
    "professional experience",
    "employment history",
    "employment",
    "career history",
    "work history",
  ],
  projects: ["projects", "selected projects", "personal projects", "key projects"],
  education: ["education", "academic background", "academics", "education and training"],
  certifications: ["certifications", "certificates", "licenses", "awards", "publications", "achievements"],
};

const DATE_RANGE =
  /((jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s*\d{4}|\d{1,2}\/\d{4}|\d{4})\s*(–|-|—|to)\s*((jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s*\d{4}|\d{1,2}\/\d{4}|\d{4}|present|current|now)/i;

const BULLET_PREFIX = /^\s*([•●○◦▪▫‣·∙⁃\-–—*+>»➤➢✓✔■□]|\d+[.)])\s+/;

const ROLE_WORDS =
  /(engineer|developer|programmer|architect|manager|designer|analyst|consultant|specialist|scientist|administrator|lead|director|head|officer|intern|associate|president|founder|owner|strategist|marketer|writer|researcher|technician|sre|devops|qa)/i;

// PDF extraction emits one line per rendered line, so wrapped bullets arrive split.
function isContinuation(line: string, previous: string | undefined): boolean {
  if (!previous) return false;
  if (BULLET_PREFIX.test(line)) return false;
  if (DATE_RANGE.test(line)) return false;
  const endsOpen = !/[.;:!?]$/.test(previous.trim());
  const startsLower = /^[a-z(,"']/.test(line.trim());
  return endsOpen || startsLower;
}

/** PDF text layers leave stray spaces before punctuation and doubled spaces. */
function tidy(text: string): string {
  return text
    .replace(/\s+([.,;:!?])/g, "$1")
    .replace(/\s{2,}/g, " ")
    .trim();
}

/** Removes list glyphs so templates can supply their own bullet markers. */
export function stripBulletGlyph(text: string): string {
  return tidy(text.replace(BULLET_PREFIX, ""));
}

function detectSection(line: string): string | undefined {
  const cleaned = line
    .replace(/[^A-Za-z&\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
  if (!cleaned || cleaned.length > 42) return undefined;
  for (const [key, aliases] of Object.entries(CANONICAL_SECTIONS)) {
    if (aliases.includes(cleaned)) return key;
  }
  return undefined;
}

function parseContact(lines: string[]): StructuredResume["contact"] {
  const head = lines.slice(0, 8);
  const joined = head.join(" \n ");
  const email = joined.match(/[\w.+-]+@[\w-]+\.[\w.]{2,}/)?.[0];
  const phone = joined.match(/(\+?\d{1,3}[\s.-]?)?\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}/)?.[0];
  const links = [...joined.matchAll(/((https?:\/\/)?(www\.)?(linkedin\.com|github\.com|[\w-]+\.[a-z]{2,})\/[\w./#?=-]+)/gi)]
    .map((m) => m[0].replace(/[.,;]$/, ""))
    .filter((l) => !l.includes("@"));

  const name =
    head.find(
      (l) =>
        l.trim().length > 2 &&
        l.trim().length < 46 &&
        !l.includes("@") &&
        !/\d{3}/.test(l) &&
        /^[A-Za-z][A-Za-z.'\- ]+$/.test(l.trim())
    ) ?? head[0] ?? "Your Name";

  const nameIndex = head.indexOf(name);
  const title = head
    .slice(nameIndex + 1, nameIndex + 3)
    .find((l) => l.length < 70 && !l.includes("@") && !/\d{3}/.test(l) && l.trim() !== name.trim());

  const location = joined.match(/([A-Z][a-zA-Z.\s]+,\s*(?:[A-Z]{2}|[A-Z][a-z]+))(?:\s|,|$)/)?.[1];

  return {
    name: name.trim(),
    title: title?.trim(),
    email,
    phone: phone?.trim(),
    location: location?.trim(),
    links: [...new Set(links)].slice(0, 4),
  };
}

function splitHeaderLine(line: string): { left: string; right?: string } {
  const parts = line.split(/\s{2,}|\s+\|\s+|\s+[–—]\s+|\t/).filter(Boolean);
  if (parts.length >= 2) {
    return { left: parts.slice(0, -1).join(" – ").trim(), right: parts[parts.length - 1].trim() };
  }
  return { left: line.trim() };
}

const LOCATION_LIKE = /\((remote|onsite|hybrid|in-office)\)|^[A-Z][\w.'\s]+,\s*[A-Z][\w.]*$/i;

/** Headers appear as "Company — Role", "Role, Company — Location" or any mix of the two. */
function parseRoleCompany(line: string): { role: string; company: string; location?: string } {
  const segments = line
    .split(/\s{2,}|\s*[|–—•·]\s+|\s+at\s+|\t/)
    .map((s) => tidy(s))
    .filter(Boolean);

  let location: string | undefined;
  const locationIndex = segments.findIndex((s) => LOCATION_LIKE.test(s) && !ROLE_WORDS.test(s));
  if (locationIndex >= 0) location = segments.splice(locationIndex, 1)[0];

  const roleIndex = segments.findIndex((s) => ROLE_WORDS.test(s));
  const roleSegment = segments[roleIndex >= 0 ? roleIndex : 0] ?? line;
  let company = segments.filter((_, i) => i !== (roleIndex >= 0 ? roleIndex : 0)).join(", ");
  let role = roleSegment;

  if (!company && roleSegment.includes(",")) {
    const commaParts = roleSegment.split(/,\s*/);
    const titleIndex = commaParts.findIndex((p) => ROLE_WORDS.test(p));
    if (titleIndex >= 0 && commaParts.length > 1) {
      role = commaParts[titleIndex];
      company = commaParts.filter((_, i) => i !== titleIndex).join(", ");
    }
  }

  return { role: tidy(role), company: tidy(company), location };
}

function parseExperience(block: string[]): ExperienceEntry[] {
  const entries: ExperienceEntry[] = [];
  let current: ExperienceEntry | undefined;

  for (const raw of block) {
    const line = raw.trim();
    if (!line) continue;

    if (BULLET_PREFIX.test(line)) {
      const bullet = tidy(line.replace(BULLET_PREFIX, ""));
      if (current) current.bullets.push(bullet);
      continue;
    }

    // Wrapped remainder of the previous bullet.
    if (current?.bullets.length && isContinuation(line, current.bullets[current.bullets.length - 1])) {
      current.bullets[current.bullets.length - 1] = tidy(
        `${current.bullets[current.bullets.length - 1]} ${line}`
      );
      continue;
    }

    const dates = line.match(DATE_RANGE);

    // A standalone "May 2024 – Present | Bengaluru" line belongs to the open entry.
    if (
      dates &&
      current &&
      !current.startDate &&
      line.replace(dates[0], "").replace(/[|,·–—-]/g, "").trim().length < 40
    ) {
      current.startDate = dates[1]?.trim();
      current.endDate = dates[4]?.trim();
      const rest = line.replace(dates[0], "").replace(/^[|,·–—-]\s*/, "").trim();
      if (rest && !current.location) current.location = rest.replace(/^[|,]\s*/, "");
      continue;
    }

    const isHeader =
      Boolean(dates) || (line.length < 110 && /( at | – | — | \| |,)/.test(line) && !line.endsWith("."));

    // "Role  Dates" followed by "Company, Location" on the next line.
    if (!dates && current && current.bullets.length === 0 && !current.company && (current.startDate || current.endDate)) {
      const [company, ...rest] = line.split(/\s*[,|–—]\s+/);
      current.company = tidy(company);
      current.location = rest.join(", ").trim() || current.location;
      continue;
    }

    if (isHeader) {
      if (current) entries.push(current);
      const withoutDates = dates ? line.replace(dates[0], "").replace(/[|,–—-]\s*$/, "").trim() : line;
      const { role, company, location } = parseRoleCompany(withoutDates);
      current = {
        role,
        company,
        location,
        startDate: dates?.[1]?.trim(),
        endDate: dates?.[4]?.trim(),
        bullets: [],
      };
      continue;
    }

    if (current) {
      if (current.bullets.length === 0 && line.length < 80 && !current.company) current.company = tidy(line);
      else current.bullets.push(tidy(line));
    }
  }
  if (current) entries.push(current);
  return entries.filter((e) => e.role || e.company);
}

const DEGREE_LIKE =
  /(b\.?\s?s\b|b\.?\s?a\b|b\.?tech|m\.?\s?s\b|m\.?\s?a\b|m\.?tech|mba|ph\.?d|bachelor|master|doctor|associate|diploma|degree)/i;

function parseEducation(block: string[]): EducationEntry[] {
  const entries: EducationEntry[] = [];
  let current: EducationEntry | undefined;

  const flush = () => {
    if (current && (current.institution || current.degree)) entries.push(current);
    current = undefined;
  };
  const open = () => (current ??= { institution: "", degree: "", details: [] });

  for (const raw of block) {
    let line = tidy(raw);
    if (!line) continue;

    if (BULLET_PREFIX.test(line)) {
      open().details.push(stripBulletGlyph(line));
      continue;
    }

    const years = line.match(/\b(19|20)\d{2}\b/g);
    line = tidy(
      line
        .replace(DATE_RANGE, "")
        .replace(/\b(19|20)\d{2}\b/g, "")
        .replace(/[-–—|,]\s*$/, "")
    );
    if (!line) continue;

    if (DEGREE_LIKE.test(line)) {
      if (current?.degree) flush();
      open().degree = line;
    } else {
      if (current?.institution) flush();
      const location = line.match(/\s([A-Z][A-Za-z.]*(?:\s[A-Z][A-Za-z.]*)*,\s*[A-Z][A-Za-z.]*)$/);
      if (location) {
        open().location = location[1];
        line = tidy(line.slice(0, line.length - location[1].length));
      }
      open().institution = line;
    }
    if (years?.length) open().graduation = years[years.length - 1];
  }

  flush();
  return entries;
}

function parseSkills(block: string[]): SkillGroup[] {
  const groups: SkillGroup[] = [];
  for (const raw of block) {
    const line = tidy(raw.replace(BULLET_PREFIX, ""));
    if (!line) continue;
    const [maybeCategory, ...rest] = line.split(":");
    if (rest.length > 0 && maybeCategory.length < 40) {
      groups.push({
        category: maybeCategory.trim(),
        skills: rest.join(":").split(/[,;|·•●]/).map((s) => s.trim()).filter(Boolean),
      });
    } else {
      const skills = line.split(/[,;|·•●]/).map((s) => s.trim()).filter(Boolean);
      const previous = groups[groups.length - 1];
      // Inside a skills section a colon-less line is the wrap of the previous group.
      if (previous) previous.skills.push(...skills);
      else groups.push({ category: "Skills", skills });
    }
  }
  return groups.filter((g) => g.skills.length > 0);
}

function parseProjects(block: string[]): ProjectEntry[] {
  const entries: ProjectEntry[] = [];
  let current: ProjectEntry | undefined;
  for (const raw of block) {
    const line = raw.trim();
    if (!line) continue;
    if (BULLET_PREFIX.test(line)) {
      current?.bullets.push(tidy(line.replace(BULLET_PREFIX, "")));
      continue;
    }
    if (current?.bullets.length && isContinuation(line, current.bullets[current.bullets.length - 1])) {
      current.bullets[current.bullets.length - 1] = tidy(
        `${current.bullets[current.bullets.length - 1]} ${line}`
      );
      continue;
    }
    if (current) entries.push(current);
    const [name, ...desc] = line.split(/\s+[–—|-]\s+/);
    current = { name: tidy(name), description: tidy(desc.join(" – ")) || undefined, bullets: [] };
  }
  if (current) entries.push(current);
  return entries;
}

export function parseResume(text: string): StructuredResume {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.replace(/\u00a0/g, " ").replace(/\s+$/, ""))
    .filter((l, i, arr) => l.trim() !== "" || arr[i - 1]?.trim() !== "");

  const blocks: Record<string, string[]> = {};
  let currentSection = "header";
  blocks[currentSection] = [];

  for (const line of lines) {
    const section = detectSection(line);
    if (section) {
      currentSection = section;
      blocks[currentSection] = blocks[currentSection] ?? [];
      continue;
    }
    (blocks[currentSection] ??= []).push(line);
  }

  const contact = parseContact(blocks.header ?? lines);
  const summaryBlock = tidy((blocks.summary ?? []).join(" ").replace(/\s+/g, " "));

  return {
    contact,
    summary: summaryBlock || undefined,
    skills: parseSkills(blocks.skills ?? []),
    experience: parseExperience(blocks.experience ?? []),
    projects: parseProjects(blocks.projects ?? []),
    education: parseEducation(blocks.education ?? []),
    certifications: (blocks.certifications ?? [])
      .map((l) => stripBulletGlyph(l))
      .filter(Boolean),
  };
}

export function detectedSections(text: string): string[] {
  const found = new Set<string>();
  for (const line of text.split(/\r?\n/)) {
    const section = detectSection(line);
    if (section) found.add(section);
  }
  return [...found];
}

export function resumeToPlainText(resume: StructuredResume): string {
  const out: string[] = [];
  const c = resume.contact;
  out.push(c.name);
  if (c.title) out.push(c.title);
  out.push([c.email, c.phone, c.location, ...c.links].filter(Boolean).join(" | "));
  if (resume.summary) out.push("", "SUMMARY", resume.summary);
  if (resume.skills.length) {
    out.push("", "SKILLS");
    for (const g of resume.skills) out.push(`${g.category}: ${g.skills.join(", ")}`);
  }
  if (resume.experience.length) {
    out.push("", "EXPERIENCE");
    for (const e of resume.experience) {
      out.push(`${e.role} — ${e.company}${e.location ? `, ${e.location}` : ""}`);
      if (e.startDate || e.endDate) out.push(`${e.startDate ?? ""} – ${e.endDate ?? "Present"}`);
      for (const b of e.bullets) out.push(`• ${b}`);
    }
  }
  if (resume.projects.length) {
    out.push("", "PROJECTS");
    for (const p of resume.projects) {
      out.push(p.description ? `${p.name} — ${p.description}` : p.name);
      for (const b of p.bullets) out.push(`• ${b}`);
    }
  }
  if (resume.education.length) {
    out.push("", "EDUCATION");
    for (const e of resume.education) {
      out.push(`${e.degree}${e.institution ? ` — ${e.institution}` : ""}${e.graduation ? `, ${e.graduation}` : ""}`);
      for (const d of e.details) out.push(`• ${d}`);
    }
  }
  if (resume.certifications.length) {
    out.push("", "CERTIFICATIONS");
    for (const c2 of resume.certifications) out.push(`• ${c2}`);
  }
  return out.join("\n");
}
