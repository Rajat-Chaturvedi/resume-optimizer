"use client";

import { useState } from "react";
import { OPTIMIZER_PANEL } from "@/constants/copy";
import type { GapReport, LengthMode, OptimizeResult } from "@/lib/types";

function atsScore(report: GapReport): number {
  const total = report.atsChecks.reduce(
    (sum, c) => sum + (c.status === "pass" ? 1 : c.status === "warn" ? 0.6 : 0),
    0
  );
  return Math.round((total / report.atsChecks.length) * 100);
}

function Delta({ diff, improved }: { diff: number; improved: boolean }) {
  if (diff === 0) return <span className="delta flat">{OPTIMIZER_PANEL.noChange}</span>;
  return (
    <span className={`delta ${improved ? "up" : "down"}`}>
      {diff > 0 ? `+${diff}` : diff}
    </span>
  );
}

type Props = {
  before: GapReport;
  result: OptimizeResult & { verification: GapReport };
  busy: boolean;
  onConfirmSkills: (skills: string[]) => void;
  onLengthChange: (mode: LengthMode) => void;
};

export default function OptimizationSummary({ before, result, busy, onConfirmSkills, onLengthChange }: Props) {
  const after = result.verification;
  const [selected, setSelected] = useState<string[]>(result.confirmedSkills ?? []);

  const toggle = (skill: string) =>
    setSelected((current) =>
      current.includes(skill) ? current.filter((s) => s !== skill) : [...current, skill]
    );

  const rows = [
    { label: OPTIMIZER_PANEL.rowMatch, before: before.matchScore, after: after.matchScore },
    { label: OPTIMIZER_PANEL.rowCoverage, before: before.keywordCoverage, after: after.keywordCoverage, unit: "%" },
    { label: OPTIMIZER_PANEL.rowAts, before: atsScore(before), after: atsScore(after) },
    {
      label: OPTIMIZER_PANEL.rowNoMetrics,
      before: before.bulletStats.withoutMetric,
      after: after.bulletStats.withoutMetric,
      lowerIsBetter: true,
    },
    {
      label: OPTIMIZER_PANEL.rowPassive,
      before: before.bulletStats.passiveOpeners,
      after: after.bulletStats.passiveOpeners,
      lowerIsBetter: true,
    },
  ];

  const newlyMatched = after.matchedKeywords
    .filter((k) => !before.matchedKeywords.some((b) => b.keyword === k.keyword))
    .map((k) => k.keyword);

  const fixedChecks = after.atsChecks.filter((c) => {
    const previous = before.atsChecks.find((b) => b.id === c.id);
    return previous && previous.status !== "pass" && c.status === "pass";
  });

  // Named technologies and credentials: inventing them would be resume fraud, so they
  // only enter the resume once the user confirms genuine exposure.
  const specializedGaps = after.missingKeywords.filter(
    (k) => k.gapType === "specialized" && !result.confirmedSkills.includes(k.keyword)
  );

  return (
    <div className="card">
      <div className="row" style={{ justifyContent: "space-between" }}>
        <h2>{OPTIMIZER_PANEL.title}</h2>
        <span className="badge">{result.usedLlm ? OPTIMIZER_PANEL.llmBadge : OPTIMIZER_PANEL.rulesBadge}</span>
      </div>

      <table className="compare">
        <thead>
          <tr>
            <th>{OPTIMIZER_PANEL.metric}</th>
            <th>{OPTIMIZER_PANEL.before}</th>
            <th>{OPTIMIZER_PANEL.after}</th>
            <th>{OPTIMIZER_PANEL.delta}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const diff = row.after - row.before;
            return (
              <tr key={row.label}>
                <td>{row.label}</td>
                <td>
                  {row.before}
                  {row.unit ?? ""}
                </td>
                <td>
                  {row.after}
                  {row.unit ?? ""}
                </td>
                <td>
                  <Delta diff={diff} improved={row.lowerIsBetter ? diff < 0 : diff > 0} />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {result.changeLog.length > 0 && (
        <>
          <h3 style={{ fontSize: 14, margin: "14px 0 6px" }}>{OPTIMIZER_PANEL.editsTitle}</h3>          <ul className="changelog">
            {result.changeLog.map((entry, i) => (
              <li key={i}>{entry}</li>
            ))}
          </ul>
        </>
      )}

      {newlyMatched.length > 0 && (
        <>
          <h3 style={{ fontSize: 14, margin: "14px 0 6px" }}>{OPTIMIZER_PANEL.newlyMatchedTitle}</h3>
          <div className="chips">
            {newlyMatched.map((k) => (
              <span key={k} className="chip matched">
                {k}
              </span>
            ))}
          </div>
        </>
      )}

      {fixedChecks.length > 0 && (
        <>
          <h3 style={{ fontSize: 14, margin: "14px 0 6px" }}>{OPTIMIZER_PANEL.checksFixedTitle}</h3>
          <ul className="changelog">
            {fixedChecks.map((c) => (
              <li key={c.id}>{c.label}</li>
            ))}
          </ul>
        </>
      )}

      {result.closedSemanticGaps.length > 0 && (
        <>
          <h3 style={{ fontSize: 14, margin: "14px 0 6px" }}>{OPTIMIZER_PANEL.closedTitle}</h3>
          <p className="hint" style={{ marginBottom: 8 }}>
            {OPTIMIZER_PANEL.closedHint}
          </p>
          <ul className="changelog">
            {result.closedSemanticGaps.map((c) => (
              <li key={`${c.keyword}-${c.label}`}>
                <code>{c.keyword}</code> → {c.label}
              </li>
            ))}
          </ul>
        </>
      )}

      {result.confirmedSkills.length > 0 && (
        <>
          <h3 style={{ fontSize: 14, margin: "14px 0 6px" }}>{OPTIMIZER_PANEL.confirmedTitle}</h3>
          <div className="chips">
            {result.confirmedSkills.map((s) => (
              <span key={s} className="chip matched">
                {s}
              </span>
            ))}
          </div>
        </>
      )}

      <h3 style={{ fontSize: 14, margin: "16px 0 4px" }}>{OPTIMIZER_PANEL.lengthTitle}</h3>
      <p className="hint" style={{ marginBottom: 8 }}>
        {OPTIMIZER_PANEL.lengthHint}
      </p>
      <div className="row">
        <button
          type="button"
          className={result.lengthMode === "as-is" ? "primary" : ""}
          disabled={busy}
          onClick={() => onLengthChange("as-is")}
        >
          {OPTIMIZER_PANEL.lengthAsIs}
        </button>
        <button
          type="button"
          className={result.lengthMode === "condense" ? "primary" : ""}
          disabled={busy}
          onClick={() => onLengthChange("condense")}
        >
          {OPTIMIZER_PANEL.lengthCondense}
        </button>
        {result.trimmedBullets > 0 && (
          <span className="badge">{OPTIMIZER_PANEL.trimmedNote(result.trimmedBullets)}</span>
        )}
      </div>

      {specializedGaps.length > 0 && (
        <>
          <h3 style={{ fontSize: 14, margin: "16px 0 6px" }}>{OPTIMIZER_PANEL.confirmCtaTitle}</h3>
          <p className="hint" style={{ marginBottom: 8 }}>
            {OPTIMIZER_PANEL.confirmCtaHint}
          </p>
          <div className="chips">
            {specializedGaps.map((k) => (
              <label key={k.keyword} className={`chip selectable${selected.includes(k.keyword) ? " selected" : ""}`}>
                <input
                  type="checkbox"
                  checked={selected.includes(k.keyword)}
                  onChange={() => toggle(k.keyword)}
                />
                {k.keyword}
              </label>
            ))}
          </div>
          <div className="row" style={{ marginTop: 12 }}>
            <button
              type="button"
              className="primary"
              disabled={busy || selected.length === 0}
              onClick={() => onConfirmSkills(selected)}
            >
              {busy && <span className="spinner" />}
              {OPTIMIZER_PANEL.confirmCta}
            </button>
            {selected.length > 0 && (
              <button type="button" onClick={() => setSelected([])} disabled={busy}>
                {OPTIMIZER_PANEL.clearSelection}
              </button>
            )}
          </div>
        </>
      )}

      {!result.usedLlm && (
        <p className="hint" style={{ marginTop: 14, marginBottom: 0 }}>
          {OPTIMIZER_PANEL.noLlmHint} <code>OPENAI_API_KEY</code> in <code>.env.local</code>{" "}
          {OPTIMIZER_PANEL.noLlmHintTail}
        </p>
      )}
    </div>
  );
}
