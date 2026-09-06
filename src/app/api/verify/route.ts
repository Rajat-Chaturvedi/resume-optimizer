import { NextResponse } from "next/server";
import { verifyResume } from "@/lib/gapAnalysis";
import type { StructuredResume } from "@/lib/types";

export const runtime = "nodejs";

/** Re-scores an edited resume so preview edits update the metrics live. */
export async function POST(request: Request) {
  try {
    const { resume, jdText } = (await request.json()) as {
      resume?: StructuredResume;
      jdText?: string;
    };

    if (!resume || !jdText) {
      return NextResponse.json({ error: "resume and jdText are required." }, { status: 400 });
    }

    return NextResponse.json({ report: await verifyResume(resume, jdText) });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Verification failed.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
