import {
  AlignmentType,
  BorderStyle,
  Document,
  HeadingLevel,
  Packer,
  Paragraph,
  TabStopType,
  TextRun,
} from "docx";
import { SECTION_LABELS } from "@/constants/copy";
import type { TemplateSpec } from "./templates";
import type { StructuredResume } from "./types";

const TWIPS_PER_INCH = 1440;
const CONTENT_WIDTH_TWIPS = (8.5 - 1.2) * TWIPS_PER_INCH;

function headingText(text: string, spec: TemplateSpec): string {
  return spec.headingCase === "upper" ? text.toUpperCase() : text;
}

function sectionHeading(text: string, spec: TemplateSpec): Paragraph {
  return new Paragraph({
    heading: HeadingLevel.HEADING_2,
    spacing: { before: spec.sectionGap * 12, after: 60 },
    border: spec.ruleUnderHeadings
      ? { bottom: { style: BorderStyle.SINGLE, size: 6, color: "999999", space: 2 } }
      : undefined,
    children: [
      new TextRun({
        text: headingText(text, spec),
        bold: true,
        size: Math.round(spec.headingSize * 2),
        font: spec.docFont,
        characterSpacing: 12,
      }),
    ],
  });
}

function body(text: string, spec: TemplateSpec, opts: { bold?: boolean; italics?: boolean } = {}): TextRun {
  return new TextRun({
    text,
    bold: opts.bold,
    italics: opts.italics,
    size: Math.round(spec.bodySize * 2),
    font: spec.docFont,
  });
}

function bullet(text: string, spec: TemplateSpec): Paragraph {
  return new Paragraph({
    bullet: { level: 0 },
    spacing: { after: 40, line: Math.round(spec.lineHeight * 240) },
    children: [body(text, spec)],
  });
}

/** Role on the left, dates right-aligned via a tab stop — no tables, so ATS-safe. */
function twoColumnLine(left: TextRun[], right: string, spec: TemplateSpec): Paragraph {
  return new Paragraph({
    tabStops: [{ type: TabStopType.RIGHT, position: CONTENT_WIDTH_TWIPS }],
    spacing: { after: 30 },
    children: right ? [...left, body(`\t${right}`, spec)] : left,
  });
}

export async function buildDocx(resume: StructuredResume, spec: TemplateSpec): Promise<Buffer> {
  const children: Paragraph[] = [];
  const align = spec.headerAlign === "center" ? AlignmentType.CENTER : AlignmentType.LEFT;

  children.push(
    new Paragraph({
      alignment: align,
      spacing: { after: 40 },
      children: [
        new TextRun({
          text: resume.contact.name,
          bold: true,
          size: Math.round(spec.nameSize * 2),
          font: spec.docFont,
        }),
      ],
    })
  );

  if (resume.contact.title) {
    children.push(
      new Paragraph({
        alignment: align,
        spacing: { after: 40 },
        children: [body(resume.contact.title, spec)],
      })
    );
  }

  const contactLine = [
    resume.contact.email,
    resume.contact.phone,
    resume.contact.location,
    ...resume.contact.links,
  ]
    .filter(Boolean)
    .join("  |  ");
  if (contactLine) {
    children.push(
      new Paragraph({ alignment: align, spacing: { after: 60 }, children: [body(contactLine, spec)] })
    );
  }

  if (resume.summary) {
    children.push(sectionHeading(SECTION_LABELS.summary, spec));
    children.push(
      new Paragraph({
        spacing: { after: 60, line: Math.round(spec.lineHeight * 240) },
        children: [body(resume.summary, spec)],
      })
    );
  }

  if (resume.skills.length) {
    children.push(sectionHeading(SECTION_LABELS.skills, spec));
    for (const group of resume.skills) {
      children.push(
        new Paragraph({
          spacing: { after: 40, line: Math.round(spec.lineHeight * 240) },
          children: [body(`${group.category}: `, spec, { bold: true }), body(group.skills.join(", "), spec)],
        })
      );
    }
  }

  if (resume.experience.length) {
    children.push(sectionHeading(SECTION_LABELS.experience, spec));
    for (const exp of resume.experience) {
      const dates = [exp.startDate, exp.endDate].filter(Boolean).join(" – ");
      children.push(twoColumnLine([body(exp.role, spec, { bold: true })], dates, spec));
      const companyLine = [exp.company, exp.location].filter(Boolean).join(", ");
      if (companyLine) {
        children.push(
          new Paragraph({ spacing: { after: 40 }, children: [body(companyLine, spec, { italics: true })] })
        );
      }
      for (const b of exp.bullets) children.push(bullet(b, spec));
    }
  }

  if (resume.projects.length) {
    children.push(sectionHeading(SECTION_LABELS.projects, spec));
    for (const project of resume.projects) {
      children.push(
        new Paragraph({
          spacing: { after: 30 },
          children: [
            body(project.name, spec, { bold: true }),
            ...(project.description ? [body(` — ${project.description}`, spec)] : []),
          ],
        })
      );
      for (const b of project.bullets) children.push(bullet(b, spec));
    }
  }

  if (resume.education.length) {
    children.push(sectionHeading(SECTION_LABELS.education, spec));
    for (const edu of resume.education) {
      children.push(twoColumnLine([body(edu.institution || edu.degree, spec, { bold: true })], edu.graduation ?? "", spec));
      if (edu.institution && edu.degree) {
        children.push(new Paragraph({ spacing: { after: 30 }, children: [body(edu.degree, spec, { italics: true })] }));
      }
      for (const d of edu.details) children.push(bullet(d, spec));
    }
  }

  if (resume.certifications.length) {
    children.push(sectionHeading(SECTION_LABELS.certifications, spec));
    for (const cert of resume.certifications) children.push(bullet(cert, spec));
  }

  const doc = new Document({
    creator: "Resume-to-JD Optimizer",
    title: `${resume.contact.name} Resume`,
    styles: { default: { document: { run: { font: spec.docFont, size: Math.round(spec.bodySize * 2) } } } },
    sections: [
      {
        properties: {
          page: {
            margin: {
              top: spec.marginInches * TWIPS_PER_INCH,
              bottom: spec.marginInches * TWIPS_PER_INCH,
              left: spec.marginInches * TWIPS_PER_INCH,
              right: spec.marginInches * TWIPS_PER_INCH,
            },
          },
        },
        children,
      },
    ],
  });

  return Buffer.from(await Packer.toBuffer(doc));
}
