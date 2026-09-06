"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import GapReportPanel from "@/components/GapReportPanel";
import OptimizationSummary from "@/components/OptimizationSummary";
import ResumePreview from "@/components/ResumePreview";
import TemplateGallery from "@/components/TemplateGallery";
import ThemeSwitcher from "@/components/ThemeSwitcher";
import { getTemplate, type TemplateId } from "@/lib/templates";
import type { GapReport, OptimizeResult, StructuredResume } from "@/lib/types";

type AnalyzeResponse = {
  resume: StructuredResume;
  report: GapReport;
  jdText: string;
  resumeText: string;
};

export default function Home() {
  const fileRef = useRef<HTMLInputElement>(null);
  const [jdText, setJdText] = useState("");
  const [busy, setBusy] = useState<"analyze" | "optimize" | "export" | null>(null);
  const [stage, setStage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [analysis, setAnalysis] = useState<AnalyzeResponse | null>(null);
  const [optimized, setOptimized] = useState<(OptimizeResult & { verification: GapReport }) | null>(null);
  const [editedResume, setEditedResume] = useState<StructuredResume | null>(null);
  const [templateId, setTemplateId] = useState<TemplateId>("faang-standard");
  const [view, setView] = useState<"optimized" | "original">("optimized");
  const [zoom, setZoom] = useState(0.8);
  const [liveReport, setLiveReport] = useState<GapReport | null>(null);
  const [rescoring, setRescoring] = useState(false);

  const spec = useMemo(() => getTemplate(templateId), [templateId]);
  const previewResume =
    view === "original" ? analysis?.resume ?? null : editedResume ?? optimized?.resume ?? analysis?.resume ?? null;

  // Preview edits re-score against the JD so the metrics track what the user typed.
  useEffect(() => {
    if (!editedResume || !analysis || !optimized) return;
    if (editedResume === optimized.resume) {
      setLiveReport(null);
      return;
    }
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setRescoring(true);
      try {
        const res = await fetch("/api/verify", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ resume: editedResume, jdText: analysis.jdText }),
          signal: controller.signal,
        });
        const data = await res.json();
        if (res.ok) setLiveReport(data.report as GapReport);
      } catch {
        /* superseded by a newer edit */
      } finally {
        setRescoring(false);
      }
    }, 700);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [editedResume, analysis, optimized]);

  async function runAnalysis(): Promise<AnalyzeResponse | null> {
    const file = fileRef.current?.files?.[0];
    if (!file) {
      setError("Select a resume file first.");
      return null;
    }
    if (jdText.trim().length < 80) {
      setError("Paste a job description (at least 80 characters).");
      return null;
    }

    setBusy("analyze");
    setStage("Parsing your resume and scoring it against the job description…");
    setError(null);
    setOptimized(null);
    setEditedResume(null);

    try {
      const form = new FormData();
      form.append("resume", file);
      form.append("jdText", jdText);
      const res = await fetch("/api/analyze", { method: "POST", body: form });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Analysis failed.");
      setAnalysis(data as AnalyzeResponse);
      setView("original");
      return data as AnalyzeResponse;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Analysis failed.");
      return null;
    } finally {
      setBusy(null);
    }
  }

  async function runOptimization(source: AnalyzeResponse | null = analysis, confirmedSkills: string[] = []) {
    if (!source) return;
    setBusy("optimize");
    setStage(
      confirmedSkills.length
        ? "Adding your confirmed skills and re-optimizing…"
        : "Rewriting bullets, aligning keywords and re-checking ATS compliance…"
    );
    setError(null);
    try {
      const res = await fetch("/api/optimize", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          resume: source.resume,
          report: source.report,
          jdText: source.jdText,
          confirmedSkills,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Optimization failed.");
      setOptimized(data);
      setEditedResume(data.resume);
      setView("optimized");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Optimization failed.");
    } finally {
      setBusy(null);
      setStage(null);
    }
  }

  async function handleRun(event: React.FormEvent) {
    event.preventDefault();
    const result = await runAnalysis();
    if (result) await runOptimization(result);
    setStage(null);
  }

  async function handleReportOnly() {
    await runAnalysis();
    setStage(null);
  }

  async function handleExport(format: "pdf" | "docx") {
    if (!previewResume) return;
    setBusy("export");
    setError(null);
    try {
      const res = await fetch("/api/export", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ resume: previewResume, templateId, format }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Export failed.");
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${previewResume.contact.name.replace(/\s+/g, "_")}_${templateId}.${format}`;
      link.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Export failed.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <main className="shell">
      <header className="masthead">
        <div className="masthead-row">
          <h1>Resume-to-JD Optimizer</h1>
          <ThemeSwitcher />
        </div>
      </header>
      <p className="masthead-sub">
        Upload a resume and a job description to get a keyword/qualification gap report, an ATS compliance audit,
        a rewritten FAANG-style resume, and ATS-safe PDF/DOCX exports.
      </p>

      <div className="layout">
        <div>
          <form className="card" onSubmit={handleRun}>
            <h2>1 · Input</h2>
            <p className="hint">PDF, DOCX, or TXT resume up to 8 MB. Scanned images cannot be parsed by an ATS.</p>
            <label className="field" htmlFor="resume">
              Resume / CV
            </label>
            <input id="resume" ref={fileRef} type="file" accept=".pdf,.docx,.txt,.md" />
            <label className="field" htmlFor="jd" style={{ marginTop: 14 }}>
              Job description
            </label>
            <textarea
              id="jd"
              value={jdText}
              onChange={(e) => setJdText(e.target.value)}
              placeholder="Paste the full job description, including requirements and qualifications…"
            />
            <div className="row" style={{ marginTop: 12 }}>
              <button className="primary" type="submit" disabled={busy !== null}>
                {busy === "analyze" || busy === "optimize" ? <span className="spinner" /> : null}
                {analysis ? "Run again" : "Analyze & optimize"}
              </button>
              <button type="button" onClick={handleReportOnly} disabled={busy !== null}>
                Gap report only
              </button>
              {analysis && !optimized && (
                <button type="button" onClick={() => runOptimization()} disabled={busy !== null}>
                  Optimize now
                </button>
              )}
            </div>
            <p className="hint" style={{ margin: "10px 0 0" }}>
              {stage ??
                "One run produces the gap report, the rewritten resume, and the before/after comparison below."}
            </p>
            {error && <div className="error">{error}</div>}
          </form>

          {analysis && (
            <GapReportPanel report={analysis.report} title="2 · Gap report (original resume)" />
          )}

          {optimized && (
            <>
              <OptimizationSummary
                before={analysis!.report}
                result={liveReport ? { ...optimized, verification: liveReport } : optimized}
                busy={busy !== null}
                onConfirmSkills={(skills) => {
                  void runOptimization(analysis, skills).then(() => setStage(null));
                }}
              />
              <GapReportPanel
                report={liveReport ?? optimized.verification}
                title={liveReport ? "3 · Report after your edits" : "3 · Report after optimization"}
              />
            </>
          )}
        </div>

        <div className="rail">
          <div className="card">
            <h2>4 · Template library</h2>
            <p className="hint">
              Every template is single-column, table-free, and uses ATS-safe fonts. Selecting one instantly
              re-renders the preview and export.
            </p>
            <TemplateGallery selected={templateId} onSelect={setTemplateId} />
          </div>

          <div className="card">
            <div className="preview-toolbar">
              <div className="row" style={{ justifyContent: "space-between" }}>
                <h2 style={{ margin: 0 }}>5 · Preview &amp; export</h2>
                <div className="row">
                  <button type="button" onClick={() => setZoom((z) => Math.max(0.45, +(z - 0.1).toFixed(2)))}>
                    −
                  </button>
                  <span className="badge">{Math.round(zoom * 100)}%</span>
                  <button type="button" onClick={() => setZoom((z) => Math.min(1.2, +(z + 0.1).toFixed(2)))}>
                    +
                  </button>
                </div>
              </div>

            {analysis && (
              <div className="tabs">
                <button
                  type="button"
                  className={view === "original" ? "active" : ""}
                  onClick={() => setView("original")}
                >
                  Original
                </button>
                <button
                  type="button"
                  className={view === "optimized" ? "active" : ""}
                  onClick={() => setView("optimized")}
                  disabled={!optimized}
                >
                  Optimized
                </button>
                <div className="spacer" />
                <button type="button" onClick={() => handleExport("pdf")} disabled={busy !== null || !previewResume}>
                  Export PDF
                </button>
                <button
                  type="button"
                  className="primary"
                  onClick={() => handleExport("docx")}
                  disabled={busy !== null || !previewResume}
                >
                  Export DOCX
                </button>
              </div>
            )}
            </div>

            {previewResume ? (
              <>
                {view === "optimized" && optimized && (
                  <p className="hint" style={{ margin: "0 0 10px" }}>
                    Click any line to edit it — name, title, contact, skills, dates, bullets, projects, education.
                    Metrics above refresh automatically.{" "}
                    {rescoring && (
                      <span className="live-badge">
                        <span className="spinner" /> re-scoring
                      </span>
                    )}
                  </p>
                )}
                <div className="preview-wrap">
                  <ResumePreview
                    resume={previewResume}
                    spec={spec}
                    zoom={zoom}
                    onEdit={view === "optimized" && optimized ? setEditedResume : undefined}
                  />
                </div>
              </>
            ) : (
              <p className="hint" style={{ margin: 0 }}>
                Run an analysis to see the live preview. Once optimized, click any bullet in the preview to edit it
                inline before exporting.
              </p>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
