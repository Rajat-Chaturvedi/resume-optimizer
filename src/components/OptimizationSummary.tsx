"use client";

import { useState } from "react";
import type { GapReport, OptimizeResult } from "@/lib/types";

function atsScore(report: GapReport): number {
  const total = report.atsChecks.reduce(
    (sum, c) => sum + (c.status === "pass" ? 1 : c.status === "warn" ? 0.6 : 0),
    0
  );
  return Math.round((total / report.atsChecks.length) * 100);
}

function Delta({ diff, improved }: { diff: number; improved: boolean }) {
  if (diff === 0) return <span className="delta flat">no change</span>;
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
};

export default function OptimizationSummary({ before, result, busy, onConfirmSkills }: Props) {
  const after = result.verification;
  const [selected, setSelected] = useState<string[]>(result.confirmedSkills ?? []);

  const toggle = (skill: string) =>
    setSelected((current) =>
      current.includes(skill) ? current.filter((s) => s !== skill) : [...current, skill]
    );

  const rows = [
    { label: "Match score", before: before.matchScore, after: after.matchScore },
    { label: "Keyword coverage", before: before.keywordCoverage, after: after.keywordCoverage, unit: "%" },
    { label: "ATS structure", before: atsScore(before), after: atsScore(after) },
    {
      label: "Bullets without metrics",
      before: countBulletIssue(before, "quantified"),
      after: countBulletIssue(after, "quantified"),
      lowerIsBetter: true,
    },
    {
      label: "Passive / weak openers",
      before: countBulletIssue(before, "passive"),
      after: countBulletIssue(after, "passive"),
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
        <h2>What the optimizer changed</h2>
        <span className="badge">{result.usedLlm ? "LLM rewrite" : "rules engine (no LLM key)"}</span>
      </div>

      <table className="compare">
        <thead>
          <tr>
            <th>Metric</th>
            <th>Before</th>
            <th>After</th>
            <th>Δ</th>
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
          <h3 style={{ fontSize: 14, margin: "14px 0 6px" }}>Edits applied</h3>
          <ul className="changelog">
            {result.changeLog.map((entry, i) => (
              <li key={i}>{entry}</li>
            ))}
          </ul>
        </>
      )}

      {newlyMatched.length > 0 && (
        <>
          <h3 style={{ fontSize: 14, margin: "14px 0 6px" }}>Keywords now matching the JD</h3>
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
          <h3 style={{ fontSize: 14, margin: "14px 0 6px" }}>ATS checks fixed</h3>
          <ul className="changelog">
            {fixedChecks.map((c) => (
              <li key={c.id}>{c.label}</li>
            ))}
          </ul>
        </>
      )}

      {result.closedSemanticGaps.length > 0 && (
        <>
          <h3 style={{ fontSize: 14, margin: "14px 0 6px" }}>Wording gaps closed automatically</h3>
          <p className="hint" style={{ marginBottom: 8 }}>
            Your bullets already evidenced these capabilities; the resume now uses the job description&apos;s
            terminology for them.
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
          <h3 style={{ fontSize: 14, margin: "14px 0 6px" }}>Skills you confirmed</h3>
          <div className="chips">
            {result.confirmedSkills.map((s) => (
              <span key={s} className="chip matched">
                {s}
              </span>
            ))}
          </div>
        </>
      )}

      {specializedGaps.length > 0 && (
        <>
          <h3 style={{ fontSize: 14, margin: "16px 0 6px" }}>
            Have experience with any of these skills? Add them to your resume
          </h3>
          <p className="hint" style={{ marginBottom: 8 }}>
            These are specialized technologies the job description asks for that appear nowhere in your resume.
            The optimizer will never claim them on your behalf. Tick the ones you genuinely have exposure to and
            re-run — they will be added to your Skills section and worked into the rewrite.
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
              I have experience with these — optimize my resume
            </button>
            {selected.length > 0 && (
              <button type="button" onClick={() => setSelected([])} disabled={busy}>
                Clear selection
              </button>
            )}
          </div>
        </>
      )}

      {!result.usedLlm && (
        <p className="hint" style={{ marginTop: 14, marginBottom: 0 }}>
          Running without an LLM key limits rewriting to structural and phrasing fixes. Set{" "}
          <code>OPENAI_API_KEY</code> in <code>.env.local</code> to enable full JD-targeted rewriting of summary
          and bullets.
        </p>
      )}
    </div>
  );
}

function countBulletIssue(report: GapReport, kind: "quantified" | "passive"): number {
  const finding = report.weakSections.find(
    (f) =>
      f.section === "Experience" &&
      (kind === "quantified" ? f.issue.includes("no quantified") : f.issue.includes("passive phrasing"))
  );
  return finding ? Number(finding.issue.match(/\d+/)?.[0] ?? 0) : 0;
}
