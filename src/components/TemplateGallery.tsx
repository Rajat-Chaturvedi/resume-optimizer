"use client";

import { TEMPLATES, type TemplateId } from "@/lib/templates";

type Props = {
  selected: TemplateId;
  onSelect: (id: TemplateId) => void;
};

export default function TemplateGallery({ selected, onSelect }: Props) {
  return (
    <div className="template-grid">
      {TEMPLATES.map((template) => (
        <button
          key={template.id}
          type="button"
          className={`template-card${template.id === selected ? " active" : ""}`}
          onClick={() => onSelect(template.id)}
          aria-pressed={template.id === selected}
        >
          <div className={`thumb${template.headerAlign === "center" ? " center" : ""}`}>
            <div className="bar title" />
            <div className="bar" style={{ width: "88%" }} />
            <div className="bar" style={{ width: "70%" }} />
            <div className="bar" style={{ width: "80%" }} />
          </div>
          <div className="name">{template.name}</div>
          <div className="origin">{template.origin}</div>
          <div className="desc">{template.description}</div>
        </button>
      ))}
    </div>
  );
}
