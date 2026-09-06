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
    // zoom (unlike transform) reflows, so the page keeps its real layout height.
    zoom,
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

  const field = (apply: (text: string) => void) =>
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
          {...field((text) => commit((d) => (d.contact.name = text)))}
        >
          {resume.contact.name}
        </div>
        {resume.contact.title && (
          <div {...field((text) => commit((d) => (d.contact.title = text)))}>
            {resume.contact.title}
          </div>
        )}
        <div
          className="contact"
          {...field((text) =>
            commit((d) => {
              const parts = text.split("|").map((p) => p.trim()).filter(Boolean);
              d.contact.email = parts.find((p) => p.includes("@"));
              d.contact.phone = parts.find((p) => !p.includes("@") && /\d{5}/.test(p));
              d.contact.links = parts.filter((p) => /\.[a-z]{2,}\//i.test(p));
              d.contact.location = parts.find(
                (p) => p !== d.contact.email && p !== d.contact.phone && !d.contact.links.includes(p)
              );
            })
          )}
        >
          {[resume.contact.email, resume.contact.phone, resume.contact.location, ...resume.contact.links]
            .filter(Boolean)
            .join("  |  ")}
        </div>
      </div>

      {resume.summary && (
        <section>
          <Heading label="Summary" />
          <p {...field((text) => commit((d) => (d.summary = text)))}>{resume.summary}</p>
        </section>
      )}

      {resume.skills.length > 0 && (
        <section>
          <Heading label="Skills" />
          {resume.skills.map((group, gi) => (
            <p key={`${group.category}-${gi}`}>
              <strong {...field((text) => commit((d) => (d.skills[gi].category = text.replace(/:$/, ""))))}>
                {group.category}
              </strong>
              {": "}
              <span
                {...field((text) =>
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
                <span {...field((text) => commit((d) => (d.experience[ei].role = text)))}>{exp.role}</span>
                <span
                  {...field((text) =>
                    commit((d) => {
                      const [start, end] = text.split(/\s*[–—-]\s*/);
                      d.experience[ei].startDate = start?.trim();
                      d.experience[ei].endDate = end?.trim();
                    })
                  )}
                >
                  {[exp.startDate, exp.endDate].filter(Boolean).join(" – ")}
                </span>
              </div>
              {(exp.company || exp.location) && (
                <div
                  className="company-line"
                  {...field((text) =>
                    commit((d) => {
                      const [company, ...rest] = text.split(",");
                      d.experience[ei].company = company.trim();
                      d.experience[ei].location = rest.join(",").trim() || undefined;
                    })
                  )}
                >
                  {[exp.company, exp.location].filter(Boolean).join(", ")}
                </div>
              )}
              <ul>
                {exp.bullets.map((bullet, bi) => (
                  <li
                    key={bi}
                    {...field((text) =>
                      commit((d) => {
                        if (text.trim()) d.experience[ei].bullets[bi] = text;
                        else d.experience[ei].bullets.splice(bi, 1);
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
              <strong {...field((text) => commit((d) => (d.projects[pi].name = text)))}>{project.name}</strong>
              {project.description && (
                <span>
                  {" — "}
                  <span {...field((text) => commit((d) => (d.projects[pi].description = text)))}>
                    {project.description}
                  </span>
                </span>
              )}
              <ul>
                {project.bullets.map((bullet, bi) => (
                  <li
                    key={bi}
                    {...field((text) =>
                      commit((d) => {
                        if (text.trim()) d.projects[pi].bullets[bi] = text;
                        else d.projects[pi].bullets.splice(bi, 1);
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
                <span {...field((text) => commit((d) => (d.education[ei].institution = text)))}>
                  {edu.institution || edu.degree}
                </span>
                <span {...field((text) => commit((d) => (d.education[ei].graduation = text)))}>
                  {edu.graduation}
                </span>
              </div>
              {edu.institution && edu.degree && (
                <div
                  className="company-line"
                  {...field((text) => commit((d) => (d.education[ei].degree = text)))}
                >
                  {edu.degree}
                </div>
              )}
              {edu.details.length > 0 && (
                <ul>
                  {edu.details.map((detail, di) => (
                    <li
                      key={di}
                      {...field((text) =>
                        commit((d) => {
                          if (text.trim()) d.education[ei].details[di] = text;
                          else d.education[ei].details.splice(di, 1);
                        })
                      )}
                    >
                      {detail}
                    </li>
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
              <li
                key={ci}
                {...field((text) =>
                  commit((d) => {
                    if (text.trim()) d.certifications[ci] = text;
                    else d.certifications.splice(ci, 1);
                  })
                )}
              >
                {cert}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
