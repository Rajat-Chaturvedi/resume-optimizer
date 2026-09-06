"use client";

import { useMemo, useState } from "react";
import { METRICS_WIZARD } from "@/constants/copy";
import { hasMetric } from "@/lib/keywords";
import { hasUnfilledPlaceholder, suggestMetrics } from "@/lib/metricSuggestions";
import type { StructuredResume } from "@/lib/types";

type Target = {
  key: string;
  roleIndex: number;
  bulletIndex: number;
  role: string;
  text: string;
  suggestions: string[];
};

type Props = {
  resume: StructuredResume;
  busy: boolean;
  onApply: (next: StructuredResume) => void;
};

const PAGE_SIZE = 6;

/** Joins the candidate's impact phrase onto their bullet without altering the original claim. */
function withImpact(bullet: string, impact: string): string {
  const stem = bullet.replace(/[.;,\s]+$/, "");
  const clause = impact.trim().replace(/^[,;\s]+/, "").replace(/[.;]+$/, "");
  const opener = clause.split(/\s+/)[0] ?? "";
  const connector = /ing$/i.test(opener) ? ", " : /ed$/i.test(opener) ? ", now " : ", resulting in ";
  return `${stem}${connector}${clause.charAt(0).toLowerCase()}${clause.slice(1)}`;
}

export default function MetricsWizard({ resume, busy, onApply }: Props) {
  const [open, setOpen] = useState(false);
  const [visible, setVisible] = useState(PAGE_SIZE);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [confirmed, setConfirmed] = useState(false);

  const targets = useMemo<Target[]>(
    () =>
      resume.experience.flatMap((exp, roleIndex) =>
        exp.bullets
          .map((text, bulletIndex) => ({
            key: `${roleIndex}:${bulletIndex}`,
            roleIndex,
            bulletIndex,
            role: exp.role || exp.company,
            text,
            suggestions: suggestMetrics(text),
          }))
          .filter((t) => !hasMetric(t.text))
      ),
    [resume]
  );

  if (targets.length === 0) return null;

  const start = () => {
    // Pre-fill every row with phrasing that matches that bullet and a typical
    // figure, so the user corrects numbers instead of composing sentences.
    setDrafts(Object.fromEntries(targets.map((t) => [t.key, t.suggestions[0]])));
    setConfirmed(false);
    setOpen(true);
  };

  const ready = Object.entries(drafts).filter(
    ([, value]) => value.trim().length > 0 && /\d/.test(value) && !hasUnfilledPlaceholder(value)
  );

  const apply = () => {
    const next: StructuredResume = JSON.parse(JSON.stringify(resume));
    for (const [key, value] of ready) {
      const [roleIndex, bulletIndex] = key.split(":").map(Number);
      const bullet = next.experience[roleIndex]?.bullets[bulletIndex];
      if (bullet) next.experience[roleIndex].bullets[bulletIndex] = withImpact(bullet, value);
    }
    setDrafts({});
    setConfirmed(false);
    setOpen(false);
    setVisible(PAGE_SIZE);
    onApply(next);
  };

  const pending = targets.length - ready.length;

  return (
    <div className="card">
      <h2>{METRICS_WIZARD.title(targets.length)}</h2>
      <p className="hint">{METRICS_WIZARD.hint}</p>

      {!open ? (
        <div className="row">
          <button type="button" className="primary" disabled={busy} onClick={start}>
            {METRICS_WIZARD.cta}
          </button>
          <span className="hint" style={{ margin: 0 }}>
            {METRICS_WIZARD.skipHint}
          </span>
        </div>
      ) : (
        <>
          <p className="hint">{METRICS_WIZARD.suggestionHint}</p>

          {targets.slice(0, visible).map((target) => {
            const value = drafts[target.key] ?? "";
            const blank = hasUnfilledPlaceholder(value);
            const missingNumber = value.trim().length > 0 && !blank && !/\d/.test(value);
            return (
              <div key={target.key} className="metric-row">
                <div className="metric-bullet">
                  <span className="badge">{target.role}</span> {target.text}
                </div>
                <input
                  type="text"
                  value={value}
                  placeholder={METRICS_WIZARD.placeholder}
                  onChange={(e) => setDrafts((d) => ({ ...d, [target.key]: e.target.value }))}
                />
                {target.suggestions.length > 1 && (
                  <div className="chips" style={{ marginTop: 6 }}>
                    {target.suggestions.map((suggestion) => (
                      <button
                        key={suggestion}
                        type="button"
                        className="chip"
                        onClick={() => setDrafts((d) => ({ ...d, [target.key]: suggestion }))}
                      >
                        {suggestion}
                      </button>
                    ))}
                  </div>
                )}
                {blank && <div className="metric-warning">{METRICS_WIZARD.fillBlanks}</div>}
                {missingNumber && <div className="metric-warning">{METRICS_WIZARD.needsNumber}</div>}
                {!blank && !missingNumber && value.trim() && (
                  <div className="metric-preview">
                    <span className="badge">{METRICS_WIZARD.draftTag}</span> {withImpact(target.text, value)}
                  </div>
                )}
              </div>
            );
          })}

          {visible < targets.length && (
            <button type="button" onClick={() => setVisible((v) => v + PAGE_SIZE)} style={{ marginTop: 8 }}>
              {METRICS_WIZARD.showMore(targets.length - visible)}
            </button>
          )}

          <div className="confirm-box">
            <label className="chip selectable">
              <input type="checkbox" checked={confirmed} onChange={() => setConfirmed((c) => !c)} />
              {METRICS_WIZARD.confirmLabel}
            </label>
          </div>

          <div className="row" style={{ marginTop: 12 }}>
            <button
              type="button"
              className="primary"
              disabled={busy || ready.length === 0 || !confirmed}
              onClick={apply}
            >
              {METRICS_WIZARD.apply(ready.length)}
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => {
                setDrafts({});
                setConfirmed(false);
                setOpen(false);
              }}
            >
              {METRICS_WIZARD.cancel}
            </button>
            {pending > 0 && (
              <span className="hint" style={{ margin: 0 }}>
                {METRICS_WIZARD.pending(pending)}
              </span>
            )}
          </div>
        </>
      )}
    </div>
  );
}
