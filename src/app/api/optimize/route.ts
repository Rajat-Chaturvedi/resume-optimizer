import { NextResponse } from "next/server";
import { buildGapReport } from "@/lib/gapAnalysis";
import { optimiseResume } from "@/lib/optimizer";
import { resumeToPlainText } from "@/lib/resumeParser";
import type { GapReport, StructuredResume } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 180;

export async function POST(request: Request) {
  try {
    const { resume, report, jdText, confirmedSkills } = (await request.json()) as {
      resume?: StructuredResume;
      report?: GapReport;
      jdText?: string;
      confirmedSkills?: string[];
    };

    if (!resume || !report || !jdText) {
      return NextResponse.json({ error: "resume, report and jdText are required." }, { status: 400 });
    }

    const confirmed = Array.isArray(confirmedSkills)
      ? confirmedSkills.filter((s) => typeof s === "string" && s.trim().length > 0 && s.length <= 60).slice(0, 25)
      : [];

    const result = await optimiseResume(resume, report, jdText, confirmed);
    const optimisedText = resumeToPlainText(result.resume);

    // Re-score against the layout the exporter actually produces: single column,
    // no tables, no graphics, standard fonts.
    const verification = await buildGapReport(
      optimisedText,
      jdText,
      {
        source: "docx",
        pageCount: Math.max(1, Math.round(optimisedText.length / 3500)),
        hasImages: false,
        hasTables: false,
        multiColumn: false,
        nonStandardFonts: [],
        embeddedFonts: [],
        charCount: optimisedText.length,
      },
      result.resume
    );

    return NextResponse.json({ ...result, verification });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Optimization failed.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
