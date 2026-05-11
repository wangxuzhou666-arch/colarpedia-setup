"use client";

// Inline editor for a single entity (shipped/education/experience),
// invoked from the preview's audit drawer. Renders the same field set
// the user would otherwise scroll to find in the main SetupForm, but
// inline — so the user can iterate "preview → edit → preview" without
// leaving the modal.
//
// Pattern matches GapFillDialog: receives entity + onApply(idx, patch).
// Parent's onApplyPolish writes the patch back into react-hook-form
// state via setValue() on `${section}.${idx}.${field}`, then rebuilds
// previewData — preview re-renders automatically.

import { useState } from "react";

// Field config per entity kind. Order = display order in the dialog.
// `bilingual: true` renders en/zh side-by-side; `wide` = full-width textarea.
const FIELD_CONFIG = {
  shipped: [
    { key: "name", label: "项目名（英）", bilingualKey: "name_zh", bilingualLabel: "项目名（中）" },
    { key: "slug", label: "Slug", readOnly: true, hint: "URL 标识，改了会断 wikilink" },
    { key: "description", label: "一句话描述（英）", bilingualKey: "description_zh", bilingualLabel: "一句话描述（中）" },
    { key: "role", label: "角色（英）", bilingualKey: "role_zh", bilingualLabel: "角色（中）" },
    { key: "date_range", label: "时间" },
    { key: "url", label: "链接" },
    { key: "tech_stack_text", label: "技术栈（逗号分隔）", hint: "如：Swift, GPT-4o, RAG" },
    { key: "body", label: "正文（英）", textarea: true, rows: 10, bilingualKey: "body_zh", bilingualLabel: "正文（中）", bilingualTextarea: true },
  ],
  educations: [
    { key: "name", label: "学校（英）", bilingualKey: "name_zh", bilingualLabel: "学校（中）" },
    { key: "slug", label: "Slug", readOnly: true, hint: "URL 标识，改了会断 wikilink" },
    { key: "degree", label: "学位（英）", bilingualKey: "degree_zh", bilingualLabel: "学位（中）" },
    { key: "date_range", label: "时间" },
    { key: "location", label: "地点" },
    { key: "body", label: "正文（英）", textarea: true, rows: 10, bilingualKey: "body_zh", bilingualLabel: "正文（中）", bilingualTextarea: true },
  ],
  experiences: [
    { key: "name", label: "雇主（英）", bilingualKey: "name_zh", bilingualLabel: "雇主（中）" },
    { key: "slug", label: "Slug", readOnly: true, hint: "URL 标识，改了会断 wikilink" },
    { key: "role", label: "职位（英）", bilingualKey: "role_zh", bilingualLabel: "职位（中）" },
    { key: "date_range", label: "时间" },
    { key: "location", label: "地点" },
    { key: "body", label: "正文（英）", textarea: true, rows: 10, bilingualKey: "body_zh", bilingualLabel: "正文（中）", bilingualTextarea: true },
  ],
};

const SECTION_LABEL = {
  shipped: "项目",
  educations: "教育经历",
  experiences: "工作经历",
};

export default function EntityInlineEditor({
  entityType,
  entityIdx,
  entity,
  onApply,
  onClose,
}) {
  // Convert tech_stack array → comma-separated text for editing,
  // converted back on save.
  const initialDraft = {
    ...entity,
    tech_stack_text: Array.isArray(entity.tech_stack)
      ? entity.tech_stack.join(", ")
      : "",
  };
  const [draft, setDraft] = useState(initialDraft);

  const fields = FIELD_CONFIG[entityType] || [];

  const setField = (key, value) => {
    setDraft((d) => ({ ...d, [key]: value }));
  };

  const handleSave = () => {
    // Build patch — only include fields the form config lists, and
    // convert tech_stack_text back to array.
    const patch = {};
    for (const f of fields) {
      if (f.readOnly) continue;
      if (f.key === "tech_stack_text") {
        patch.tech_stack = String(draft.tech_stack_text || "")
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean);
        continue;
      }
      patch[f.key] = draft[f.key] ?? "";
      if (f.bilingualKey) {
        patch[f.bilingualKey] = draft[f.bilingualKey] ?? "";
      }
    }
    onApply(entityIdx, patch);
    onClose();
  };

  const title = `编辑${SECTION_LABEL[entityType] || ""}：${entity.name || ""}`;

  return (
    <div className="gapfill-overlay" onClick={onClose}>
      <div
        className="gapfill-modal"
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: 920 }}
      >
        <div className="gapfill-header">
          <h3>{title}</h3>
          <button
            type="button"
            className="gapfill-close"
            onClick={onClose}
            aria-label="关闭"
          >
            ×
          </button>
        </div>

        <div className="entity-editor-body">
          <p className="setup-help" style={{ marginTop: 0, marginBottom: 12 }}>
            手动改 AI 生成的内容。改完点保存，预览会立刻刷新；想用 PDF
            自动补全请关掉这里改用「PDF 补充」入口。
          </p>

          {fields.map((f) => {
            if (f.readOnly) {
              return (
                <div key={f.key} className="setup-field">
                  <label className="setup-label">{f.label}</label>
                  <input
                    type="text"
                    value={draft[f.key] ?? ""}
                    readOnly
                    className="setup-input"
                    style={{ background: "var(--wiki-bg-alt)", color: "var(--wiki-text-soft)" }}
                  />
                  {f.hint && <div className="setup-help">{f.hint}</div>}
                </div>
              );
            }

            if (f.bilingualKey) {
              const Wrapper = f.textarea ? "textarea" : "input";
              const wrapperProps = f.textarea
                ? { rows: f.rows || 6 }
                : { type: "text" };
              const zhProps = f.bilingualTextarea
                ? { rows: f.rows || 6 }
                : { type: "text" };
              const ZhWrapper = f.bilingualTextarea ? "textarea" : "input";
              return (
                <div key={f.key} className="setup-bilingual-grid">
                  <div className="setup-field">
                    <label className="setup-label">{f.label}</label>
                    <Wrapper
                      {...wrapperProps}
                      value={draft[f.key] ?? ""}
                      onChange={(e) => setField(f.key, e.target.value)}
                      className={f.textarea ? "setup-textarea" : "setup-input"}
                    />
                    {f.hint && <div className="setup-help">{f.hint}</div>}
                  </div>
                  <div className="setup-field">
                    <label className="setup-label">{f.bilingualLabel}</label>
                    <ZhWrapper
                      {...zhProps}
                      value={draft[f.bilingualKey] ?? ""}
                      onChange={(e) => setField(f.bilingualKey, e.target.value)}
                      className={f.bilingualTextarea ? "setup-textarea" : "setup-input"}
                    />
                  </div>
                </div>
              );
            }

            const SingleWrapper = f.textarea ? "textarea" : "input";
            const singleProps = f.textarea
              ? { rows: f.rows || 6 }
              : { type: "text" };
            return (
              <div key={f.key} className="setup-field">
                <label className="setup-label">{f.label}</label>
                <SingleWrapper
                  {...singleProps}
                  value={draft[f.key] ?? ""}
                  onChange={(e) => setField(f.key, e.target.value)}
                  className={f.textarea ? "setup-textarea" : "setup-input"}
                />
                {f.hint && <div className="setup-help">{f.hint}</div>}
              </div>
            );
          })}
        </div>

        <div className="entity-editor-footer">
          <button type="button" onClick={onClose} className="setup-button-secondary">
            取消
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="setup-button-primary"
          >
            保存并刷新预览
          </button>
        </div>
      </div>
    </div>
  );
}
