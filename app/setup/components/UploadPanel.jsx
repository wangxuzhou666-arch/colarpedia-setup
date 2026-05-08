"use client";

// Upload panel: PDF drop + text paste → /api/parse → setValue() the form.
// Sits at the top of SetupForm. Optional — users can also fill manually.

import { useRef, useState } from "react";

const MAX_PDF_BYTES = 5 * 1024 * 1024; // 5 MB

const FORM_FIELDS = [
  "name",
  "homepageSlug",
  "tagline",
  "bio",
  "siteName",
  "metaBaseUrl",
  "githubOwner",
  "githubRepo",
  "email",
  "linkedin",
  "githubProfile",
];

export default function UploadPanel({
  setValue,
  setSlugTouched,
  replaceShipped,
}) {
  const [file, setFile] = useState(null);
  const [pasted, setPasted] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [info, setInfo] = useState(""); // success summary
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef(null);

  const onPickFile = (f) => {
    if (!f) return;
    if (f.type && f.type !== "application/pdf" && !f.name.endsWith(".pdf")) {
      setError("Only PDF files are accepted (got " + (f.type || "unknown") + ").");
      setFile(null);
      return;
    }
    if (f.size > MAX_PDF_BYTES) {
      setError("PDF is too large (max 5 MB).");
      setFile(null);
      return;
    }
    setError("");
    setFile(f);
  };

  const fileToBase64 = (f) =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result;
        // result is "data:application/pdf;base64,...." — strip the prefix
        const base64 = String(result).split(",", 2)[1] || "";
        resolve(base64);
      };
      reader.onerror = () => reject(new Error("Failed to read file"));
      reader.readAsDataURL(f);
    });

  const handleParse = async () => {
    if (!file && !pasted.trim()) {
      setError("Upload a PDF or paste some text first.");
      return;
    }
    setBusy(true);
    setError("");
    setInfo("");
    try {
      const body = {};
      if (file) {
        body.pdfBase64 = await fileToBase64(file);
      }
      if (pasted.trim()) {
        body.text = pasted.trim();
      }
      const res = await fetch("/api/parse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || `Request failed (${res.status})`);
      }
      const data = json.data || {};

      // setValue every plain field
      for (const k of FORM_FIELDS) {
        if (k in data) {
          setValue(k, data[k] ?? "", { shouldValidate: false });
        }
      }
      // homepageSlug came from LLM — mark slug as touched so the
      // name->slug auto-derive does NOT overwrite it later.
      if (data.homepageSlug) {
        setSlugTouched(true);
      }
      // shipped: replace whole array via useFieldArray.replace()
      if (Array.isArray(data.shipped)) {
        replaceShipped(
          data.shipped.map((s) => ({
            name: s.name || "",
            description: s.description || "",
          }))
        );
      }

      const meta = json.meta || {};
      setInfo(
        `Filled from ${file ? "PDF" : "pasted text"}. ` +
          `${meta.outputTokens || 0} tokens generated, est ` +
          `$${meta.estCostUsd || 0}. ` +
          (meta.rateLimitRemaining !== undefined
            ? `${meta.rateLimitRemaining} generations left today.`
            : "")
      );
    } catch (e) {
      setError(e.message || "Parse failed.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="upload-panel">
      <h2 className="setup-section-heading">Quick start — upload your résumé</h2>
      <p className="setup-help" style={{ marginTop: -8, marginBottom: 14 }}>
        Drop a PDF or paste any text about yourself (LinkedIn About,
        biography draft, freeform notes). Claude Haiku will fill the
        form below in ~10 seconds. You can edit any field afterwards.
      </p>

      <div
        className={`upload-drop ${dragOver ? "is-drag" : ""}`}
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          const f = e.dataTransfer?.files?.[0];
          onPickFile(f);
        }}
        onClick={() => fileInputRef.current?.click()}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            fileInputRef.current?.click();
          }
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
          <>
            <strong>{file.name}</strong>{" "}
            <span style={{ color: "var(--wiki-text-soft)" }}>
              ({Math.round(file.size / 1024)} KB)
            </span>
            <div className="setup-help" style={{ marginTop: 4 }}>
              Click to replace, or drop a different PDF.
            </div>
          </>
        ) : (
          <>
            <strong>Drop a PDF here</strong> or click to browse
            <div className="setup-help" style={{ marginTop: 4 }}>
              Max 5 MB. Résumé / CV / bio works best.
            </div>
          </>
        )}
      </div>

      <div className="upload-or">— or —</div>

      <div className="setup-field">
        <label className="setup-label">Paste text instead (or in addition)</label>
        <textarea
          value={pasted}
          onChange={(e) => setPasted(e.target.value)}
          rows={5}
          className="setup-textarea"
          placeholder="Paste your LinkedIn About section, a bio draft, freeform notes — anything Claude can read to learn who you are."
        />
      </div>

      <button
        type="button"
        onClick={handleParse}
        disabled={busy || (!file && !pasted.trim())}
        className="setup-button-primary"
      >
        {busy ? "Parsing with Claude…" : "Parse and fill the form"}
      </button>

      {error && <div className="upload-error">⚠ {error}</div>}
      {info && <div className="upload-info">✓ {info}</div>}
    </div>
  );
}
