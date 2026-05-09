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
  name_zh: "Name (zh)",
  description: "Description",
  description_zh: "Description (zh)",
  role: "Role",
  role_zh: "Role (zh)",
  degree: "Degree",
  degree_zh: "Degree (zh)",
  date_range: "Dates",
  location: "Location",
  url: "URL",
  tech_stack: "Tech stack",
  body: "Body (en)",
  body_zh: "Body (zh)",
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
  const [result, setResult] = useState(null); // {patch, evidence, unfilled, rejected, meta}
  const fileInputRef = useRef(null);

  const onPickFile = (f) => {
    setError("");
    if (!f) {
      setFile(null);
      return;
    }
    if (f.type && f.type !== "application/pdf" && !f.name.endsWith(".pdf")) {
      setError("Only PDF files are accepted.");
      return;
    }
    if (f.size > MAX_PDF_BYTES) {
      setError("PDF too large (max 5 MB).");
      return;
    }
    setFile(f);
    setPasted(""); // mutually exclusive — same as UploadPanel
  };

  const submit = async () => {
    setError("");
    setResult(null);
    if (!file && !pasted.trim()) {
      setError("Drop a PDF or paste some text first.");
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
        throw new Error(json.error || `Request failed (${res.status})`);
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
      setError(e.message || "Polish failed.");
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
            <strong>Add material for</strong>{" "}
            <span className="gapfill-entity-name">{entity?.name || "[entity]"}</span>
            <span className="gapfill-entity-kind">
              {" "}
              · {entityType}
            </span>
          </div>
          <button
            type="button"
            className="gapfill-close"
            onClick={onClose}
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        <div className="gapfill-body">
          <div className="gapfill-col gapfill-current">
            <div className="gapfill-col-heading">Currently filled</div>
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
                <strong>Will try to fill:</strong>
                <ul>
                  {gaps.map((g) => (
                    <li key={g}>{FIELD_LABELS[g] || g}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          <div className="gapfill-col gapfill-input">
            <div className="gapfill-col-heading">Add material</div>
            <p className="setup-help" style={{ marginTop: 0 }}>
              Drop a PDF (project README, role description, school
              bulletin, certificate) <em>or</em> paste text below. The LLM
              will fill ONLY the gaps listed, grounded in this source.
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
                  Drop a PDF here, or click to browse
                </div>
              )}
            </div>

            <textarea
              rows={6}
              className="setup-textarea"
              placeholder="Or paste text — README content, bullet points, role description..."
              value={pasted}
              onChange={(e) => setPasted(e.target.value)}
              disabled={!!file}
              style={{ marginTop: 10 }}
            />

            {error && <div className="setup-error">{error}</div>}

            <div style={{ marginTop: 12 }}>
              <button
                type="button"
                className="setup-button-primary"
                onClick={submit}
                disabled={busy || (!file && !pasted.trim())}
              >
                {busy ? "Filling…" : "Fill these fields"}
              </button>
            </div>

            {result && (
              <div className="gapfill-result">
                {filledCount > 0 ? (
                  <div className="gapfill-result-success">
                    ✓ Filled {filledCount} field
                    {filledCount === 1 ? "" : "s"} on{" "}
                    <strong>{entity?.name}</strong>. Form has been updated.
                  </div>
                ) : (
                  <div className="gapfill-result-empty">
                    Couldn&apos;t find anything new in that source.
                    {(result.rejected || []).length > 0 &&
                      " The model tried to fill some fields but the evidence didn't match the source — they were dropped."}
                  </div>
                )}

                {filledCount > 0 && (
                  <details className="gapfill-evidence" open>
                    <summary>
                      Evidence ({filledCount} quote
                      {filledCount === 1 ? "" : "s"} from your source)
                    </summary>
                    <ul>
                      {Object.entries(result.evidence || {}).map(
                        ([field, quote]) => (
                          <li key={field}>
                            <strong>{FIELD_LABELS[field] || field}:</strong>{" "}
                            <em>&quot;{quote}&quot;</em>
                          </li>
                        )
                      )}
                    </ul>
                  </details>
                )}

                {(result.unfilled || []).length > 0 && filledCount > 0 && (
                  <div className="gapfill-result-partial">
                    Couldn&apos;t fill:{" "}
                    {result.unfilled
                      .map((f) => FIELD_LABELS[f] || f)
                      .join(", ")}
                  </div>
                )}

                <div className="setup-help" style={{ marginTop: 8 }}>
                  Cost: ~${result.meta?.estCostUsd ?? "?"} ·{" "}
                  {result.meta?.rateLimitRemaining ?? "?"} polishes left today.
                </div>

                <div style={{ marginTop: 10 }}>
                  <button
                    type="button"
                    className="setup-button"
                    onClick={onClose}
                  >
                    Done
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
