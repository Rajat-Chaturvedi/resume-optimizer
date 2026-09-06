import mammoth from "mammoth";

export type ExtractedDocument = {
  text: string;
  /** Raw structural signals observed while parsing, used for ATS format checks. */
  signals: {
    source: "pdf" | "docx" | "txt";
    pageCount: number;
    hasImages: boolean;
    hasTables: boolean;
    multiColumn: boolean;
    nonStandardFonts: string[];
    embeddedFonts: string[];
    charCount: number;
  };
};

const MAX_BYTES = 8 * 1024 * 1024;

// Font families that ATS parsers (Taleo, Workday, Greenhouse, iCIMS) reliably map to text.
const ATS_SAFE_FONTS = [
  "arial",
  "helvetica",
  "calibri",
  "cambria",
  "garamond",
  "georgia",
  "times",
  "timesnewroman",
  "verdana",
  "tahoma",
  "trebuchet",
  "lato",
  "roboto",
  "opensans",
  "sourcesanspro",
];

function normaliseFontName(raw: string): string {
  return raw
    .replace(/^[A-Z]{6}\+/, "")
    .replace(/[-_,\s]/g, "")
    .replace(/(bold|italic|oblique|regular|light|medium|semibold|black|mt|ps)/gi, "")
    .toLowerCase();
}

export function assertUploadSafe(file: { size: number; name: string; type: string }) {
  if (file.size === 0) throw new Error("Uploaded file is empty.");
  if (file.size > MAX_BYTES) throw new Error("File exceeds the 8 MB limit.");
  const ext = file.name.toLowerCase().split(".").pop();
  if (!ext || !["pdf", "docx", "txt", "md"].includes(ext)) {
    throw new Error("Unsupported file type. Upload a PDF, DOCX, or TXT resume.");
  }
  return ext as "pdf" | "docx" | "txt" | "md";
}

async function extractPdf(buffer: Buffer): Promise<ExtractedDocument> {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const doc = await pdfjs.getDocument({
    data: new Uint8Array(buffer),
    useWorkerFetch: false,
    isEvalSupported: false,
    useSystemFonts: false,
  }).promise;

  const fonts = new Set<string>();
  let hasImages = false;
  let multiColumn = false;
  const pages: string[] = [];
  let firstPage: Awaited<ReturnType<typeof doc.getPage>> | undefined;

  for (let pageNo = 1; pageNo <= doc.numPages; pageNo += 1) {
    const page = await doc.getPage(pageNo);
    firstPage ??= page;
    const viewport = page.getViewport({ scale: 1 });
    const content = await page.getTextContent();

    const lines = new Map<number, { x: number; width: number; str: string }[]>();
    for (const item of content.items as {
      str: string;
      width: number;
      transform: number[];
      fontName?: string;
    }[]) {
      if (!("str" in item)) continue;
      if (item.fontName) fonts.add(item.fontName);
      if (!item.str.trim()) continue;
      const y = Math.round(item.transform[5] / 3) * 3;
      const bucket = lines.get(y) ?? [];
      bucket.push({ x: item.transform[4], width: item.width ?? 0, str: item.str });
      lines.set(y, bucket);
    }

    const ordered = [...lines.entries()].sort((a, b) => b[0] - a[0]);
    const pageLines = ordered.map(([, parts]) => {
      const sorted = [...parts].sort((a, b) => a.x - b.x);
      // Kerned glyph runs sit flush against each other; only a real gap is a space,
      // otherwise words come back split ("r eusable").
      return sorted
        .reduce((acc, part, i) => {
          if (i === 0) return part.str;
          const previous = sorted[i - 1];
          const gap = part.x - (previous.x + previous.width);
          return acc + (gap > 1 ? " " : "") + part.str;
        }, "")
        .replace(/\s+/g, " ")
        .trim();
    });

    // Column detection: a large horizontal gap repeated across many lines implies a
    // multi-column layout, which ATS parsers read in the wrong order.
    const gapLines = ordered.filter(([, parts]) => {
      const sorted = [...parts].sort((a, b) => a.x - b.x);
      return sorted.some((p, i) => i > 0 && p.x - sorted[i - 1].x > viewport.width * 0.28);
    });
    if (ordered.length > 8 && gapLines.length / ordered.length > 0.25) multiColumn = true;

    const ops = await page.getOperatorList();
    const imageOps = new Set<number>([
      pdfjs.OPS.paintImageXObject,
      pdfjs.OPS.paintInlineImageXObject,
      pdfjs.OPS.paintImageMaskXObject,
    ]);
    if (ops.fnArray.some((fn: number) => imageOps.has(fn))) hasImages = true;

    pages.push(pageLines.filter(Boolean).join("\n"));
    if (page !== firstPage) page.cleanup();
  }

  const text = pages.join("\n\n");
  // pdf.js exposes internal ids (g_d0_f1) on text items; the real family name lives
  // on the loaded font object, so unresolvable ids are ignored rather than flagged.
  const embeddedFonts: string[] = [];
  for (const id of fonts) {
    try {
      const loaded = firstPage?.commonObjs.get(id) as { name?: string } | undefined;
      if (loaded?.name) embeddedFonts.push(loaded.name);
    } catch {
      /* font object not resolvable */
    }
  }
  const nonStandardFonts = embeddedFonts
    .map(normaliseFontName)
    .filter((f) => f.length > 2 && !ATS_SAFE_FONTS.some((safe) => f.includes(safe)));

  return {
    text,
    signals: {
      source: "pdf",
      pageCount: doc.numPages,
      hasImages,
      // Text-layer PDFs expose no table primitive; repeated pipe-delimited rows are the proxy.
      hasTables: text.split("\n").filter((l) => (l.match(/\|/g)?.length ?? 0) >= 2).length >= 3,
      multiColumn,
      nonStandardFonts: [...new Set(nonStandardFonts)],
      embeddedFonts: [...new Set(embeddedFonts)],
      charCount: text.length,
    },
  };
}

function htmlToText(html: string): string {
  return html
    .replace(/<li[^>]*>/gi, "\u2022 ")
    .replace(/<\/(li|p|h[1-6]|div|tr)>/gi, "\n")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#(\d+);/g, (_, code: string) => String.fromCharCode(Number(code)))
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

async function extractDocx(buffer: Buffer): Promise<ExtractedDocument> {
  const [{ value: html }, { value: raw }] = await Promise.all([
    mammoth.convertToHtml({ buffer }),
    mammoth.extractRawText({ buffer }),
  ]);

  // Raw extraction drops list markers, so the HTML conversion (which preserves <li>)
  // is the source of truth for bullet detection.
  const text = htmlToText(html) || raw.replace(/\r/g, "");

  const xml = buffer.toString("latin1");
  const nonStandardFonts = [...xml.matchAll(/w:ascii="([^"]+)"/g)]
    .map((m) => normaliseFontName(m[1]))
    .filter((f) => f.length > 2 && !ATS_SAFE_FONTS.some((safe) => f.includes(safe)));

  return {
    text,
    signals: {
      source: "docx",
      pageCount: Math.max(1, Math.round(text.length / 3500)),
      hasImages: /<img/i.test(html) || xml.includes("<w:drawing"),
      hasTables: /<table/i.test(html) || xml.includes("<w:tbl>"),
      multiColumn: xml.includes("<w:cols") && /w:num="([2-9])"/.test(xml),
      nonStandardFonts: [...new Set(nonStandardFonts)],
      embeddedFonts: [],
      charCount: text.length,
    },
  };
}

export async function extractDocument(
  buffer: Buffer,
  ext: "pdf" | "docx" | "txt" | "md"
): Promise<ExtractedDocument> {
  if (ext === "pdf") return extractPdf(buffer);
  if (ext === "docx") return extractDocx(buffer);
  const text = buffer.toString("utf8");
  return {
    text,
    signals: {
      source: "txt",
      pageCount: Math.max(1, Math.round(text.length / 3500)),
      hasImages: false,
      hasTables: false,
      multiColumn: false,
      nonStandardFonts: [],
      embeddedFonts: [],
      charCount: text.length,
    },
  };
}
