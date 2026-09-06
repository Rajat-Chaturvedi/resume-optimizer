# Resume-to-JD Optimizer

Full-stack Next.js app that compares a resume against a job description, reports the
gaps, rewrites the resume in a FAANG-style/ATS-compliant format, and exports ATS-safe
PDF and DOCX files.

## Run

```bash
npm install            # if the corporate registry 401s: npm install --registry=https://registry.npmjs.org
npm run dev            # http://localhost:3000
```

Optional LLM rewriting (the app is fully functional without it, using the deterministic
rules engine):

```bash
cp .env.example .env.local   # then set OPENAI_API_KEY
```

| Variable | Default | Purpose |
| --- | --- | --- |
| `OPENAI_API_KEY` | – | Enables LLM gap analysis and rewriting. Unset ⇒ rules engine only. |
| `LLM_MODEL` | `gpt-4o-mini` | Chat model used for analysis and rewriting. |
| `LLM_BASE_URL` | `https://api.openai.com/v1` | Any OpenAI-compatible endpoint (Azure OpenAI, vLLM, Ollama). |

## Pipeline

1. **Input** — `POST /api/analyze` accepts a PDF/DOCX/TXT resume (≤ 8 MB) plus JD text or a JD file.
2. **Parsing** — `src/lib/extract.ts` pulls text plus layout signals (columns, tables, images, fonts,
   page count) with `pdfjs-dist` / `mammoth`; `src/lib/resumeParser.ts` maps the text into a
   structured resume model.
3. **Gap analysis** — `src/lib/gapAnalysis.ts` scores weighted keyword coverage against the JD,
   runs the ATS rule set, and (when a key is configured) layers on LLM findings.
4. **Optimization** — `POST /api/optimize` rewrites bullets to `action verb + work + impact`,
   surfaces truthful JD keywords into Skills, and re-scores the result.
5. **Templates & preview** — four single-column templates render live in the browser; bullets and
   summary are editable inline before export.
6. **Export** — `POST /api/export` produces DOCX (`docx`) or PDF (`pdf-lib`, Standard-14 fonts, no
   tables/graphics), so the exported file re-parses cleanly.

## ATS compliance rules

`src/lib/ats.ts` implements the checks published by mainstream ATS vendors and resume-scanning
benchmarks (Workday, Taleo/Oracle, Greenhouse, Lever, iCIMS, Jobscan, Harvard OCS):

- text-layer file (no scanned images), single-column reading order, no tables, no graphics
- standard font families, ASCII-safe character set, 1–2 pages
- conventional `Experience` / `Education` / `Skills` headings, contact details in the body
- consistent `MMM YYYY – MMM YYYY` date ranges on every role

Content checks (`analyseSections`) enforce the FAANG bullet convention: action-verb openers,
quantified impact, ≤ 30 words per bullet, and a keyword-carrying summary.

The rewrite prompt forbids inventing employers, dates, degrees, or technologies; the deterministic
path only promotes keywords that already appear somewhere in the source resume.

## Gap classification

Every unmatched job-description keyword is classified in [semantics.ts](src/lib/semantics.ts):

- **Specialized** — a named technology, platform or credential (Golang, Kafka, Kubernetes, Angular, AWS
  certification). These are never added automatically. The UI surfaces them under *"Have experience with
  any of these skills?"* with checkboxes; once the user confirms, they are added to Skills and passed to
  the rewrite engine as claimable.
- **Semantic** — generic engineering vocabulary (leadership, mentoring, quality, security, maintainability,
  scalability, architecture, collaboration, best practices). Each has an evidence pattern; when the resume
  already demonstrates the capability under different wording, the optimizer adopts the job description's
  terminology (Core Competencies line plus in-bullet synonym alignment such as *guided → mentored*).

Core rule: **do not fabricate specialized experience; do optimize language, terminology and positioning
wherever the existing resume supports it.**

## Verification

`samples/` contains a resume and JD for smoke testing. Exports were round-tripped back through
`/api/analyze`: both PDF and DOCX output pass all ten ATS structural checks and re-parse into the
same structured resume.

## Layout

```
src/app/api/analyze    parse + gap report
src/app/api/optimize   rewrite + re-score
src/app/api/export     PDF / DOCX generation
src/lib/extract.ts     PDF & DOCX text + layout signal extraction
src/lib/resumeParser.ts  text -> structured resume
src/lib/keywords.ts    keyword extraction, aliases, bullet heuristics
src/lib/ats.ts         ATS + FAANG rule set
src/lib/gapAnalysis.ts scoring engine
src/lib/optimizer.ts   rewrite engine (LLM + deterministic fallback)
src/lib/templates.ts   template specifications shared by preview and export
```
