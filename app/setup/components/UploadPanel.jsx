"use client";

// Upload panel: PDF drop + text paste → /api/parse → setValue() the form.

import { useRef, useState } from "react";

const MAX_PDF_BYTES = 5 * 1024 * 1024; // 5 MB

const FORM_FIELDS = [
  "name",
  "name_zh",
  "homepageSlug",
  "tagline",
  "tagline_zh",
  "bio",
  "bio_zh",
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
  replaceEducations,
  replaceExperiences,
  onPdfFileChange,
}) {
  const [file, setFile] = useState(null);
  const [pasted, setPasted] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef(null);

  const onPickFile = (f) => {
    if (!f) return;
    if (f.type && f.type !== "application/pdf" && !f.name.endsWith(".pdf")) {
      setError("只支持 PDF 文件（你上传的是 " + (f.type || "未知格式") + "）");
      setFile(null);
      onPdfFileChange?.(null);
      return;
    }
    if (f.size > MAX_PDF_BYTES) {
      setError("PDF 太大了（最多 5 MB）");
      setFile(null);
      onPdfFileChange?.(null);
      return;
    }
    setError("");
    setFile(f);
    onPdfFileChange?.(f);
    setPasted("");
    setInfo("");
  };

  const fileToBase64 = (f) =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result;
        const base64 = String(result).split(",", 2)[1] || "";
        resolve(base64);
      };
      reader.onerror = () => reject(new Error("文件读取失败"));
      reader.readAsDataURL(f);
    });

  const handleParse = async () => {
    if (!file && !pasted.trim()) {
      setError("先上传一份 PDF 简历，或在下面粘贴一段自我介绍文字");
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
        throw new Error(json.error || `解析请求失败（${res.status}）`);
      }
      const data = json.data || {};

      for (const k of FORM_FIELDS) {
        if (k in data) {
          setValue(k, data[k] ?? "", { shouldValidate: false });
        }
      }
      if (data.homepageSlug) {
        setSlugTouched(true);
      }
      if (Array.isArray(data.shipped)) {
        replaceShipped(
          data.shipped.map((s) => ({
            name: s.name || "",
            name_zh: s.name_zh || "",
            slug: s.slug || "",
            description: s.description || "",
            description_zh: s.description_zh || "",
            role: s.role || "",
            role_zh: s.role_zh || "",
            date_range: s.date_range || "",
            url: s.url || "",
            tech_stack: Array.isArray(s.tech_stack) ? s.tech_stack : [],
            body: s.body || "",
            body_zh: s.body_zh || "",
          }))
        );
      }
      if (Array.isArray(data.educations) && replaceEducations) {
        replaceEducations(
          data.educations.map((e) => ({
            name: e.name || "",
            name_zh: e.name_zh || "",
            slug: e.slug || "",
            degree: e.degree || "",
            degree_zh: e.degree_zh || "",
            date_range: e.date_range || "",
            location: e.location || "",
            body: e.body || "",
            body_zh: e.body_zh || "",
          }))
        );
      }
      if (Array.isArray(data.experiences) && replaceExperiences) {
        replaceExperiences(
          data.experiences.map((e) => ({
            name: e.name || "",
            name_zh: e.name_zh || "",
            slug: e.slug || "",
            role: e.role || "",
            role_zh: e.role_zh || "",
            date_range: e.date_range || "",
            location: e.location || "",
            body: e.body || "",
            body_zh: e.body_zh || "",
          }))
        );
      }

      const meta = json.meta || {};
      const shippedCount = Array.isArray(data.shipped) ? data.shipped.length : 0;
      const eduCount = Array.isArray(data.educations) ? data.educations.length : 0;
      const expCount = Array.isArray(data.experiences) ? data.experiences.length : 0;
      const remaining = meta.rateLimitRemaining;
      setInfo(
        `识别完成：${eduCount} 段教育经历 · ${expCount} 段工作经历 · ${shippedCount} 个项目。` +
          (remaining !== undefined
            ? `（今天还能解析 ${remaining} 次）`
            : "")
      );
    } catch (e) {
      setError(humanizeParseError(e.message));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="upload-panel">
      <h2 className="setup-section-heading">第一步 · 上传简历</h2>
      <p className="setup-help" style={{ marginTop: -8, marginBottom: 14 }}>
        把简历 PDF 拖进来，或者直接粘贴一段关于你自己的文字（领英 About、
        知乎个人简介、随手写的草稿都可以）。Claude 会在 10 秒内把表单帮你填好，
        你再改不满意的地方。
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
              （{Math.round(file.size / 1024)} KB）
            </span>
            <div className="setup-help" style={{ marginTop: 4 }}>
              点击换一份 PDF，或拖另一个文件进来。
            </div>
          </>
        ) : (
          <>
            <strong>把 PDF 拖到这里</strong>，或点击选择文件
            <div className="setup-help" style={{ marginTop: 4 }}>
              最大 5 MB。简历 / CV / 个人介绍 都行。
            </div>
          </>
        )}
      </div>

      <div className="upload-or">— 或者 —</div>

      <div className="setup-field">
        <label className="setup-label">
          直接粘贴文字 {file ? "（已选 PDF，禁用）" : "（选填）"}
        </label>
        <textarea
          value={pasted}
          onChange={(e) => setPasted(e.target.value)}
          rows={5}
          disabled={!!file}
          className="setup-textarea"
          placeholder={
            file
              ? "已经选了 PDF 作为来源。换成粘贴文字的话，先把上面的 PDF 删掉。"
              : "粘贴你的领英 About、个人简介草稿、随手写的笔记 —— 任何能让 Claude 了解你的文字都行。"
          }
        />
      </div>

      <button
        type="button"
        onClick={handleParse}
        disabled={busy || (!file && !pasted.trim())}
        className="setup-button-primary"
      >
        {busy ? "Claude 正在读取…" : "解析并填好下方表单"}
      </button>

      {error && <div className="upload-error">⚠ {error}</div>}
      {info && <div className="upload-info">✓ {info}</div>}
    </div>
  );
}

// 把英文/技术性错误信息翻译成用户看得懂 + 知道下一步的中文提示
function humanizeParseError(raw) {
  const msg = String(raw || "");
  if (/rate limit|daily limit|10 generations/i.test(msg)) {
    return "今天免费解析次数用完了（每个网络每天 10 次）。明天再试，或者直接在下面表单手动填。";
  }
  if (/Model did not return structured data|tool_use/i.test(msg)) {
    return "AI 没看明白这份 PDF（可能是扫描件 / 排版太复杂）。试试在下方粘贴文字版，或换一份 PDF。";
  }
  if (/PDF|pdf-parse/i.test(msg)) {
    return "PDF 读取失败，可能是加密或扫描件。建议导出为可选中文字的 PDF 再上传，或直接在下面粘贴文字。";
  }
  if (/Request failed|fetch|network/i.test(msg)) {
    return "网络请求失败，过几秒再点一次。";
  }
  return msg || "解析失败，再试一次。";
}
