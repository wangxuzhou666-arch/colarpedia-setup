"use client";

// GapFillDialog — opens from the audit panel's "+ Add material" link
// next to a per-entity suggestion. Lets the user upload a PDF or paste
// text scoped to ONE entity, calls /api/polish-entity to fill the
// missing fields, and applies the verified patch back to the form via
// the parent's setValue callback.
//
// Auto-apply v1 — no per-field accept/reject diff. Trust comes from
// the evidence quotes the server returns alongside each filled field
// (server has substring-validated them against the source).

import { useState, useRef } from "react";

const MAX_PDF_BYTES = 5 * 1024 * 1024;
const MAX_TEXT_CHARS = 20000;

function fileToBase64(f) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result || "");
      const comma = result.indexOf(",");
      resolve(comma >= 0 ? result.slice(comma + 1) : result);
    };
    reader.onerror = () => reject(new Error("Failed to read file"));
    reader.readAsDataURL(f);
  });
}

// Pretty-print a value for the "currently filled" preview column.
function previewVal(v) {
  if (v === null || v === undefined || v === "") return "—";
  if (Array.isArray(v)) return v.length ? v.join(", ") : "—";
  if (typeof v === "string" && v.length > 220) return v.slice(0, 220) + "…";
  return String(v);
}

const FIELD_LABELS = {
  name_zh: "中文名",
  description: "英文简介",
  description_zh: "中文简介",
  role: "英文角色",
  role_zh: "中文角色",
  degree: "英文学位",
  degree_zh: "中文学位",
  date_range: "时间",
  location: "地点",
  url: "链接",
  tech_stack: "技术栈",
  body: "英文详情",
  body_zh: "中文详情",
};

export default function GapFillDialog({
  entityType, // "shipped" | "educations" | "experiences"
  entityIdx,
  entity,
  gaps, // array of field names the user wants filled
  homepageSlug,
  siblingSlugs,
  onApply, // (idx, patch) => void  — parent writes setValue
  onClose,
}) {
  const [file, setFile] = useState(null);
  const [pasted, setPasted] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [showLoginCTA, setShowLoginCTA] = useState(false);
  const [result, setResult] = useState(null); // {patch, evidence, unfilled, rejected, meta}
  const fileInputRef = useRef(null);

  // 产出链接（仅 shipped + experiences 有）的本地输入态——独立于
  // 上面的 PDF/文本补全流程，按"添加产出"直接写表单，不调 LLM。
  const supportsOutputs =
    entityType === "shipped" || entityType === "experiences";
  const existingOutputs = Array.isArray(entity?.outputs) ? entity.outputs : [];
  const remainingOutputSlots = Math.max(0, 3 - existingOutputs.length);
  const [outputLabel, setOutputLabel] = useState("");
  const [outputUrl, setOutputUrl] = useState("");
  const [outputError, setOutputError] = useState("");
  const [outputAddedCount, setOutputAddedCount] = useState(0);

  const addOutput = () => {
    setOutputError("");
    const label = outputLabel.trim();
    const url = outputUrl.trim();
    if (!label || !url) {
      setOutputError("名字和网址都要填。");
      return;
    }
    if (!/^https?:\/\//i.test(url)) {
      setOutputError("网址要以 http:// 或 https:// 开头。");
      return;
    }
    const next = [...existingOutputs, { label, url }].slice(0, 3);
    onApply(entityIdx, { outputs: next });
    setOutputLabel("");
    setOutputUrl("");
    setOutputAddedCount((n) => n + 1);
  };

  const onPickFile = (f) => {
    setError("");
    if (!f) {
      setFile(null);
      return;
    }
    if (f.type && f.type !== "application/pdf" && !f.name.endsWith(".pdf")) {
      setError("只支持 PDF 文件。");
      return;
    }
    if (f.size > MAX_PDF_BYTES) {
      setError("PDF 太大（最多 5 MB）。");
      return;
    }
    setFile(f);
    setPasted("");
  };

  const submit = async () => {
    setError("");
    setResult(null);
    if (!file && !pasted.trim()) {
      setError("先拖一份 PDF 进来，或在下面粘贴一段文字。");
      return;
    }
    setBusy(true);
    try {
      const body = {
        entityType,
        entity,
        gaps,
        homepageSlug,
        siblingSlugs,
      };
      if (file) {
        body.pdfBase64 = await fileToBase64(file);
      }
      if (pasted.trim()) {
        body.text = pasted.trim().slice(0, MAX_TEXT_CHARS);
      }
      const res = await fetch("/api/polish-entity", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!res.ok) {
        if (res.status === 429 && json.requireAuth) {
          setShowLoginCTA(true);
        }
        throw new Error(json.error || `请求失败（${res.status}）`);
      }
      setResult(json);

      // Auto-apply (v1). The user will see the diff via the form
      // re-rendering + the audit panel updating + the evidence list
      // shown below.
      const patch = json.patch || {};
      if (Object.keys(patch).length > 0) {
        onApply(entityIdx, patch);
      }
    } catch (e) {
      setError(e.message || "补充失败。");
    } finally {
      setBusy(false);
    }
  };

  const filledCount = result ? Object.keys(result.patch || {}).length : 0;

  return (
    <div
      className="gapfill-overlay"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="gapfill-modal"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="gapfill-header">
          <div className="gapfill-title">
            <strong>补充内容</strong>{" "}
            <span className="gapfill-entity-name">{entity?.name || "[条目]"}</span>
            <span className="gapfill-entity-kind">
              {" "}
              · {{shipped: "项目", educations: "教育", experiences: "工作"}[entityType] || entityType}
            </span>
          </div>
          <button
            type="button"
            className="gapfill-close"
            onClick={onClose}
            aria-label="关闭"
          >
            ×
          </button>
        </div>

        <div className="gapfill-body">
          <div className="gapfill-col gapfill-current">
            <div className="gapfill-col-heading">当前已填</div>
            <dl>
              {Object.entries(entity || {}).map(([k, v]) =>
                FIELD_LABELS[k] ? (
                  <div key={k} className="gapfill-current-row">
                    <dt>{FIELD_LABELS[k] || k}</dt>
                    <dd>{previewVal(v)}</dd>
                  </div>
                ) : null
              )}
            </dl>
            {gaps.length > 0 && (
              <div className="gapfill-gaps-summary">
                <strong>将尝试补全：</strong>
                <ul>
                  {gaps.map((g) => (
                    <li key={g}>{FIELD_LABELS[g] || g}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          <div className="gapfill-col gapfill-input">
            <div className="gapfill-col-heading">补充材料</div>
            <p className="setup-help" style={{ marginTop: 0 }}>
              拖一份 PDF（项目 README、岗位描述、学校公告、证书都行），
              或者直接在下面粘贴文字。我们只会补上面列出来的那些缺失字段，
              内容必须来自你提供的材料。
            </p>

            <div
              className="upload-drop"
              onClick={() => fileInputRef.current?.click()}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  fileInputRef.current?.click();
                }
              }}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                onPickFile(e.dataTransfer?.files?.[0]);
              }}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept="application/pdf,.pdf"
                style={{ display: "none" }}
                onChange={(e) => onPickFile(e.target.files?.[0])}
              />
              {file ? (
                <div>
                  <strong>{file.name}</strong>{" "}
                  <span className="setup-help" style={{ display: "inline" }}>
                    ({Math.round(file.size / 1024)} KB)
                  </span>
                </div>
              ) : (
                <div className="setup-help" style={{ margin: 0 }}>
                  把 PDF 拖到这里，或点击选择文件
                </div>
              )}
            </div>

            <textarea
              rows={6}
              className="setup-textarea"
              placeholder="或者粘贴文字——README 内容、要点、岗位说明都行..."
              value={pasted}
              onChange={(e) => setPasted(e.target.value)}
              disabled={!!file}
              style={{ marginTop: 10 }}
            />

            {supportsOutputs && (
              <details
                className="setup-array-details"
                style={{ marginTop: 12 }}
                open={outputAddedCount > 0}
              >
                <summary>
                  或者直接加产出链接（论文 / essay / demo，最多 3 条·不调 LLM）
                </summary>
                {existingOutputs.length > 0 && (
                  <ul className="setup-help" style={{ marginTop: 8 }}>
                    {existingOutputs.map((o, i) => (
                      <li key={i}>
                        {o.label} —{" "}
                        <a href={o.url} target="_blank" rel="noreferrer">
                          {o.url}
                        </a>
                      </li>
                    ))}
                  </ul>
                )}
                {remainingOutputSlots > 0 ? (
                  <>
                    <div
                      style={{
                        display: "flex",
                        gap: 8,
                        marginTop: 8,
                        alignItems: "flex-start",
                      }}
                    >
                      <input
                        className="setup-input"
                        placeholder="名字（例如：GPS Localization Essay）"
                        value={outputLabel}
                        onChange={(e) => setOutputLabel(e.target.value)}
                        style={{ flex: "0 0 38%" }}
                      />
                      <input
                        className="setup-input"
                        placeholder="https://..."
                        value={outputUrl}
                        onChange={(e) => setOutputUrl(e.target.value)}
                        style={{ flex: 1 }}
                      />
                      <button
                        type="button"
                        onClick={addOutput}
                        className="setup-button"
                      >
                        加
                      </button>
                    </div>
                    {outputError && (
                      <div className="setup-error" style={{ marginTop: 6 }}>
                        {outputError}
                      </div>
                    )}
                    <div className="setup-help" style={{ marginTop: 6 }}>
                      还能加 {remainingOutputSlots} 条。
                    </div>
                  </>
                ) : (
                  <div className="setup-help" style={{ marginTop: 8 }}>
                    已经 3 条了，回表单里改或删。
                  </div>
                )}
              </details>
            )}

            {error && (
              <div className="setup-error">
                {error}
                {showLoginCTA && (
                  <a
                    href="/login"
                    className="setup-button-primary"
                    style={{
                      display: "inline-block",
                      marginLeft: 10,
                      padding: "4px 14px",
                      fontSize: 13,
                      textDecoration: "none",
                    }}
                  >
                    去登录解锁 →
                  </a>
                )}
              </div>
            )}

            <div style={{ marginTop: 12 }}>
              <button
                type="button"
                className="setup-button-primary"
                onClick={submit}
                disabled={busy || (!file && !pasted.trim())}
              >
                {busy ? "补充中…" : "补全这些字段"}
              </button>
            </div>

            {result && (
              <div className="gapfill-result">
                {filledCount > 0 ? (
                  <div className="gapfill-result-success">
                    已补全 {filledCount} 项关于{" "}
                    <strong>{entity?.name}</strong> 的内容，表单已更新。
                  </div>
                ) : (
                  <div className="gapfill-result-empty">
                    没在这份材料里找到能补充的新内容。
                    {(result.rejected || []).length > 0 &&
                      " 尝试填了一些字段，但找不到原文依据，已丢弃。"}
                  </div>
                )}

                {filledCount > 0 && (
                  <details className="gapfill-evidence" open>
                    <summary>
                      原文依据（{filledCount} 条引用）
                    </summary>
                    <ul>
                      {Object.entries(result.evidence || {}).map(
                        ([field, quote]) => (
                          <li key={field}>
                            <strong>{FIELD_LABELS[field] || field}：</strong>{" "}
                            <em>&quot;{quote}&quot;</em>
                          </li>
                        )
                      )}
                    </ul>
                  </details>
                )}

                {(result.unfilled || []).length > 0 && filledCount > 0 && (
                  <div className="gapfill-result-partial">
                    没补到的字段：{" "}
                    {result.unfilled
                      .map((f) => FIELD_LABELS[f] || f)
                      .join("、")}
                  </div>
                )}

                <div className="setup-help" style={{ marginTop: 8 }}>
                  本次成本：约 ${result.meta?.estCostUsd ?? "?"} ·{" "}
                  今天还能补充 {result.meta?.rateLimitRemaining ?? "?"} 次
                </div>

                <div style={{ marginTop: 10 }}>
                  <button
                    type="button"
                    className="setup-button"
                    onClick={onClose}
                  >
                    完成
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
