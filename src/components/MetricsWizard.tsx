"use client";

import { useMemo, useState } from "react";
import { METRICS_WIZARD } from "@/constants/copy";
import { hasMetric } from "@/lib/keywords";
import type { StructuredResume } from "@/lib/types";

type Target = { roleIndex: number; bulletIndex: number; role: string; text: string };

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
  const connector = /^(improv|reduc|cutt|increas|boost|sav|deliver|driv|grow|scal)\w*ing\b/i.test(clause)
    ? ", "
    : ", resulting in ";
  return `${stem}${connector}${clause.charAt(0).toLowerCase()}${clause.slice(1)}`;
}

export default function MetricsWizard({ resume, busy, onApply }: Props) {
  const [open, setOpen] = useState(false);
  const [visible, setVisible] = useState(PAGE_SIZE);
  const [drafts, setDrafts] = useState<Record<string, string>>({});

  const targets = useMemo<Target[]>(
    () =>
      resume.experience.flatMap((exp, roleIndex) =>
        exp.bullets
          .map((text, bulletIndex) => ({ roleIndex, bulletIndex, role: exp.role || exp.company, text }))
          .filter((t) => !hasMetric(t.text))
      ),
    [resume]
  );

  if (targets.length === 0) return null;

  const filled = Object.entries(drafts).filter(([, value]) => value.trim().length > 0);
  const withNumbers = filled.filter(([, value]) => /\d/.test(value));

  const apply = () => {
    const next: StructuredResume = JSON.parse(JSON.stringify(resume));
    for (const [key, value] of withNumbers) {
      const [roleIndex, bulletIndex] = key.split(":").map(Number);
      const bullet = next.experience[roleIndex]?.bullets[bulletIndex];
      if (bullet) next.experience[roleIndex].bullets[bulletIndex] = withImpact(bullet, value);
    }
    setDrafts({});
    setOpen(false);
    setVisible(PAGE_SIZE);
    onApply(next);
  };

  return (
    <div className="card">
      <h2>{METRICS_WIZARD.title(targets.length)}</h2>
      <p className="hint">{METRICS_WIZARD.hint}</p>

      {!open ? (
        <div className="row">
          <button type="button" className="primary" disabled={busy} onClick={() => setOpen(true)}>
            {METRICS_WIZARD.cta}
          </button>
          <span className="hint" style={{ margin: 0 }}>
            {METRICS_WIZARD.skipHint}
          </span>
        </div>
      ) : (
        <>
          {targets.slice(0, visible).map((target) => {
            const key = `${target.roleIndex}:${target.bulletIndex}`;
            const value = drafts[key] ?? "";
            const invalid = value.trim().length > 0 && !/\d/.test(value);
            return (
              <div key={key} className="metric-row">
                <div className="metric-bullet">
                  <span className="badge">{target.role}</span> {target.text}
                </div>
                <input
                  type="text"
                  value={value}
                  placeholder={METRICS_WIZARD.placeholder}
                  onChange={(e) => setDrafts((d) => ({ ...d, [key]: e.target.value }))}
                />
                {invalid && <div className="metric-warning">{METRICS_WIZARD.needsNumber}</div>}
                {value.trim() && !invalid && <div className="metric-preview">{withImpact(target.text, value)}</div>}
              </div>
            );
          })}

          {visible < targets.length && (
            <button type="button" onClick={() => setVisible((v) => v + PAGE_SIZE)} style={{ marginTop: 8 }}>
              {METRICS_WIZARD.showMore(targets.length - visible)}
            </button>
          )}

          <div className="row" style={{ marginTop: 12 }}>
            <button type="button" className="primary" disabled={busy || withNumbers.length === 0} onClick={apply}>
              {METRICS_WIZARD.apply(withNumbers.length)}
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => {
                setDrafts({});
                setOpen(false);
              }}
            >
              {METRICS_WIZARD.cancel}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
