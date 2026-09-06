export type TemplateId = "harvard-classic" | "faang-standard" | "modern-sans" | "executive-serif";

export type TemplateSpec = {
  id: TemplateId;
  name: string;
  origin: string;
  description: string;
  /** Font stack for on-screen preview. */
  cssFont: string;
  /** Font family name written into DOCX / mapped to a PDF standard font. */
  docFont: "Times New Roman" | "Calibri" | "Arial" | "Georgia";
  bodySize: number;
  nameSize: number;
  headingSize: number;
  headingCase: "upper" | "title";
  headerAlign: "left" | "center";
  ruleUnderHeadings: boolean;
  accent: string;
  lineHeight: number;
  sectionGap: number;
  marginInches: number;
};

export const TEMPLATES: TemplateSpec[] = [
  {
    id: "harvard-classic",
    name: "Harvard Classic",
    origin: "Harvard OCS resume standard",
    description:
      "Centered serif header, uppercase ruled headings. The most conservative layout; parses cleanly in Taleo and Workday.",
    cssFont: "'Times New Roman', Times, serif",
    docFont: "Times New Roman",
    bodySize: 10.5,
    nameSize: 20,
    headingSize: 11.5,
    headingCase: "upper",
    headerAlign: "center",
    ruleUnderHeadings: true,
    accent: "#111827",
    lineHeight: 1.34,
    sectionGap: 14,
    marginInches: 0.75,
  },
  {
    id: "faang-standard",
    name: "FAANG Standard",
    origin: "Big-tech recruiting / Google XYZ bullet format",
    description:
      "Dense single column tuned for a 6-second scan: left-aligned header, tight leading, metrics-forward bullets.",
    cssFont: "Calibri, 'Segoe UI', Arial, sans-serif",
    docFont: "Calibri",
    bodySize: 10.5,
    nameSize: 19,
    headingSize: 11,
    headingCase: "upper",
    headerAlign: "left",
    ruleUnderHeadings: true,
    accent: "#0f172a",
    lineHeight: 1.28,
    sectionGap: 12,
    marginInches: 0.6,
  },
  {
    id: "modern-sans",
    name: "Modern Sans",
    origin: "Jobscan ATS-friendly reference layout",
    description:
      "Clean Arial layout with generous whitespace and title-case headings. Safest choice for iCIMS and Greenhouse.",
    cssFont: "Arial, Helvetica, sans-serif",
    docFont: "Arial",
    bodySize: 10.5,
    nameSize: 21,
    headingSize: 11.5,
    headingCase: "title",
    headerAlign: "left",
    ruleUnderHeadings: false,
    accent: "#1f2937",
    lineHeight: 1.4,
    sectionGap: 16,
    marginInches: 0.8,
  },
  {
    id: "executive-serif",
    name: "Executive Serif",
    origin: "Senior/leadership hiring convention",
    description:
      "Georgia serif with a prominent summary block, built for director-and-above narratives while staying ATS-plain.",
    cssFont: "Georgia, 'Times New Roman', serif",
    docFont: "Georgia",
    bodySize: 10.5,
    nameSize: 22,
    headingSize: 12,
    headingCase: "upper",
    headerAlign: "center",
    ruleUnderHeadings: true,
    accent: "#1e293b",
    lineHeight: 1.42,
    sectionGap: 16,
    marginInches: 0.85,
  },
];

export function getTemplate(id: string | undefined): TemplateSpec {
  return TEMPLATES.find((t) => t.id === id) ?? TEMPLATES[1];
}
