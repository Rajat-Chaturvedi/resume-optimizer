"use client";

import type { CSSProperties } from "react";
import type { TemplateSpec } from "@/lib/templates";
import type { StructuredResume } from "@/lib/types";

type Props = {
  resume: StructuredResume;
  spec: TemplateSpec;
  onEdit?: (next: StructuredResume) => void;
  zoom: number;
};

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

export default function ResumePreview({ resume, spec, onEdit, zoom }: Props) {
  const editable = Boolean(onEdit);

  const pageStyle: CSSProperties = {
    fontFamily: spec.cssFont,
    fontSize: `${spec.bodySize}pt`,
    lineHeight: spec.lineHeight,
    color: spec.accent,
    padding: `${spec.marginInches}in`,
    transform: `scale(${zoom})`,
  };

  const headingStyle: CSSProperties = {
    fontSize: `${spec.headingSize}pt`,
    textTransform: spec.headingCase === "upper" ? "uppercase" : "none",
  };

  const headerAlign: CSSProperties = { textAlign: spec.headerAlign };

  const commit = (mutate: (draft: StructuredResume) => void) => {
    if (!onEdit) return;
    const draft = clone(resume);
    mutate(draft);
    onEdit(draft);
  };

  const editableProps = (apply: (text: string) => void) =>
    editable
      ? {
          className: "editable",
          contentEditable: true,
          suppressContentEditableWarning: true,
          onBlur: (e: React.FocusEvent<HTMLElement>) => apply(e.currentTarget.textContent ?? ""),
        }
      : {};

  const Heading = ({ label }: { label: string }) => (
    <>
      <div className="section-heading" style={headingStyle}>
        {label}
      </div>
      {spec.ruleUnderHeadings && <div className="rule" />}
    </>
  );

  return (
    <div className="page" style={pageStyle}>
      <div style={headerAlign}>
        <div
          className="name"
          style={{ fontSize: `${spec.nameSize}pt`, lineHeight: 1.15 }}
          {...editableProps((text) => commit((d) => (d.contact.name = text)))}
        >
          {resume.contact.name}
        </div>
        {resume.contact.title && (
          <div {...editableProps((text) => commit((d) => (d.contact.title = text)))}>
            {resume.contact.title}
          </div>
        )}
        <div className="contact">
          {[resume.contact.email, resume.contact.phone, resume.contact.location, ...resume.contact.links]
            .filter(Boolean)
            .join("  |  ")}
        </div>
      </div>

      {resume.summary && (
        <section>
          <Heading label="Summary" />
          <p {...editableProps((text) => commit((d) => (d.summary = text)))}>{resume.summary}</p>
        </section>
      )}

      {resume.skills.length > 0 && (
        <section>
          <Heading label="Skills" />
          {resume.skills.map((group, gi) => (
            <p key={`${group.category}-${gi}`}>
              <strong>{group.category}: </strong>
              <span
                {...editableProps((text) =>
                  commit((d) => {
                    d.skills[gi].skills = text.split(",").map((s) => s.trim()).filter(Boolean);
                  })
                )}
              >
                {group.skills.join(", ")}
              </span>
            </p>
          ))}
        </section>
      )}

      {resume.experience.length > 0 && (
        <section>
          <Heading label="Experience" />
          {resume.experience.map((exp, ei) => (
            <div key={`${exp.company}-${ei}`} style={{ marginBottom: "0.5em" }}>
              <div className="role-line">
                <span {...editableProps((text) => commit((d) => (d.experience[ei].role = text)))}>
                  {exp.role}
                </span>
                <span>{[exp.startDate, exp.endDate].filter(Boolean).join(" – ")}</span>
              </div>
              {(exp.company || exp.location) && (
                <div className="company-line">
                  {[exp.company, exp.location].filter(Boolean).join(", ")}
                </div>
              )}
              <ul>
                {exp.bullets.map((bullet, bi) => (
                  <li
                    key={bi}
                    {...editableProps((text) =>
                      commit((d) => {
                        d.experience[ei].bullets[bi] = text;
                      })
                    )}
                  >
                    {bullet}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </section>
      )}

      {resume.projects.length > 0 && (
        <section>
          <Heading label="Projects" />
          {resume.projects.map((project, pi) => (
            <div key={`${project.name}-${pi}`} style={{ marginBottom: "0.4em" }}>
              <strong>{project.name}</strong>
              {project.description && <span> — {project.description}</span>}
              <ul>
                {project.bullets.map((bullet, bi) => (
                  <li
                    key={bi}
                    {...editableProps((text) =>
                      commit((d) => {
                        d.projects[pi].bullets[bi] = text;
                      })
                    )}
                  >
                    {bullet}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </section>
      )}

      {resume.education.length > 0 && (
        <section>
          <Heading label="Education" />
          {resume.education.map((edu, ei) => (
            <div key={`${edu.institution}-${ei}`} style={{ marginBottom: "0.35em" }}>
              <div className="role-line">
                <span>{edu.institution || edu.degree}</span>
                <span>{edu.graduation}</span>
              </div>
              {edu.institution && edu.degree && <div className="company-line">{edu.degree}</div>}
              {edu.details.length > 0 && (
                <ul>
                  {edu.details.map((detail, di) => (
                    <li key={di}>{detail}</li>
                  ))}
                </ul>
              )}
            </div>
          ))}
        </section>
      )}

      {resume.certifications.length > 0 && (
        <section>
          <Heading label="Certifications" />
          <ul>
            {resume.certifications.map((cert, ci) => (
              <li key={ci}>{cert}</li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
