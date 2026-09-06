import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import { SECTION_LABELS } from "@/constants/copy";
import type { TemplateSpec } from "./templates";
import type { StructuredResume } from "./types";

const PAGE_WIDTH = 612; // US Letter, 72 dpi
const PAGE_HEIGHT = 792;

type Fonts = { regular: PDFFont; bold: PDFFont; italic: PDFFont };

/**
 * Standard-14 fonts only: they embed no subset tables, so every ATS text
 * extractor recovers the characters exactly.
 */
async function loadFonts(doc: PDFDocument, spec: TemplateSpec): Promise<Fonts> {
  const serif = spec.docFont === "Times New Roman" || spec.docFont === "Georgia";
  return {
    regular: await doc.embedFont(serif ? StandardFonts.TimesRoman : StandardFonts.Helvetica),
    bold: await doc.embedFont(serif ? StandardFonts.TimesRomanBold : StandardFonts.HelveticaBold),
    italic: await doc.embedFont(serif ? StandardFonts.TimesRomanItalic : StandardFonts.HelveticaOblique),
  };
}

function sanitise(text: string): string {
  return text
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201c\u201d]/g, '"')
    .replace(/[\u2013\u2014]/g, "-")
    .replace(/\u2022/g, "-")
    .replace(/\u2026/g, "...")
    .replace(/[^\x20-\x7E]/g, "");
}

function wrap(text: string, font: PDFFont, size: number, maxWidth: number): string[] {
  const words = sanitise(text).split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word;
    if (font.widthOfTextAtSize(candidate, size) > maxWidth && line) {
      lines.push(line);
      line = word;
    } else {
      line = candidate;
    }
  }
  if (line) lines.push(line);
  return lines.length ? lines : [""];
}

export async function buildPdf(resume: StructuredResume, spec: TemplateSpec): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.setTitle(`${resume.contact.name} - Resume`);
  doc.setProducer("Resume-to-JD Optimizer");
  const fonts = await loadFonts(doc, spec);

  const margin = spec.marginInches * 72;
  const maxWidth = PAGE_WIDTH - margin * 2;
  const color = rgb(0.07, 0.09, 0.15);
  const size = spec.bodySize;
  const leading = size * spec.lineHeight;

  let page: PDFPage = doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  let y = PAGE_HEIGHT - margin;

  const ensureSpace = (needed: number) => {
    if (y - needed < margin) {
      page = doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
      y = PAGE_HEIGHT - margin;
    }
  };

  const drawText = (
    text: string,
    opts: { font?: PDFFont; size?: number; indent?: number; align?: "left" | "center"; after?: number } = {}
  ) => {
    const font = opts.font ?? fonts.regular;
    const fontSize = opts.size ?? size;
    const indent = opts.indent ?? 0;
    const lines = wrap(text, font, fontSize, maxWidth - indent);
    for (const line of lines) {
      ensureSpace(fontSize * spec.lineHeight);
      const width = font.widthOfTextAtSize(line, fontSize);
      const x = opts.align === "center" ? (PAGE_WIDTH - width) / 2 : margin + indent;
      page.drawText(line, { x, y: y - fontSize, size: fontSize, font, color });
      y -= fontSize * spec.lineHeight;
    }
    y -= opts.after ?? 0;
  };

  const drawRightAligned = (left: string, right: string, font: PDFFont) => {
    ensureSpace(leading);
    page.drawText(sanitise(left), { x: margin, y: y - size, size, font, color });
    if (right) {
      const width = fonts.regular.widthOfTextAtSize(sanitise(right), size);
      page.drawText(sanitise(right), {
        x: PAGE_WIDTH - margin - width,
        y: y - size,
        size,
        font: fonts.regular,
        color,
      });
    }
    y -= leading;
  };

  const drawHeading = (label: string) => {
    const text = spec.headingCase === "upper" ? label.toUpperCase() : label;
    ensureSpace(spec.headingSize * 2.4);
    y -= spec.sectionGap * 0.55;
    drawText(text, { font: fonts.bold, size: spec.headingSize });
    if (spec.ruleUnderHeadings) {
      y -= 2;
      page.drawLine({
        start: { x: margin, y },
        end: { x: PAGE_WIDTH - margin, y },
        thickness: 0.7,
        color: rgb(0.6, 0.6, 0.6),
      });
      y -= 6;
    } else {
      y -= 3;
    }
  };

  const centerHeader = spec.headerAlign === "center";
  drawText(resume.contact.name, {
    font: fonts.bold,
    size: spec.nameSize,
    align: centerHeader ? "center" : "left",
  });
  if (resume.contact.title) {
    drawText(resume.contact.title, { size: size + 1, align: centerHeader ? "center" : "left" });
  }
  const contactLine = [resume.contact.email, resume.contact.phone, resume.contact.location, ...resume.contact.links]
    .filter(Boolean)
    .join("  |  ");
  if (contactLine) drawText(contactLine, { align: centerHeader ? "center" : "left", after: 4 });

  if (resume.summary) {
    drawHeading(SECTION_LABELS.summary);
    drawText(resume.summary);
  }

  if (resume.skills.length) {
    drawHeading(SECTION_LABELS.skills);
    for (const group of resume.skills) {
      drawText(`${group.category}: ${group.skills.join(", ")}`);
    }
  }

  if (resume.experience.length) {
    drawHeading(SECTION_LABELS.experience);
    for (const exp of resume.experience) {
      const dates = [exp.startDate, exp.endDate].filter(Boolean).join(" - ");
      drawRightAligned(exp.role, dates, fonts.bold);
      const companyLine = [exp.company, exp.location].filter(Boolean).join(", ");
      if (companyLine) drawText(companyLine, { font: fonts.italic });
      for (const b of exp.bullets) {
        ensureSpace(leading);
        page.drawText("-", { x: margin + 4, y: y - size, size, font: fonts.regular, color });
        drawText(b, { indent: 16 });
      }
      y -= 4;
    }
  }

  if (resume.projects.length) {
    drawHeading(SECTION_LABELS.projects);
    for (const project of resume.projects) {
      drawText(project.description ? `${project.name} - ${project.description}` : project.name, {
        font: fonts.bold,
      });
      for (const b of project.bullets) {
        ensureSpace(leading);
        page.drawText("-", { x: margin + 4, y: y - size, size, font: fonts.regular, color });
        drawText(b, { indent: 16 });
      }
      y -= 4;
    }
  }

  if (resume.education.length) {
    drawHeading(SECTION_LABELS.education);
    for (const edu of resume.education) {
      drawRightAligned(edu.institution || edu.degree, edu.graduation ?? "", fonts.bold);
      if (edu.institution && edu.degree) drawText(edu.degree, { font: fonts.italic });
      for (const d of edu.details) drawText(d, { indent: 16 });
      y -= 4;
    }
  }

  if (resume.certifications.length) {
    drawHeading(SECTION_LABELS.certifications);
    for (const cert of resume.certifications) {
      ensureSpace(leading);
      page.drawText("-", { x: margin + 4, y: y - size, size, font: fonts.regular, color });
      drawText(cert, { indent: 16 });
    }
  }

  return doc.save();
}
