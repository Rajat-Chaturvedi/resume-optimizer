"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import GapReportPanel from "@/components/GapReportPanel";
import OptimizationSummary from "@/components/OptimizationSummary";
import ResumePreview from "@/components/ResumePreview";
import TemplateGallery from "@/components/TemplateGallery";
import ThemeSwitcher from "@/components/ThemeSwitcher";
import { PREVIEW, UPLOAD } from "@/constants/config";
import { APP, INPUT_PANEL, PREVIEW_PANEL, REPORT_PANEL, TEMPLATE_PANEL, VALIDATION } from "@/constants/copy";
import { getTemplate, type TemplateId } from "@/lib/templates";
import type { GapReport, LengthMode, OptimizeResult, StructuredResume } from "@/lib/types";

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
  const [zoom, setZoom] = useState<number>(PREVIEW.defaultZoom);
  const [liveReport, setLiveReport] = useState<GapReport | null>(null);
  const [rescoring, setRescoring] = useState(false);
  const [lengthMode, setLengthMode] = useState<LengthMode>("as-is");

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
    }, PREVIEW.rescoreDelayMs);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [editedResume, analysis, optimized]);

  async function runAnalysis(): Promise<AnalyzeResponse | null> {
    const file = fileRef.current?.files?.[0];
    if (!file) {
      setError(VALIDATION.missingResume);
      return null;
    }
    if (jdText.trim().length < UPLOAD.minJdCharacters) {
      setError(VALIDATION.shortJd);
      return null;
    }

    setBusy("analyze");
    setStage(INPUT_PANEL.stageAnalyzing);
    setError(null);
    setOptimized(null);
    setEditedResume(null);

    try {
      const form = new FormData();
      form.append("resume", file);
      form.append("jdText", jdText);
      const res = await fetch("/api/analyze", { method: "POST", body: form });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? VALIDATION.analysisFailed);
      setAnalysis(data as AnalyzeResponse);
      setView("original");
      return data as AnalyzeResponse;
    } catch (err) {
      setError(err instanceof Error ? err.message : VALIDATION.analysisFailed);
      return null;
    } finally {
      setBusy(null);
    }
  }

  async function runOptimization(
    source: AnalyzeResponse | null = analysis,
    confirmedSkills: string[] = [],
    mode: LengthMode = lengthMode
  ) {
    if (!source) return;
    setBusy("optimize");
    setStage(confirmedSkills.length ? INPUT_PANEL.stageConfirming : INPUT_PANEL.stageOptimizing);
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
          lengthMode: mode,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? VALIDATION.optimizationFailed);
      setOptimized(data);
      setEditedResume(data.resume);
      setView("optimized");
    } catch (err) {
      setError(err instanceof Error ? err.message : VALIDATION.optimizationFailed);
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
        throw new Error(data.error ?? VALIDATION.exportFailed);
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${previewResume.contact.name.replace(/\s+/g, "_")}_${templateId}.${format}`;
      link.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : VALIDATION.exportFailed);
    } finally {
      setBusy(null);
    }
  }

  return (
    <main className="shell">
      <header className="masthead">
        <div className="masthead-row">
          <h1>{APP.name}</h1>
          <ThemeSwitcher />
        </div>
      </header>
      <p className="masthead-sub">{APP.description}</p>

      <div className="layout">
        <div>
          <form className="card" onSubmit={handleRun}>
            <h2>{INPUT_PANEL.title}</h2>
            <p className="hint">{INPUT_PANEL.hint}</p>
            <label className="field" htmlFor="resume">
              {INPUT_PANEL.resumeLabel}
            </label>
            <input id="resume" ref={fileRef} type="file" accept={UPLOAD.accept} />
            <label className="field" htmlFor="jd" style={{ marginTop: 14 }}>
              {INPUT_PANEL.jdLabel}
            </label>
            <textarea
              id="jd"
              value={jdText}
              onChange={(e) => setJdText(e.target.value)}
              placeholder={INPUT_PANEL.jdPlaceholder}
            />
            <div className="row" style={{ marginTop: 12 }}>
              <button className="primary" type="submit" disabled={busy !== null}>
                {busy === "analyze" || busy === "optimize" ? <span className="spinner" /> : null}
                {analysis ? INPUT_PANEL.runAgain : INPUT_PANEL.run}
              </button>
              <button type="button" onClick={handleReportOnly} disabled={busy !== null}>
                {INPUT_PANEL.reportOnly}
              </button>
              {analysis && !optimized && (
                <button type="button" onClick={() => runOptimization()} disabled={busy !== null}>
                  {INPUT_PANEL.optimizeNow}
                </button>
              )}
            </div>
            <p className="hint" style={{ margin: "10px 0 0" }}>
              {stage ?? INPUT_PANEL.idle}
            </p>
            {error && <div className="error">{error}</div>}
          </form>

          {analysis && <GapReportPanel report={analysis.report} title={REPORT_PANEL.originalTitle} />}

          {optimized && (
            <>
              <OptimizationSummary
                before={analysis!.report}
                result={liveReport ? { ...optimized, verification: liveReport } : optimized}
                busy={busy !== null}
                onConfirmSkills={(skills) => {
                  void runOptimization(analysis, skills).then(() => setStage(null));
                }}
                onLengthChange={(mode) => {
                  setLengthMode(mode);
                  void runOptimization(analysis, optimized.confirmedSkills, mode).then(() => setStage(null));
                }}
              />
              <GapReportPanel
                report={liveReport ?? optimized.verification}
                title={liveReport ? REPORT_PANEL.editedTitle : REPORT_PANEL.optimizedTitle}
              />
            </>
          )}
        </div>

        <div className="rail">
          <div className="card">
            <h2>{TEMPLATE_PANEL.title}</h2>
            <p className="hint">{TEMPLATE_PANEL.hint}</p>
            <TemplateGallery selected={templateId} onSelect={setTemplateId} />
          </div>

          <div className="card">
            <div className="preview-toolbar">
              <div className="row" style={{ justifyContent: "space-between" }}>
                <h2 style={{ margin: 0 }}>{PREVIEW_PANEL.title}</h2>
                <div className="row">
                  <button
                    type="button"
                    onClick={() => setZoom((z) => Math.max(PREVIEW.minZoom, +(z - PREVIEW.zoomStep).toFixed(2)))}
                  >
                    {PREVIEW_PANEL.zoomOut}
                  </button>
                  <span className="badge">{Math.round(zoom * 100)}%</span>
                  <button
                    type="button"
                    onClick={() => setZoom((z) => Math.min(PREVIEW.maxZoom, +(z + PREVIEW.zoomStep).toFixed(2)))}
                  >
                    {PREVIEW_PANEL.zoomIn}
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
                  {PREVIEW_PANEL.tabOriginal}
                </button>
                <button
                  type="button"
                  className={view === "optimized" ? "active" : ""}
                  onClick={() => setView("optimized")}
                  disabled={!optimized}
                >
                  {PREVIEW_PANEL.tabOptimized}
                </button>
                <div className="spacer" />
                <button type="button" onClick={() => handleExport("pdf")} disabled={busy !== null || !previewResume}>
                  {PREVIEW_PANEL.exportPdf}
                </button>
                <button
                  type="button"
                  className="primary"
                  onClick={() => handleExport("docx")}
                  disabled={busy !== null || !previewResume}
                >
                  {PREVIEW_PANEL.exportDocx}
                </button>
              </div>
            )}
            </div>

            {previewResume ? (
              <>
                {view === "optimized" && optimized && (
                  <p className="hint" style={{ margin: "0 0 10px" }}>
                    {PREVIEW_PANEL.editHint}{" "}
                    {rescoring && (
                      <span className="live-badge">
                        <span className="spinner" /> {PREVIEW_PANEL.rescoring}
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
                {PREVIEW_PANEL.empty}
              </p>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
