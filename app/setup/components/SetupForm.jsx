"use client";

import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useMemo, useState } from "react";
import { useSession, signIn, signOut } from "next-auth/react";
import { setupSchema, deriveSlug } from "../lib/schema";
import { getSupabaseBrowserClient } from "../../../lib/supabase/client";
import UploadPanel from "./UploadPanel";
import PreviewModal from "./PreviewModal";

// 项目缩略图的 slug 兜底——项目还没填名字时用 project_<idx>，
// 这样用户先传图后填名也不会丢图。
function projectSlug(name, idx) {
  const fromName = deriveSlug(name);
  return fromName || `project_${idx + 1}`;
}

// 给 shipped[] 加上 thumbnailPath，模板里好用 <img> 引用。
function enrichShipped(data, thumbsByIdx, mode) {
  return {
    ...data,
    shipped: (data.shipped || []).map((s, idx) => {
      const t = thumbsByIdx[idx];
      if (!t) return s;
      const slug = projectSlug(s.name, idx);
      let path;
      if (mode === "preview") {
        path = t.kind === "image" ? t.previewUrl : `${slug}.pdf`;
      } else {
        path = `/projects/${slug}.${t.ext}`;
      }
      return { ...s, thumbnailPath: path };
    }),
  };
}

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result || "");
      const comma = result.indexOf(",");
      resolve(comma >= 0 ? result.slice(comma + 1) : result);
    };
    reader.onerror = () => reject(new Error("照片读取失败"));
    reader.readAsDataURL(file);
  });
}

const PHOTO_EXT_BY_TYPE = {
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

const PROJECT_ATTACHMENT_EXT_BY_TYPE = {
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "application/pdf": "pdf",
};

function projectAttachmentExt(file) {
  if (!file) return null;
  const byType = PROJECT_ATTACHMENT_EXT_BY_TYPE[file.type];
  if (byType) return byType;
  const dot = file.name.lastIndexOf(".");
  if (dot < 0) return null;
  const tail = file.name.slice(dot + 1).toLowerCase();
  return /^(jpg|jpeg|png|webp|pdf)$/.test(tail)
    ? tail.replace("jpeg", "jpg")
    : null;
}

// 把 deploy 接口的英文错误翻译成用户能 actionable 的中文
function humanizeDeployError(raw) {
  const msg = String(raw || "");
  if (/rate limit|abuse/i.test(msg)) {
    return "GitHub 这边短时间请求太多了，等几分钟再试。";
  }
  if (/fork/i.test(msg) && /fail/i.test(msg)) {
    return "复制模板仓库失败。可能是 GitHub 暂时性故障，再试一次；如果反复失败，去你的 GitHub 看看是不是有同名仓库占用了。";
  }
  if (/auth|token|unauthor/i.test(msg)) {
    return "GitHub 授权失效了。点上面「重新登录」再试。";
  }
  return msg || "上线失败，再试一次。";
}

export default function SetupForm() {
  const [pdfFile, setPdfFile] = useState(null);
  const [photoFile, setPhotoFile] = useState(null);
  const [photoPreviewUrl, setPhotoPreviewUrl] = useState("");
  const [photoError, setPhotoError] = useState("");
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewData, setPreviewData] = useState(null);
  const [projectThumbs, setProjectThumbs] = useState({});
  const [projectThumbErrors, setProjectThumbErrors] = useState({});
  const { data: session, status: sessionStatus } = useSession();
  const [deployStep, setDeployStep] = useState("idle"); // idle | forking | committing | done | error
  const [deployResult, setDeployResult] = useState(null);
  const [deployError, setDeployError] = useState("");
  // Supabase hosted publish 路径
  const [supaUser, setSupaUser] = useState(null);
  const [supaUserLoading, setSupaUserLoading] = useState(true);
  const [publishStep, setPublishStep] = useState("idle"); // idle | publishing | done | error
  const [publishResult, setPublishResult] = useState(null);
  const [publishError, setPublishError] = useState("");
  // 英文版字段全局开关。默认开（保持当前行为），用户可关掉砍密度。
  const [showEnglish, setShowEnglish] = useState(true);

  // 监听 Supabase session
  useEffect(() => {
    let mounted = true;
    const supabase = getSupabaseBrowserClient();
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!mounted) return;
      setSupaUser(user || null);
      setSupaUserLoading(false);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, sess) => {
      if (!mounted) return;
      setSupaUser(sess?.user || null);
    });
    return () => {
      mounted = false;
      subscription?.unsubscribe();
    };
  }, []);

  const {
    register,
    handleSubmit,
    control,
    watch,
    setValue,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(setupSchema),
    mode: "onTouched",
    defaultValues: {
      name: "",
      name_zh: "",
      homepageSlug: "",
      tagline: "",
      tagline_zh: "",
      bio: "",
      bio_zh: "",
      siteName: "Yourpedia",
      metaBaseUrl: "",
      githubOwner: "",
      githubRepo: "",
      email: "",
      linkedin: "",
      githubProfile: "",
      shipped: [],
      educations: [],
      experiences: [],
    },
  });

  const { fields, append, remove, replace } = useFieldArray({
    control,
    name: "shipped",
  });
  const {
    fields: eduFields,
    append: appendEdu,
    remove: removeEdu,
    replace: replaceEdu,
  } = useFieldArray({ control, name: "educations" });
  const {
    fields: expFields,
    append: appendExp,
    remove: removeExp,
    replace: replaceExp,
  } = useFieldArray({ control, name: "experiences" });

  const nameValue = watch("name");
  const [slugTouched, setSlugTouched] = useState(false);

  // 折叠 section 的摘要行 — 用于 details summary 显示"已填了什么"
  const emailValue = watch("email");
  const linkedinValue = watch("linkedin");
  const githubProfileValue = watch("githubProfile");
  const shippedValues = watch("shipped");
  const educationsValues = watch("educations");
  const experiencesValues = watch("experiences");

  const contactSummary = useMemo(() => {
    const parts = [];
    if (emailValue) parts.push("邮箱");
    if (linkedinValue) parts.push("LinkedIn");
    if (githubProfileValue) parts.push("GitHub");
    return parts.length ? parts.join(" · ") : "未填";
  }, [emailValue, linkedinValue, githubProfileValue]);

  const arraySummary = (items, nameKeys) => {
    if (!items || items.length === 0) return "未添加";
    const names = items
      .map((item) => {
        for (const key of nameKeys) {
          if (item?.[key]) return item[key];
        }
        return null;
      })
      .filter(Boolean);
    if (names.length === 0) return `${items.length} 项`;
    const shown = names.slice(0, 3).join(" / ");
    const more = names.length > 3 ? "…" : "";
    return `${items.length} 项：${shown}${more}`;
  };

  const projectsSummary = useMemo(
    () => arraySummary(shippedValues, ["name_zh", "name"]),
    [shippedValues]
  );
  const educationsSummary = useMemo(
    () => arraySummary(educationsValues, ["name_zh", "name"]),
    [educationsValues]
  );
  const experiencesSummary = useMemo(
    () => arraySummary(experiencesValues, ["name_zh", "name"]),
    [experiencesValues]
  );
  useEffect(() => {
    if (!slugTouched && nameValue) {
      setValue("homepageSlug", deriveSlug(nameValue), {
        shouldValidate: false,
      });
    }
  }, [nameValue, slugTouched, setValue]);

  // 中国留学生示例（找北美 SDE 实习）
  const fillStudentExample = () => {
    setValue("name", "Wang Xue");
    setValue("name_zh", "王雪");
    setValue("homepageSlug", "Wang_Xue");
    setSlugTouched(true);
    setValue("tagline", "Software engineer · UPenn MS · interested in AI tooling");
    setValue("tagline_zh", "软件工程师 · 宾大硕士在读 · 对 AI 工具方向感兴趣");
    setValue(
      "bio",
      "Wang Xue is a Master of Science in Engineering candidate at the University of Pennsylvania, focusing on systems engineering and AI applications. She previously interned at China Galaxy Securities as a quantitative research intern, where she built backtesting tooling for futures strategies."
    );
    setValue(
      "bio_zh",
      "王雪是宾夕法尼亚大学系统工程方向的硕士在读生，研究方向涉及系统工程与 AI 应用。本科期间曾在中国银河证券担任量化研究实习生，主要负责期货策略回测工具的开发。"
    );
    setValue("email", "wangxue@example.com");
    setValue("linkedin", "linkedin.com/in/wangxue");
    setValue("githubProfile", "github.com/wangxue");
  };

  // 中国转行老师示例
  const fillTeacherExample = () => {
    setValue("name", "Wang Wei");
    setValue("name_zh", "王伟");
    setValue("homepageSlug", "Wang_Wei");
    setSlugTouched(true);
    setValue("tagline", "Educator turned product builder · 8 years of teaching · interested in EdTech");
    setValue("tagline_zh", "高校讲师 · 8 年教学经验 · 正在转型教育科技产品");
    setValue(
      "bio",
      "Wang Wei is a lecturer at a 985 university with 8 years of teaching experience and 12 published papers. He is currently transitioning into product management, with a focus on education technology."
    );
    setValue(
      "bio_zh",
      "王伟是某 985 高校讲师，从事教学工作 8 年，发表论文 12 篇。曾创办教育 SaaS 创业项目（已退出），目前正在向互联网产品方向转型，关注教育科技领域。"
    );
    setValue("email", "wangwei@example.com");
    setValue("linkedin", "linkedin.com/in/wangwei");
  };

  const setThumbError = (idx, msg) => {
    setProjectThumbErrors((prev) => {
      const next = { ...prev };
      if (msg) next[idx] = msg;
      else delete next[idx];
      return next;
    });
  };

  const onProjectThumbChange = (idx, f) => {
    setThumbError(idx, "");
    if (!f) {
      setProjectThumbs((prev) => {
        const cur = prev[idx];
        if (cur?.previewUrl) URL.revokeObjectURL(cur.previewUrl);
        const next = { ...prev };
        delete next[idx];
        return next;
      });
      return;
    }
    const ext = projectAttachmentExt(f);
    if (!ext) {
      setThumbError(idx, "只支持图片（JPG / PNG / WebP）或 PDF。");
      return;
    }
    const kind = ext === "pdf" ? "pdf" : "image";
    const sizeLimit = kind === "pdf" ? 10 * 1024 * 1024 : 3 * 1024 * 1024;
    if (f.size > sizeLimit) {
      setThumbError(
        idx,
        kind === "pdf" ? "PDF 太大（最多 10 MB）。" : "图片太大（最多 3 MB）。"
      );
      return;
    }
    const previewUrl = kind === "image" ? URL.createObjectURL(f) : null;
    setProjectThumbs((prev) => {
      const cur = prev[idx];
      if (cur?.previewUrl) URL.revokeObjectURL(cur.previewUrl);
      return {
        ...prev,
        [idx]: { file: f, ext, kind, previewUrl, fileName: f.name },
      };
    });
  };

  const removeProjectRow = (idx) => {
    remove(idx);
    setProjectThumbs((prev) => {
      const next = {};
      Object.entries(prev).forEach(([k, v]) => {
        const i = Number(k);
        if (i < idx) next[i] = v;
        else if (i === idx) {
          if (v.previewUrl) URL.revokeObjectURL(v.previewUrl);
        } else next[i - 1] = v;
      });
      return next;
    });
    setProjectThumbErrors((prev) => {
      const next = {};
      Object.entries(prev).forEach(([k, v]) => {
        const i = Number(k);
        if (i < idx) next[i] = v;
        else if (i > idx) next[i - 1] = v;
      });
      return next;
    });
  };

  const replaceShippedAndClearThumbs = (newShipped) => {
    setProjectThumbs((prev) => {
      Object.values(prev).forEach((t) => {
        if (t?.previewUrl) URL.revokeObjectURL(t.previewUrl);
      });
      return {};
    });
    setProjectThumbErrors({});
    replace(newShipped);
  };

  const deriveOrKeep = (entity) => ({
    ...entity,
    slug: entity.slug || deriveSlug(entity.name || ""),
  });

  useEffect(() => {
    return () => {
      Object.values(projectThumbs).forEach((t) => {
        if (t?.previewUrl) URL.revokeObjectURL(t.previewUrl);
      });
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onPhotoChange = (f) => {
    setPhotoError("");
    if (!f) {
      setPhotoFile(null);
      setPhotoPreviewUrl("");
      return;
    }
    if (!f.type?.startsWith("image/")) {
      setPhotoError("头像必须是图片（JPG / PNG / WebP）。");
      return;
    }
    if (f.size > 3 * 1024 * 1024) {
      setPhotoError("图片太大（最多 3 MB）。");
      return;
    }
    setPhotoFile(f);
    if (photoPreviewUrl) URL.revokeObjectURL(photoPreviewUrl);
    setPhotoPreviewUrl(URL.createObjectURL(f));
  };

  // 用户粘贴 URL 没带协议时自动补 https://
  const normalizeUrl = (v) => {
    if (!v) return "";
    const trimmed = v.trim();
    if (!trimmed) return "";
    if (/^https?:\/\//i.test(trimmed)) return trimmed;
    return "https://" + trimmed.replace(/^\/+/, "");
  };

  // 一键 hosted 上线：调 /api/publish，写入 Supabase，返回 yourpedia.app/<slug>/
  const handlePublish = async () => {
    setPublishError("");
    setPublishResult(null);
    setPublishStep("publishing");
    try {
      const raw = watch();
      const formData = {
        ...raw,
        linkedin: normalizeUrl(raw.linkedin),
        githubProfile: normalizeUrl(raw.githubProfile),
      };
      if (!formData.name && !formData.name_zh) {
        throw new Error("先填一下姓名再上线。");
      }
      const photoBase64 = photoFile ? await fileToBase64(photoFile) : null;
      const photoExt = photoFile
        ? PHOTO_EXT_BY_TYPE[photoFile.type] || "jpg"
        : null;
      const res = await fetch("/api/publish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ formData, photoBase64, photoExt }),
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || `上线失败（${res.status}）`);
      }
      setPublishResult(json);
      setPublishStep("done");
    } catch (e) {
      setPublishError(e.message || "上线失败，再试一次。");
      setPublishStep("error");
    }
  };

  const handleSupaSignOut = async () => {
    const supabase = getSupabaseBrowserClient();
    await supabase.auth.signOut();
    setSupaUser(null);
    setPublishStep("idle");
    setPublishResult(null);
  };

  const handleDeploy = async () => {
    setDeployError("");
    setDeployResult(null);
    setDeployStep("forking");
    try {
      const raw = watch();
      const formData = {
        ...raw,
        linkedin: normalizeUrl(raw.linkedin),
        githubProfile: normalizeUrl(raw.githubProfile),
        metaBaseUrl: normalizeUrl(raw.metaBaseUrl) || "",
      };
      if (!formData.name || !formData.homepageSlug) {
        throw new Error("先在上面填一下姓名（我们用它来生成 wiki 页面的链接）。");
      }
      const photoBase64 = photoFile ? await fileToBase64(photoFile) : null;
      const photoExt = photoFile
        ? PHOTO_EXT_BY_TYPE[photoFile.type] || "jpg"
        : null;

      const thumbPayload = [];
      for (const [k, t] of Object.entries(projectThumbs)) {
        const idx = Number(k);
        const project = (formData.shipped || [])[idx];
        if (!project?.name) continue;
        thumbPayload.push({
          idx,
          slug: projectSlug(project.name, idx),
          ext: t.ext,
          base64: await fileToBase64(t.file),
        });
      }

      setDeployStep("committing");
      const res = await fetch("/api/deploy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          formData,
          photoBase64,
          photoExt,
          projectThumbs: thumbPayload,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || `上线失败（${res.status}）`);
      }
      setDeployResult(json);
      setDeployStep("done");
    } catch (e) {
      setDeployError(humanizeDeployError(e.message));
      setDeployStep("error");
    }
  };

  // 表单整体 submit 直接走 deploy 路径——只有在用户已经登录 GitHub 时才会触发。
  const onSubmit = async () => {
    if (sessionStatus !== "authenticated") {
      // 未登录的话 submit 按钮已经被替换为登录按钮了，这里兜底
      signIn("github");
      return;
    }
    await handleDeploy();
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate>
      <UploadPanel
        setValue={setValue}
        setSlugTouched={setSlugTouched}
        replaceShipped={replaceShippedAndClearThumbs}
        replaceEducations={replaceEdu}
        replaceExperiences={replaceExp}
        onPdfFileChange={setPdfFile}
      />

      <div className="setup-example-bar">
        <span>不想上传简历？试试用示例填一份看看效果：</span>
        <button type="button" onClick={fillStudentExample} className="setup-button">
          填入「中国留学生」示例
        </button>
        <button
          type="button"
          onClick={fillTeacherExample}
          className="setup-button"
          style={{ marginLeft: 8 }}
        >
          填入「中国教师转行」示例
        </button>
      </div>

      {/* 第二步：核对 + 编辑 */}
      <h2 className="setup-section-heading" style={{ marginTop: 32 }}>
        第二步 · 核对并编辑信息
      </h2>
      <div
        style={{
          marginTop: -8,
          marginBottom: 14,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
          flexWrap: "wrap",
        }}
      >
        <p className="setup-help" style={{ margin: 0 }}>
          英文字段均为选填，仅填中文即可上线。
        </p>
        <label
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            fontSize: "0.9em",
            color: "var(--wiki-text-soft)",
            cursor: "pointer",
            userSelect: "none",
          }}
        >
          <input
            type="checkbox"
            checked={showEnglish}
            onChange={(e) => setShowEnglish(e.target.checked)}
            style={{ margin: 0 }}
          />
          显示英文版字段
        </label>
      </div>

      {/* 个人信息 */}
      <div className="setup-section">
        <h3 className="setup-section-heading">个人信息</h3>

        <div className="setup-field">
          <label className="setup-label setup-label-required">中文姓名</label>
          <input
            {...register("name_zh")}
            className="setup-input"
            placeholder="王雪"
          />
        </div>

        <div className="setup-field">
          <label className="setup-label setup-label-required">英文姓名（用作链接）</label>
          <input
            {...register("name")}
            className="setup-input"
            placeholder="Wang Xue"
          />
          <div className="setup-help">
            用于页面链接（/wiki/Wang_Xue/），可填拼音。
          </div>
          {errors.name && (
            <div className="setup-error">{errors.name.message}</div>
          )}
        </div>

        <div className="setup-field">
          <label className="setup-label">一句话介绍</label>
          <input
            {...register("tagline_zh")}
            className="setup-input"
            placeholder="软件工程师 · 宾大硕士在读 · 关注 AI 工具方向"
          />
        </div>

        <div className="setup-field">
          <label className="setup-label">个人简介</label>
          <textarea
            {...register("bio_zh")}
            rows={5}
            className="setup-textarea"
            placeholder="用第三人称写几段话介绍你自己，像维基百科一样。例如：王雪是宾夕法尼亚大学系统工程方向的硕士在读生..."
          />
          <div className="setup-help">
            用<strong>第三人称</strong>撰写（例："王雪是..."），更像维基百科风格。
          </div>
        </div>

        <div className="setup-field">
          <label className="setup-label">头像（选填）</label>
          <div className="photo-row">
            {photoPreviewUrl && (
              <img
                src={photoPreviewUrl}
                alt="头像预览"
                className="photo-preview"
              />
            )}
            <div className="photo-controls">
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={(e) => onPhotoChange(e.target.files?.[0])}
                className="photo-input"
              />
              {photoFile && (
                <button
                  type="button"
                  onClick={() => onPhotoChange(null)}
                  className="setup-button"
                  style={{ marginLeft: 8 }}
                >
                  移除
                </button>
              )}
            </div>
          </div>
          <div className="setup-help">
            方形，≥600×600，JPG/PNG/WebP，≤3 MB。
          </div>
          {photoError && <div className="setup-error">{photoError}</div>}
        </div>

        {showEnglish && (
          <details className="setup-array-details" style={{ marginTop: 8 }}>
            <summary>英文版（选填）</summary>
            <div className="setup-field" style={{ marginTop: 12 }}>
              <label className="setup-label">英文一句话介绍</label>
              <input
                {...register("tagline")}
                className="setup-input"
                placeholder="Software engineer, UPenn MS, interested in AI tooling"
              />
            </div>
            <div className="setup-field">
              <label className="setup-label">英文简介（bio）</label>
              <textarea
                {...register("bio")}
                rows={4}
                className="setup-textarea"
                placeholder="Write your story in third person, Wikipedia-style..."
              />
            </div>
          </details>
        )}
      </div>

      {/* 联系方式 */}
      <details className="setup-section">
        <summary style={{ cursor: "pointer", padding: "4px 0" }}>
          <h3
            className="setup-section-heading"
            style={{ display: "inline", margin: 0, marginRight: 8 }}
          >
            联系方式（选填，建议至少留一个）
          </h3>
          <span
            style={{
              fontSize: "0.9em",
              color: "var(--wiki-text-soft)",
              fontWeight: "normal",
            }}
          >
            · {contactSummary}
          </span>
        </summary>

        <div className="setup-field">
          <label className="setup-label">邮箱</label>
          <input
            {...register("email")}
            className="setup-input"
            placeholder="wangxue@example.com"
          />
          {errors.email && (
            <div className="setup-error">{errors.email.message}</div>
          )}
        </div>

        <div className="setup-field">
          <label className="setup-label">领英 LinkedIn</label>
          <input
            {...register("linkedin")}
            className="setup-input"
            placeholder="linkedin.com/in/wangxue"
          />
          <div className="setup-help">
            粘贴链接或路径，无需 https://。
          </div>
          {errors.linkedin && (
            <div className="setup-error">{errors.linkedin.message}</div>
          )}
        </div>

        <div className="setup-field">
          <label className="setup-label">GitHub</label>
          <input
            {...register("githubProfile")}
            className="setup-input"
            placeholder="github.com/wangxue"
          />
          {errors.githubProfile && (
            <div className="setup-error">{errors.githubProfile.message}</div>
          )}
        </div>
      </details>

      {/* 项目作品 */}
      <details className="setup-section">
        <summary style={{ cursor: "pointer", padding: "4px 0" }}>
          <h3
            className="setup-section-heading"
            style={{ display: "inline", margin: 0, marginRight: 8 }}
          >
            项目作品（选填，每个生成独立 wiki 页）
          </h3>
          <span
            style={{
              fontSize: "0.9em",
              color: "var(--wiki-text-soft)",
              fontWeight: "normal",
            }}
          >
            · {projectsSummary}
          </span>
        </summary>

        {fields.map((field, idx) => {
          const thumb = projectThumbs[idx];
          const thumbErr = projectThumbErrors[idx];
          return (
            <div key={field.id} className="setup-array-row">
              <div>
                <label className="setup-label">项目名</label>
                <input
                  {...register(`shipped.${idx}.name`)}
                  className="setup-input"
                  placeholder="ProjectOne"
                />
              </div>
              <div>
                <label className="setup-label">一句话简介</label>
                <input
                  {...register(`shipped.${idx}.description`)}
                  className="setup-input"
                  placeholder="开源命令行工具，2024 年发布"
                />
              </div>
              <button
                type="button"
                onClick={() => removeProjectRow(idx)}
                className="setup-button"
              >
                删除
              </button>
              <div className="project-thumb-row">
                {thumb?.kind === "image" && thumb.previewUrl && (
                  <img
                    src={thumb.previewUrl}
                    alt=""
                    className="project-thumb-preview"
                  />
                )}
                {thumb?.kind === "pdf" && (
                  <div
                    className="project-thumb-preview project-thumb-pdf"
                    title={thumb.fileName}
                  >
                    <span className="project-thumb-pdf-name">
                      {thumb.fileName.length > 22
                        ? thumb.fileName.slice(0, 19) + "…"
                        : thumb.fileName}
                    </span>
                  </div>
                )}
                <div className="project-thumb-controls">
                  <label className="setup-label">
                    缩略图或 PDF（选填）
                  </label>
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp,application/pdf"
                    onChange={(e) =>
                      onProjectThumbChange(idx, e.target.files?.[0])
                    }
                    className="photo-input"
                  />
                  {thumb && (
                    <button
                      type="button"
                      onClick={() => onProjectThumbChange(idx, null)}
                      className="setup-button"
                      style={{ marginLeft: 8 }}
                    >
                      移除
                    </button>
                  )}
                  <div className="setup-help">
                    图片 ≤3 MB 显示在右侧；PDF ≤10 MB 显示为下载链接。
                  </div>
                  {thumbErr && (
                    <div className="setup-error">{thumbErr}</div>
                  )}
                </div>
              </div>
              <details
                className="setup-array-details"
                style={{ gridColumn: "1 / -1", marginTop: 6 }}
              >
                <summary>更多字段（角色 / 时间 / 链接 / 详情）</summary>
                <div className="setup-field-row" style={{ marginTop: 10 }}>
                  <div>
                    <label className="setup-label">担任角色</label>
                    <input
                      {...register(`shipped.${idx}.role`)}
                      className="setup-input"
                      placeholder="主创 / 后端开发 / 设计"
                    />
                  </div>
                  <div>
                    <label className="setup-label">时间</label>
                    <input
                      {...register(`shipped.${idx}.date_range`)}
                      className="setup-input"
                      placeholder="2024 春"
                    />
                  </div>
                </div>
                <div className="setup-field" style={{ marginTop: 10 }}>
                  <label className="setup-label">项目链接</label>
                  <input
                    {...register(`shipped.${idx}.url`)}
                    className="setup-input"
                    placeholder="github.com/yourname/projectone"
                  />
                </div>
                <div className="setup-field" style={{ marginTop: 10 }}>
                  <label className="setup-label">详细介绍（中文）</label>
                  <textarea
                    {...register(`shipped.${idx}.body_zh`)}
                    rows={3}
                    className="setup-textarea"
                    placeholder="项目背景、解决了什么问题、技术方案、产出..."
                  />
                </div>
                {showEnglish && (
                  <>
                    <div className="setup-field" style={{ marginTop: 10 }}>
                      <label className="setup-label">英文版简介（选填）</label>
                      <input
                        {...register(`shipped.${idx}.description`)}
                        className="setup-input"
                        placeholder="open-source dev console (2024)"
                      />
                    </div>
                    <div className="setup-field" style={{ marginTop: 10 }}>
                      <label className="setup-label">英文详情（选填）</label>
                      <textarea
                        {...register(`shipped.${idx}.body`)}
                        rows={3}
                        className="setup-textarea"
                        placeholder="Project background, problem, approach, outcome..."
                      />
                    </div>
                  </>
                )}
              </details>
            </div>
          );
        })}

        <button
          type="button"
          onClick={() =>
            append(
              deriveOrKeep({
                name: "",
                slug: "",
                description: "",
                description_zh: "",
              })
            )
          }
          className="setup-button-add"
        >
          + 添加一个项目
        </button>
      </details>

      {/* 教育经历 */}
      <details className="setup-section">
        <summary style={{ cursor: "pointer", padding: "4px 0" }}>
          <h3
            className="setup-section-heading"
            style={{ display: "inline", margin: 0, marginRight: 8 }}
          >
            教育经历（选填，每段生成学校独立 wiki 页）
          </h3>
          <span
            style={{
              fontSize: "0.9em",
              color: "var(--wiki-text-soft)",
              fontWeight: "normal",
            }}
          >
            · {educationsSummary}
          </span>
        </summary>
        {eduFields.map((field, idx) => (
          <div key={field.id} className="setup-array-row">
            <div>
              <label className="setup-label">学校</label>
              <input
                {...register(`educations.${idx}.name_zh`)}
                className="setup-input"
                placeholder="宾夕法尼亚大学"
              />
              {showEnglish && (
                <input
                  {...register(`educations.${idx}.name`)}
                  className="setup-input"
                  placeholder="University of Pennsylvania"
                  onBlur={(e) => {
                    const cur = watch(`educations.${idx}.slug`);
                    if (!cur && e.target.value) {
                      setValue(
                        `educations.${idx}.slug`,
                        deriveSlug(e.target.value),
                        { shouldValidate: false }
                      );
                    }
                  }}
                  style={{ marginTop: 6 }}
                />
              )}
            </div>
            <div>
              <label className="setup-label">学位 / 专业</label>
              <input
                {...register(`educations.${idx}.degree_zh`)}
                className="setup-input"
                placeholder="系统工程硕士"
              />
              {showEnglish && (
                <input
                  {...register(`educations.${idx}.degree`)}
                  className="setup-input"
                  placeholder="MSE in Systems Engineering"
                  style={{ marginTop: 6 }}
                />
              )}
            </div>
            <button
              type="button"
              onClick={() => removeEdu(idx)}
              className="setup-button"
            >
              删除
            </button>
            <details
              className="setup-array-details"
              style={{ gridColumn: "1 / -1", marginTop: 6 }}
            >
              <summary>更多字段（时间 / 地点 / 详情）</summary>
              <div className="setup-field-row" style={{ marginTop: 10 }}>
                <div>
                  <label className="setup-label">时间</label>
                  <input
                    {...register(`educations.${idx}.date_range`)}
                    className="setup-input"
                    placeholder="2025 年 8 月 – 2027 年 8 月（在读）"
                  />
                </div>
                <div>
                  <label className="setup-label">地点</label>
                  <input
                    {...register(`educations.${idx}.location`)}
                    className="setup-input"
                    placeholder="美国宾夕法尼亚州费城"
                  />
                </div>
              </div>
              <div className="setup-field" style={{ marginTop: 10 }}>
                <label className="setup-label">详情（中文）</label>
                <textarea
                  {...register(`educations.${idx}.body_zh`)}
                  rows={3}
                  className="setup-textarea"
                  placeholder="学习方向、核心课程、学术活动、奖项..."
                />
              </div>
            </details>
          </div>
        ))}
        <button
          type="button"
          onClick={() =>
            appendEdu(
              deriveOrKeep({
                name: "",
                slug: "",
                degree: "",
                date_range: "",
                location: "",
              })
            )
          }
          className="setup-button-add"
        >
          + 添加一段教育经历
        </button>
      </details>

      {/* 工作经历 */}
      <details className="setup-section">
        <summary style={{ cursor: "pointer", padding: "4px 0" }}>
          <h3
            className="setup-section-heading"
            style={{ display: "inline", margin: 0, marginRight: 8 }}
          >
            工作经历（选填，每段生成公司独立 wiki 页）
          </h3>
          <span
            style={{
              fontSize: "0.9em",
              color: "var(--wiki-text-soft)",
              fontWeight: "normal",
            }}
          >
            · {experiencesSummary}
          </span>
        </summary>
        {expFields.map((field, idx) => (
          <div key={field.id} className="setup-array-row">
            <div>
              <label className="setup-label">公司</label>
              <input
                {...register(`experiences.${idx}.name_zh`)}
                className="setup-input"
                placeholder="中国银河证券"
              />
              {showEnglish && (
                <input
                  {...register(`experiences.${idx}.name`)}
                  className="setup-input"
                  placeholder="China Galaxy Securities"
                  onBlur={(e) => {
                    const cur = watch(`experiences.${idx}.slug`);
                    if (!cur && e.target.value) {
                      setValue(
                        `experiences.${idx}.slug`,
                        deriveSlug(e.target.value),
                        { shouldValidate: false }
                      );
                    }
                  }}
                  style={{ marginTop: 6 }}
                />
              )}
            </div>
            <div>
              <label className="setup-label">职位</label>
              <input
                {...register(`experiences.${idx}.role_zh`)}
                className="setup-input"
                placeholder="量化研究实习生"
              />
              {showEnglish && (
                <input
                  {...register(`experiences.${idx}.role`)}
                  className="setup-input"
                  placeholder="Quantitative Research Intern"
                  style={{ marginTop: 6 }}
                />
              )}
            </div>
            <button
              type="button"
              onClick={() => removeExp(idx)}
              className="setup-button"
            >
              删除
            </button>
            <details
              className="setup-array-details"
              style={{ gridColumn: "1 / -1", marginTop: 6 }}
            >
              <summary>更多字段（时间 / 地点 / 详情）</summary>
              <div className="setup-field-row" style={{ marginTop: 10 }}>
                <div>
                  <label className="setup-label">时间</label>
                  <input
                    {...register(`experiences.${idx}.date_range`)}
                    className="setup-input"
                    placeholder="2024 年夏"
                  />
                </div>
                <div>
                  <label className="setup-label">地点</label>
                  <input
                    {...register(`experiences.${idx}.location`)}
                    className="setup-input"
                    placeholder="上海"
                  />
                </div>
              </div>
              <div className="setup-field" style={{ marginTop: 10 }}>
                <label className="setup-label">详情（中文）</label>
                <textarea
                  {...register(`experiences.${idx}.body_zh`)}
                  rows={3}
                  className="setup-textarea"
                  placeholder="负责的项目、产出、技术栈、合作团队..."
                />
              </div>
            </details>
          </div>
        ))}
        <button
          type="button"
          onClick={() =>
            appendExp(
              deriveOrKeep({
                name: "",
                slug: "",
                role: "",
                date_range: "",
                location: "",
              })
            )
          }
          className="setup-button-add"
        >
          + 添加一段工作经历
        </button>
      </details>

      {/* 高级设置——已 deploy 后再回来填 */}
      <details className="setup-advanced">
        <summary>
          <span className="setup-advanced-title">高级设置（一般不用动）</span>
          <span className="setup-advanced-hint">
            站点名称 · 仓库名 · 域名（可后改）
          </span>
        </summary>

        <div className="setup-field" style={{ marginTop: 14 }}>
          <label className="setup-label">站点名称</label>
          <input
            {...register("siteName")}
            className="setup-input"
            placeholder="Yourpedia"
          />
          <div className="setup-help">
            显示在网站顶部，如 "Wangpedia"。
          </div>
          {errors.siteName && (
            <div className="setup-error">{errors.siteName.message}</div>
          )}
        </div>

        <div className="setup-field">
          <label className="setup-label">个人主页 slug</label>
          <input
            {...register("homepageSlug")}
            onChange={(e) => {
              setSlugTouched(true);
              register("homepageSlug").onChange(e);
            }}
            className="setup-input"
            placeholder="Wang_Xue"
          />
          <div className="setup-help">
            主页 URL 后缀（/wiki/Wang_Xue/），自动生成。
          </div>
          {errors.homepageSlug && (
            <div className="setup-error">{errors.homepageSlug.message}</div>
          )}
        </div>

        <div className="setup-field">
          <label className="setup-label">站点域名</label>
          <input
            {...register("metaBaseUrl")}
            className="setup-input"
            placeholder="your-site.vercel.app"
          />
          <div className="setup-help">
            上线后的网址（如 wangxue.vercel.app），未上线可留空。
          </div>
          {errors.metaBaseUrl && (
            <div className="setup-error">{errors.metaBaseUrl.message}</div>
          )}
        </div>

        <div className="setup-field-row">
          <div className="setup-field">
            <label className="setup-label">GitHub 用户名</label>
            <input
              {...register("githubOwner")}
              className="setup-input"
              placeholder="your-github-username"
            />
          </div>
          <div className="setup-field">
            <label className="setup-label">GitHub 仓库名</label>
            <input
              {...register("githubRepo")}
              className="setup-input"
              placeholder="your-wiki-repo"
            />
          </div>
        </div>
        <div className="setup-help">
          用于页面顶部 "查看源代码 / 历史" 链接，上线后再填。
        </div>
      </details>

      {/* 第三步：预览 + 上线 */}
      <div className="setup-section deploy-block" style={{ marginTop: 36 }}>
        <h2 className="setup-section-heading">第三步 · 预览并上线</h2>

        <div className="setup-submit-row">
          <button
            type="button"
            onClick={() => {
              const current = watch();
              const normalized = {
                ...current,
                linkedin: normalizeUrl(current.linkedin),
                githubProfile: normalizeUrl(current.githubProfile),
              };
              setPreviewData(
                enrichShipped(normalized, projectThumbs, "preview")
              );
              setPreviewOpen(true);
            }}
            className="setup-button setup-button-secondary"
          >
            预览 & 修改 wiki
          </button>
        </div>

        {/* —— 主推路径：Yourpedia hosted —— */}
        <p className="setup-help" style={{ marginTop: 16, marginBottom: 14 }}>
          点下面按钮，我们直接给你一个可分享的链接：
          <strong>yourpedia.app/你的名字</strong>。30 秒上线，不用 GitHub、不用部署、不用敲命令。
        </p>

        {supaUserLoading && (
          <div className="setup-help">正在检查登录状态…</div>
        )}

        {!supaUserLoading && !supaUser && (
          <>
            <a
              href="/login?next=/setup/"
              className="deploy-action-button"
              style={{ display: "inline-block", textDecoration: "none" }}
            >
              登录后一键上线我的网站
            </a>
            <div className="setup-help" style={{ marginTop: 8 }}>
              用邮箱登录就行（不需要密码）。我们给你发一封登录链接邮件，点链接回来就能上线。
            </div>
          </>
        )}

        {!supaUserLoading && supaUser && publishStep === "idle" && (
          <div>
            <div className="deploy-signed-in">
              <span>
                已登录：<strong>{supaUser.email}</strong>
              </span>
              <button
                type="button"
                onClick={handleSupaSignOut}
                className="deploy-signout-link"
              >
                换个邮箱
              </button>
            </div>
            <button
              type="button"
              onClick={handlePublish}
              className="deploy-action-button"
            >
              一键上线我的网站
            </button>
          </div>
        )}

        {publishStep === "publishing" && (
          <div className="deploy-progress">
            <div className="deploy-step is-active">
              <span className="deploy-step-dot">1</span>
              <span>正在为你创建网站…</span>
            </div>
          </div>
        )}

        {publishStep === "done" && publishResult && (
          <div className="deploy-result">
            <div className="deploy-result-title">
              你的网站已经上线了
            </div>
            <p className="setup-help" style={{ marginBottom: 10 }}>
              链接：{" "}
              <a
                href={publishResult.url}
                target="_blank"
                rel="noreferrer"
                className="deploy-card-link"
                style={{ fontSize: 16, fontWeight: 600 }}
              >
                {typeof window !== "undefined" ? window.location.host : ""}
                {publishResult.url}
              </a>
              {publishResult.isFirstPublish ? (
                <em>（第一次发布，直接打开看看）</em>
              ) : (
                <em>（已更新，最迟 60 秒生效）</em>
              )}
            </p>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
              <a
                href={publishResult.url}
                target="_blank"
                rel="noreferrer"
                className="deploy-vercel-button"
              >
                打开我的网站 →
              </a>
              <button
                type="button"
                onClick={() => {
                  if (typeof window !== "undefined") {
                    const fullUrl = window.location.origin + publishResult.url;
                    navigator.clipboard?.writeText(fullUrl);
                  }
                }}
                className="setup-button"
              >
                复制链接
              </button>
            </div>
            <div className="setup-help" style={{ marginTop: 12 }}>
              这个链接你可以直接放进领英 / 小红书 / 简历里。链接就是你的网站，不用再做别的。
              <br />
              想改内容？回到这个页面改完表单，再点一次「一键上线」就行。
            </div>

            <div className="setup-help" style={{ marginTop: 14, paddingTop: 14, borderTop: "1px solid var(--wiki-border)" }}>
              觉得 Yourpedia 好用？
              <a
                href="https://github.com/wangxuzhou666-arch/colarpedia-setup"
                target="_blank"
                rel="noreferrer"
                style={{ marginLeft: 4 }}
              >
                给项目点个 star →
              </a>
            </div>

            <details className="setup-array-details" style={{ marginTop: 14 }}>
              <summary>想用自己的域名（如 wangxue.com）？</summary>
              <div className="setup-help" style={{ marginTop: 10 }}>
                目前 hosted 版本暂不支持自定义域名（M5 会加）。
                如果你现在就需要自己域名，可以走下面的「导出到 GitHub」选项，
                把 wiki 部署到你自己的 Vercel 项目，再绑域名。
              </div>
            </details>
          </div>
        )}

        {publishStep === "error" && (
          <div className="deploy-error">
            <strong>上线失败：</strong>{publishError}
            <div style={{ marginTop: 8 }}>
              <button
                type="button"
                onClick={() => {
                  setPublishStep("idle");
                  setPublishError("");
                }}
                className="setup-button"
              >
                再试一次
              </button>
            </div>
          </div>
        )}
      </div>

      {/* —— 进阶路径：导出到自己的 GitHub（折叠默认） —— */}
      <details className="setup-advanced" style={{ marginTop: 24 }}>
        <summary>
          <span className="setup-advanced-title">想自己掌控？导出到你的 GitHub</span>
          <span className="setup-advanced-hint">
            适合开发者：fork 模板 + 提交内容到你的 GitHub + Vercel 部署，代码完全归你
          </span>
        </summary>
        <div className="setup-section deploy-block" style={{ marginTop: 14 }}>

        <p className="setup-help" style={{ marginTop: 0, marginBottom: 14 }}>
          点下面按钮，我们会自动帮你：
          <strong>① 在你 GitHub 复制一份模板</strong> →
          <strong>② 把你的 wiki 内容提交进去</strong> →
          <strong>③ 给你一个 Vercel 部署按钮</strong>。
        </p>

        {sessionStatus === "loading" && (
          <div className="setup-help">正在检查你的 GitHub 登录状态…</div>
        )}

        {sessionStatus === "unauthenticated" && (
          <>
            <button
              type="button"
              onClick={() => signIn("github")}
              className="deploy-github-button"
            >
              <svg
                viewBox="0 0 24 24"
                width="18"
                height="18"
                fill="currentColor"
                aria-hidden="true"
              >
                <path d="M12 .5C5.65.5.5 5.65.5 12.05c0 5.1 3.3 9.42 7.88 10.95.58.1.79-.25.79-.55v-2.07c-3.2.7-3.88-1.37-3.88-1.37-.52-1.32-1.27-1.67-1.27-1.67-1.04-.71.08-.7.08-.7 1.15.08 1.76 1.18 1.76 1.18 1.02 1.75 2.69 1.24 3.34.95.1-.74.4-1.24.72-1.53-2.55-.29-5.23-1.27-5.23-5.66 0-1.25.45-2.27 1.18-3.07-.12-.29-.51-1.46.11-3.05 0 0 .96-.31 3.15 1.17.92-.25 1.9-.38 2.88-.38s1.96.13 2.88.38c2.19-1.48 3.15-1.17 3.15-1.17.62 1.59.23 2.76.11 3.05.74.8 1.18 1.82 1.18 3.07 0 4.4-2.69 5.36-5.25 5.65.41.36.78 1.06.78 2.13v3.16c0 .31.2.66.79.55C20.2 21.46 23.5 17.15 23.5 12.05 23.5 5.65 18.35.5 12 .5z" />
              </svg>
              <span>用 GitHub 账号登录并上线</span>
            </button>
            <div className="setup-help" style={{ marginTop: 8 }}>
              还没有 GitHub 账号？<a
                href="https://github.com/signup"
                target="_blank"
                rel="noreferrer"
                className="deploy-card-link"
              >点这里 30 秒注册一个 →</a>
              （免费，邮箱验证就行）
            </div>
          </>
        )}

        {sessionStatus === "authenticated" && deployStep === "idle" && (
          <div>
            <div className="deploy-signed-in">
              <span>
                已登录 GitHub：
                <strong>@{session.user?.githubLogin || session.user?.name}</strong>
              </span>
              <button
                type="button"
                onClick={() => signOut({ redirect: false })}
                className="deploy-signout-link"
              >
                切换账号
              </button>
            </div>
            <button
              type="button"
              onClick={handleDeploy}
              className="deploy-action-button"
            >
              部署到我的 GitHub + Vercel
            </button>
          </div>
        )}

        {(deployStep === "forking" || deployStep === "committing") && (
          <div className="deploy-progress">
            <div
              className={`deploy-step ${deployStep === "forking" ? "is-active" : "is-done"}`}
            >
              <span className="deploy-step-dot">1</span>
              <span>正在你的 GitHub 复制模板仓库…</span>
            </div>
            <div
              className={`deploy-step ${deployStep === "committing" ? "is-active" : "is-pending"}`}
            >
              <span className="deploy-step-dot">2</span>
              <span>正在把你的 wiki 内容提交进去…</span>
            </div>
            <div className="deploy-step is-pending">
              <span className="deploy-step-dot">3</span>
              <span>准备 Vercel 上线链接…</span>
            </div>
          </div>
        )}

        {deployStep === "done" && deployResult && (
          <div className="deploy-result">
            <div className="deploy-result-title">
              你的 wiki 已经在 GitHub 上了，再点一下就上线
            </div>
            <p className="setup-help" style={{ marginBottom: 10 }}>
              GitHub 仓库：{" "}
              <a
                href={deployResult.forkUrl}
                target="_blank"
                rel="noreferrer"
                className="deploy-card-link"
              >
                {deployResult.forkUrl.replace("https://github.com/", "")}
              </a>{" "}
              · 已提交 {deployResult.operations?.length || 0} 个文件
              {deployResult.forkExisted && (
                <em>（之前已经有这个仓库了，本次是覆盖更新）</em>
              )}
            </p>
            <a
              href={deployResult.vercelDeployUrl}
              target="_blank"
              rel="noreferrer"
              className="deploy-vercel-button"
            >
              在 Vercel 上线 →
            </a>
            <div className="setup-help" style={{ marginTop: 10 }}>
              点击上面按钮，会跳到 Vercel：登录（用 GitHub 账号一键登录就行，免费、不用信用卡），
              然后按 "Deploy" 按钮，等大概 30 秒就上线了。
            </div>

            <details className="setup-array-details" style={{ marginTop: 14 }}>
              <summary>上线后想换成自己的域名（如 wangxue.com）？</summary>
              <div className="setup-help" style={{ marginTop: 10 }}>
                <ol style={{ paddingLeft: 20, lineHeight: 1.7 }}>
                  <li>在阿里云 / 腾讯云 / Namecheap 等买一个域名（一般 ¥50-100/年）。</li>
                  <li>进入 Vercel → 你的项目 → Settings → Domains，输入你的域名点 Add。</li>
                  <li>Vercel 会告诉你要改 DNS 的 A 记录或 CNAME，把它复制到你买域名的网站后台。</li>
                  <li>等 5-30 分钟生效，你的 wiki 就在 wangxue.com 上线了。</li>
                </ol>
                <p style={{ marginTop: 10 }}>
                  不绑域名也可以，Vercel 会给你一个 *.vercel.app 的免费子域名，照样能用。
                </p>
              </div>
            </details>
          </div>
        )}

        {deployStep === "error" && (
          <div className="deploy-error">
            <strong>上线失败：</strong>{deployError}
            <div style={{ marginTop: 8 }}>
              <button
                type="button"
                onClick={() => {
                  setDeployStep("idle");
                  setDeployError("");
                }}
                className="setup-button"
              >
                再试一次
              </button>
            </div>
          </div>
        )}
        </div>
      </details>

      {previewOpen && previewData && (
        <PreviewModal
          data={previewData}
          photoPreviewUrl={photoPreviewUrl}
          files={{ photoFile, pdfFile }}
          onApplyPolish={(section, idx, patch) => {
            for (const [field, value] of Object.entries(patch)) {
              setValue(`${section}.${idx}.${field}`, value, {
                shouldDirty: true,
                shouldValidate: false,
              });
            }
            const fresh = watch();
            setPreviewData(
              enrichShipped(
                {
                  ...fresh,
                  linkedin: normalizeUrl(fresh.linkedin),
                  githubProfile: normalizeUrl(fresh.githubProfile),
                },
                projectThumbs,
                "preview"
              )
            );
          }}
          onClose={() => setPreviewOpen(false)}
        />
      )}
    </form>
  );
}
