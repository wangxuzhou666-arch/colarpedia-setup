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
import WikiTextarea from "./WikiTextarea";

// Field config per entity kind. Order = display order in the dialog.
// `bilingual: true` renders en/zh side-by-side; `wide` = full-width textarea.
// 注意：logo / logo_caption / logo_caption_zh 不在 FIELD_CONFIG 里 —
// logo 走顶部独立 UI block（上传 + URL 粘贴），patch 时单独拼进去。
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

const LOGO_PLACEHOLDER_LABEL = {
  shipped: "项目 Logo / 截图",
  educations: "校徽",
  experiences: "公司 Logo",
};

const LOGO_MIME_BY_EXT = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
};

const LOGO_MAX_BYTES = 3 * 1024 * 1024;

function extFromFile(file) {
  if (!file) return null;
  const byType = {
    "image/jpeg": "jpg",
    "image/jpg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
  }[file.type];
  if (byType) return byType;
  const dot = file.name.lastIndexOf(".");
  if (dot < 0) return null;
  const tail = file.name.slice(dot + 1).toLowerCase();
  return /^(jpg|jpeg|png|webp)$/.test(tail) ? (tail === "jpeg" ? "jpg" : tail) : null;
}

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result || "");
      const comma = result.indexOf(",");
      resolve(comma >= 0 ? result.slice(comma + 1) : result);
    };
    reader.onerror = () => reject(new Error("图片读取失败"));
    reader.readAsDataURL(file);
  });
}

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
  const [logoUploading, setLogoUploading] = useState(false);
  const [logoError, setLogoError] = useState("");

  const fields = FIELD_CONFIG[entityType] || [];

  const setField = (key, value) => {
    setDraft((d) => ({ ...d, [key]: value }));
  };

  const handleLogoFile = async (file) => {
    setLogoError("");
    if (!file) return;
    const ext = extFromFile(file);
    if (!ext) {
      setLogoError("仅支持 jpg / png / webp");
      return;
    }
    if (file.size > LOGO_MAX_BYTES) {
      setLogoError("图片超过 3 MB，请压缩后再上传");
      return;
    }
    setLogoUploading(true);
    try {
      const base64 = await fileToBase64(file);
      const res = await fetch("/api/upload-entity-logo", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          base64,
          ext,
          section: entityType,
          slug: draft.slug || draft.name || "entity",
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setLogoError(json?.error || `上传失败（${res.status}）`);
        return;
      }
      setField("logo", json.url);
    } catch (e) {
      setLogoError(e?.message || "上传失败");
    } finally {
      setLogoUploading(false);
    }
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
    // Logo 走独立 UI，单独塞 patch。空字符串 = 显式清除（SiteShell 的
    // `{logo && (...)}` 守卫会把空字符串当 falsy 不渲染）。
    patch.logo = draft.logo || "";
    patch.logo_caption = draft.logo_caption || "";
    patch.logo_caption_zh = draft.logo_caption_zh || "";
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

          {/* Logo / 图片 block — 顶部独立区域，区别于普通字段 */}
          <div
            className="setup-field"
            style={{
              border: "1px solid var(--wiki-border, #c8ccd1)",
              borderRadius: 4,
              padding: 12,
              marginBottom: 16,
              background: "var(--wiki-bg-alt, #f8f9fa)",
            }}
          >
            <label className="setup-label" style={{ fontWeight: 600 }}>
              {LOGO_PLACEHOLDER_LABEL[entityType] || "图片"}（选填，显示在右侧资料卡顶部）
            </label>

            {draft.logo ? (
              <div
                style={{
                  display: "flex",
                  gap: 12,
                  alignItems: "flex-start",
                  marginTop: 8,
                }}
              >
                <img
                  src={draft.logo}
                  alt=""
                  style={{
                    width: 96,
                    height: 96,
                    objectFit: "contain",
                    border: "1px solid var(--wiki-border, #c8ccd1)",
                    borderRadius: 4,
                    background: "white",
                  }}
                />
                <div style={{ flex: 1 }}>
                  <div
                    className="setup-help"
                    style={{
                      wordBreak: "break-all",
                      marginBottom: 6,
                      fontSize: 11,
                      color: "var(--wiki-text-soft, #54595d)",
                    }}
                  >
                    {draft.logo}
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setField("logo", "");
                      setLogoError("");
                    }}
                    className="setup-button"
                  >
                    删除图片
                  </button>
                </div>
              </div>
            ) : (
              <>
                <div style={{ marginTop: 8 }}>
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    disabled={logoUploading}
                    onChange={(e) => handleLogoFile(e.target.files?.[0])}
                    className="photo-input"
                  />
                  {logoUploading && (
                    <span style={{ marginLeft: 10, color: "var(--wiki-text-soft, #54595d)" }}>
                      上传中…
                    </span>
                  )}
                </div>
                <div style={{ marginTop: 10 }}>
                  <input
                    type="text"
                    placeholder="或粘贴图片 URL（imgur / GitHub raw / Wikipedia Commons）"
                    value={draft.logo || ""}
                    onChange={(e) => {
                      setField("logo", e.target.value.trim());
                      setLogoError("");
                    }}
                    className="setup-input"
                  />
                </div>
                <div className="setup-help" style={{ marginTop: 6 }}>
                  上传 ≤3 MB jpg/png/webp，或粘贴直链。
                  找图建议：
                  <a href="https://imgur.com/upload" target="_blank" rel="noopener noreferrer">imgur</a>
                  {" · "}
                  <a href="https://commons.wikimedia.org/wiki/Special:MediaSearch" target="_blank" rel="noopener noreferrer">Wikipedia Commons</a>
                  {" · "}GitHub repo 里的图片右键复制 raw 链接
                </div>
              </>
            )}

            {logoError && (
              <div className="setup-error" style={{ marginTop: 8 }}>{logoError}</div>
            )}

            {draft.logo && (
              <div className="setup-bilingual-grid" style={{ marginTop: 12 }}>
                <div className="setup-field" style={{ marginBottom: 0 }}>
                  <label className="setup-label">图注（英，选填）</label>
                  <input
                    type="text"
                    value={draft.logo_caption || ""}
                    onChange={(e) => setField("logo_caption", e.target.value)}
                    className="setup-input"
                  />
                </div>
                <div className="setup-field" style={{ marginBottom: 0 }}>
                  <label className="setup-label">图注（中，选填）</label>
                  <input
                    type="text"
                    value={draft.logo_caption_zh || ""}
                    onChange={(e) => setField("logo_caption_zh", e.target.value)}
                    className="setup-input"
                  />
                </div>
              </div>
            )}
          </div>

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
              return (
                <div key={f.key} className="setup-bilingual-grid">
                  <div className="setup-field">
                    <label className="setup-label">{f.label}</label>
                    {f.textarea ? (
                      <WikiTextarea
                        value={draft[f.key] ?? ""}
                        onChange={(e) => setField(f.key, e.target.value)}
                        rows={f.rows || 6}
                      />
                    ) : (
                      <input
                        type="text"
                        value={draft[f.key] ?? ""}
                        onChange={(e) => setField(f.key, e.target.value)}
                        className="setup-input"
                      />
                    )}
                    {f.hint && <div className="setup-help">{f.hint}</div>}
                  </div>
                  <div className="setup-field">
                    <label className="setup-label">{f.bilingualLabel}</label>
                    {f.bilingualTextarea ? (
                      <WikiTextarea
                        value={draft[f.bilingualKey] ?? ""}
                        onChange={(e) => setField(f.bilingualKey, e.target.value)}
                        rows={f.rows || 6}
                      />
                    ) : (
                      <input
                        type="text"
                        value={draft[f.bilingualKey] ?? ""}
                        onChange={(e) => setField(f.bilingualKey, e.target.value)}
                        className="setup-input"
                      />
                    )}
                  </div>
                </div>
              );
            }

            return (
              <div key={f.key} className="setup-field">
                <label className="setup-label">{f.label}</label>
                {f.textarea ? (
                  <WikiTextarea
                    value={draft[f.key] ?? ""}
                    onChange={(e) => setField(f.key, e.target.value)}
                    rows={f.rows || 6}
                  />
                ) : (
                  <input
                    type="text"
                    value={draft[f.key] ?? ""}
                    onChange={(e) => setField(f.key, e.target.value)}
                    className="setup-input"
                  />
                )}
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
