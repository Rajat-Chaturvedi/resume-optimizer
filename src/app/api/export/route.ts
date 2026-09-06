import { NextResponse } from "next/server";
import { buildDocx } from "@/lib/exportDocx";
import { buildPdf } from "@/lib/exportPdf";
import { getTemplate } from "@/lib/templates";
import type { StructuredResume } from "@/lib/types";

export const runtime = "nodejs";

function safeFileName(name: string): string {
  const base = name.replace(/[^\w\s-]/g, "").trim().replace(/\s+/g, "_") || "Resume";
  return base.slice(0, 60);
}

export async function POST(request: Request) {
  try {
    const { resume, templateId, format } = (await request.json()) as {
      resume?: StructuredResume;
      templateId?: string;
      format?: "pdf" | "docx";
    };

    if (!resume?.contact?.name) {
      return NextResponse.json({ error: "A resume payload is required." }, { status: 400 });
    }
    if (format !== "pdf" && format !== "docx") {
      return NextResponse.json({ error: "format must be 'pdf' or 'docx'." }, { status: 400 });
    }

    const spec = getTemplate(templateId);
    const fileName = `${safeFileName(resume.contact.name)}_${spec.id}.${format}`;
    const bytes = format === "pdf" ? await buildPdf(resume, spec) : await buildDocx(resume, spec);

    return new NextResponse(new Uint8Array(bytes), {
      headers: {
        "content-type":
          format === "pdf"
            ? "application/pdf"
            : "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "content-disposition": `attachment; filename="${fileName}"`,
        "cache-control": "no-store",
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Export failed.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
