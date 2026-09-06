import { NextResponse } from "next/server";
import { OPTIMIZER } from "@/constants/config";
import { verifyResume } from "@/lib/gapAnalysis";
import { optimiseResume } from "@/lib/optimizer";
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
      ? confirmedSkills
          .filter(
            (s) =>
              typeof s === "string" && s.trim().length > 0 && s.length <= OPTIMIZER.maxConfirmedSkillLength
          )
          .slice(0, OPTIMIZER.maxConfirmedSkills)
      : [];

    const result = await optimiseResume(resume, report, jdText, confirmed);
    const verification = await verifyResume(result.resume, jdText);

    return NextResponse.json({ ...result, verification });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Optimization failed.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
