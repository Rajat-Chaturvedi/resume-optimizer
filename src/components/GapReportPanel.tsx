"use client";

import type { GapReport } from "@/lib/types";

export default function GapReportPanel({ report, title }: { report: GapReport; title: string }) {
  const order = { critical: 0, important: 1, "nice-to-have": 2 } as const;
  const byImportance = (a: { importance: keyof typeof order }, b: { importance: keyof typeof order }) =>
    order[a.importance] - order[b.importance];
  const specialized = report.missingKeywords.filter((k) => k.gapType === "specialized").sort(byImportance);
  const semantic = report.missingKeywords.filter((k) => k.gapType !== "specialized").sort(byImportance);
  const atsScore = Math.round(
    (report.atsChecks.reduce((s, c) => s + (c.status === "pass" ? 1 : c.status === "warn" ? 0.6 : 0), 0) /
      report.atsChecks.length) *
      100
  );

  return (
    <div className="card">
      <div className="row" style={{ justifyContent: "space-between" }}>
        <h2>{title}</h2>
        <span className="badge">{report.usedLlm ? "LLM + rules" : "rules engine"}</span>
      </div>
      <p className="hint">{report.summary}</p>

      <div className="scores">
        <div className="score">
          <div className="value">{report.matchScore}</div>
          <div className="label">Match score</div>
        </div>
        <div className="score">
          <div className="value">{report.keywordCoverage}%</div>
          <div className="label">Keyword coverage</div>
        </div>
        <div className="score">
          <div className="value">{atsScore}</div>
          <div className="label">ATS structure</div>
        </div>
      </div>

      {specialized.length > 0 && (
        <>
          <h3 style={{ fontSize: 14, margin: "12px 0 4px" }}>Missing specialized skills</h3>
          <p className="hint" style={{ marginBottom: 6 }}>
            Named technologies or credentials. Only you can confirm these — the optimizer will not claim them.
          </p>
          <div className="chips">
            {specialized.map((k) => (
              <span
                key={k.keyword}
                className={`chip ${k.importance}`}
                title={`${k.category} · appears ${k.jdFrequency}× in the JD`}
              >
                {k.keyword}
              </span>
            ))}
          </div>
        </>
      )}

      {semantic.length > 0 && (
        <>
          <h3 style={{ fontSize: 14, margin: "14px 0 4px" }}>Wording / terminology gaps</h3>
          <p className="hint" style={{ marginBottom: 6 }}>
            Generic engineering vocabulary. The optimizer adopts this wording wherever your bullets already
            demonstrate the capability.
          </p>
          <div className="chips">
            {semantic.map((k) => (
              <span
                key={k.keyword}
                className={`chip ${k.importance}`}
                title={`${k.category} · appears ${k.jdFrequency}× in the JD`}
              >
                {k.keyword}
              </span>
            ))}
          </div>
        </>
      )}

      {report.matchedKeywords.length > 0 && (
        <>
          <h3 style={{ fontSize: 14, margin: "14px 0 6px" }}>
            Matched keywords ({report.matchedKeywords.length})
          </h3>
          <div className="chips">
            {report.matchedKeywords.slice(0, 24).map((k) => (
              <span key={k.keyword} className="chip matched">
                {k.keyword}
              </span>
            ))}
          </div>
        </>
      )}

      {report.weakSections.length > 0 && (
        <>
          <h3 style={{ fontSize: 14, margin: "16px 0 8px" }}>Weak sections</h3>
          {report.weakSections.map((finding, i) => (
            <div key={`${finding.section}-${i}`} className={`finding ${finding.severity}`}>
              <strong>{finding.section}</strong> — {finding.issue}
              <div className="rec">Fix: {finding.recommendation}</div>
            </div>
          ))}
        </>
      )}

      <h3 style={{ fontSize: 14, margin: "16px 0 4px" }}>ATS compliance checks</h3>
      <p className="hint" style={{ marginBottom: 4 }}>
        Benchmarked against documented parsing behaviour of Workday, Taleo, Greenhouse, Lever and iCIMS.
      </p>
      {report.atsChecks.map((check) => (
        <div key={check.id} className="check">
          <span className={`status-dot ${check.status}`} />
          <div>
            <strong>{check.label}</strong>
            <div className="standard">Standard: {check.standard}</div>
            <div className="detail">{check.detail}</div>
          </div>
        </div>
      ))}
    </div>
  );
}
