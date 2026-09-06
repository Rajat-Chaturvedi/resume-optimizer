import { NextResponse } from "next/server";
import { assertUploadSafe, extractDocument } from "@/lib/extract";
import { buildGapReport } from "@/lib/gapAnalysis";
import { parseResume } from "@/lib/resumeParser";

export const runtime = "nodejs";
export const maxDuration = 120;

export async function POST(request: Request) {
  try {
    const form = await request.formData();
    const resumeFile = form.get("resume");
    const jdFile = form.get("jdFile");
    const jdTextRaw = String(form.get("jdText") ?? "").trim();

    if (!(resumeFile instanceof File)) {
      return NextResponse.json({ error: "Upload a resume file." }, { status: 400 });
    }

    const ext = assertUploadSafe(resumeFile);
    const buffer = Buffer.from(await resumeFile.arrayBuffer());
    const extracted = await extractDocument(buffer, ext);

    let jdText = jdTextRaw;
    if (!jdText && jdFile instanceof File) {
      const jdExt = assertUploadSafe(jdFile);
      const jdBuffer = Buffer.from(await jdFile.arrayBuffer());
      jdText = (await extractDocument(jdBuffer, jdExt)).text;
    }

    if (jdText.trim().length < 80) {
      return NextResponse.json(
        { error: "Provide a job description of at least 80 characters." },
        { status: 400 }
      );
    }

    if (extracted.text.trim().length < 120) {
      return NextResponse.json(
        {
          error:
            "Could not extract text from the resume. It is likely a scanned image — export a text-based PDF or DOCX and retry.",
        },
        { status: 422 }
      );
    }

    const resume = parseResume(extracted.text);
    const report = await buildGapReport(extracted.text, jdText, extracted.signals, resume);

    return NextResponse.json({
      resumeText: extracted.text,
      signals: extracted.signals,
      resume,
      report,
      jdText,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Analysis failed.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
