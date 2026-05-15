"use client";

// Upload panel: PDF drop (主路径) + paste fallback (折叠) → /api/parse → setValue() the form.
// Paste fallback 默认折叠：3-agent review 一致认为移动端用户的简历 PDF 通常在电脑上，
// 完全删 paste 会把 xhs 引流过来的手机端用户卡死（卡死率估 60%+）。

import { useEffect, useRef, useState } from "react";

const MAX_PDF_BYTES = 5 * 1024 * 1024; // 5 MB

// 等待期间展示的阶段。前端基于 P50 耗时模拟推进，最后一阶段由真返回触发。
// 文案严格按 wikipedia register：动作动词 + 对象，无 "AI" / 无营销味。
// 真 streaming 上线后会换成 SSE delta 驱动（见 Day 2 计划）。
const PARSE_STAGES = [
  "解析简历内容",
  "整理教育经历",
  "整理工作与项目",
  "编写个人简介",
  "填入表单",
];

// 阶段切换时间表（毫秒）— P50 ~15s 拆段。
// stage 4 永不自动推进，等真返回。
const STAGE_TIMELINE = [1500, 4000, 8000];

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
  const [stage, setStage] = useState(-1); // -1 = idle, 0..4 = 当前 active stage
  const [error, setError] = useState("");
  const [showLoginCTA, setShowLoginCTA] = useState(false);
  const [info, setInfo] = useState("");
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef(null);

  // Busy 期间按时间表自动推进 stage 0→1→2→3。stage 3 ("编写个人简介")
  // 永久停留直到真返回触发 stage 4 + setBusy(false)。
  useEffect(() => {
    if (!busy) return;
    const timers = STAGE_TIMELINE.map((ms, i) =>
      setTimeout(() => setStage((cur) => Math.max(cur, i + 1)), ms)
    );
    return () => timers.forEach(clearTimeout);
  }, [busy]);

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
    // 拖完 = 用户已确认提交，立刻 auto-parse（fix「以为上传就完事了」UX bug）
    handleParse(f);
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

  const handleParse = async (overrideFile = null) => {
    // overrideFile 让 onPickFile 直接传刚选好的 file，避开 React state 没 propagate 的窗口
    const useFile = overrideFile || file;
    if (!useFile && !pasted.trim()) {
      setError("先上传一份 PDF 简历，或展开下方「没 PDF？」粘贴一段文字");
      return;
    }
    setBusy(true);
    setStage(0);
    setError("");
    setShowLoginCTA(false);
    setInfo("");
    try {
      const body = {};
      if (useFile) {
        body.pdfBase64 = await fileToBase64(useFile);
      } else if (pasted.trim()) {
        body.text = pasted.trim();
      }
      const res = await fetch("/api/parse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!res.ok) {
        // 429 + requireAuth = 匿名超额 → 让用户看到登录解锁 CTA
        if (res.status === 429 && json.requireAuth) {
          setShowLoginCTA(true);
        }
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
      // 真返回后短暂闪一下 "填入表单" 给用户一个收尾感，再隐藏进度列表
      setStage(4);
      await new Promise((r) => setTimeout(r, 350));
    } catch (e) {
      setError(humanizeParseError(e.message));
      setStage(-1);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="upload-panel">
      <h2 className="setup-section-heading">第一步 · 上传简历</h2>
      <p className="setup-help" style={{ marginTop: -8, marginBottom: 8 }}>
        把简历 PDF 拖进来。10 秒内自动帮你填好下面的表单，你再改不满意的地方。
      </p>
      <p
        className="setup-help"
        style={{
          marginTop: 0,
          marginBottom: 14,
          padding: "8px 12px",
          background: "var(--wiki-bg-alt, #f8f9fa)",
          border: "1px solid var(--wiki-border, #c8ccd1)",
          borderRadius: 4,
          fontSize: 12,
          lineHeight: 1.6,
        }}
      >
        <strong>隐私说明：</strong>PDF 不会进我们的数据库，
        我们只读取一次抽取里面的信息，不留底、不用来训练。
        不愿意上传也行 — 往下滚到「第二步」可以自己一项一项手填。
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
              {busy
                ? "正在解析，请稍候"
                : "点击换一份 PDF，或拖另一个文件进来。"}
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

      {busy && stage >= 0 && (
        <div
          role="status"
          aria-live="polite"
          aria-label="简历解析进度"
          style={{
            marginTop: 14,
            padding: "14px 16px",
            background: "var(--wiki-bg-alt, #f8f9fa)",
            border: "1px solid var(--wiki-border, #c8ccd1)",
            borderRadius: 4,
          }}
        >
          <ul
            style={{
              listStyle: "none",
              margin: 0,
              padding: 0,
              display: "flex",
              flexDirection: "column",
              gap: 6,
            }}
          >
            {PARSE_STAGES.map((label, i) => {
              const isDone = i < stage;
              const isActive = i === stage;
              const dot = isDone || isActive ? "●" : "○";
              // 维基百科链接蓝表示进行中；done 用正文黑；pending 用 soft 灰
              const color = isActive
                ? "#36c"
                : isDone
                ? "var(--wiki-text, #202122)"
                : "var(--wiki-text-soft, #72777d)";
              return (
                <li
                  key={label}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    fontSize: 13,
                    lineHeight: 1.5,
                    color,
                    fontWeight: isActive ? 600 : 400,
                  }}
                >
                  <span
                    aria-hidden="true"
                    style={{
                      fontSize: 14,
                      lineHeight: 1,
                      width: 14,
                      textAlign: "center",
                      flex: "0 0 auto",
                    }}
                  >
                    {dot}
                  </span>
                  <span>{label}</span>
                </li>
              );
            })}
          </ul>
          <div
            style={{
              marginTop: 12,
              paddingTop: 10,
              borderTop: "1px solid var(--wiki-border, #c8ccd1)",
              fontSize: 12,
              color: "var(--wiki-text-soft, #72777d)",
            }}
          >
            约 20 秒。慢一点，内容更稳。
          </div>
        </div>
      )}

      <details className="upload-fallback">
        <summary>没 PDF？或者 PDF 解析失败？粘贴一段文字试试</summary>
        <textarea
          value={pasted}
          onChange={(e) => setPasted(e.target.value)}
          rows={5}
          disabled={!!file}
          className="setup-textarea"
          placeholder={
            file
              ? "已经选了 PDF 作为来源。换成粘贴文字的话，先把上面的 PDF 删掉。"
              : "粘贴你的领英 About、个人简介草稿、随手写的笔记 —— 任何能描述你的文字都行。"
          }
        />
      </details>

      {/* 按钮只在 paste 模式下有粘贴文本时显示;file 模式 auto-parse + 拖拽框 busy 提示已足够 */}
      {!file && pasted.trim() && (
        <button
          type="button"
          onClick={handleParse}
          disabled={busy}
          className="setup-button-primary"
        >
          {busy ? "正在解析…" : "解析并填好下方表单"}
        </button>
      )}

      {error && (
        <div className="upload-error">
          {error}
          {showLoginCTA && (
            <a
              href="/login"
              className="setup-button-primary"
              style={{
                display: "inline-block",
                marginLeft: 10,
                marginTop: 4,
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
      {info && <div className="upload-info">{info}</div>}
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
    return "没看明白这份 PDF（可能是扫描件 / 排版太复杂）。展开下方「没 PDF？」粘贴文字版试试，或换一份 PDF。";
  }
  if (/PDF|pdf-parse/i.test(msg)) {
    return "PDF 读取失败，可能是加密或扫描件。导出为可选中文字的 PDF 再上传，或展开下方「没 PDF？」直接粘贴文字。";
  }
  if (/Request failed|fetch|network/i.test(msg)) {
    return "网络请求失败，等 30 秒左右再试一次通常就好。";
  }
  return msg || "这次没能完成解析，再试一次通常可以解决。";
}
