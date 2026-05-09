"use client";

import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useState } from "react";
import { useSession, signIn, signOut } from "next-auth/react";
import { setupSchema, deriveSlug } from "../lib/schema";
import { generateZip, triggerDownload } from "../lib/generator";
import UploadPanel from "./UploadPanel";
import PreviewModal from "./PreviewModal";

// Project-thumbnail slug. Falls back to project_<idx> if the project
// hasn't been named yet — keeps the file path stable so the user can
// upload a thumbnail before typing the name.
function projectSlug(name, idx) {
  const fromName = deriveSlug(name);
  return fromName || `project_${idx + 1}`;
}

// Decorate shipped[] with a thumbnailPath the wikiPageTemplate can
// embed. mode="live" → /projects/<slug>.<ext> (zip + GitHub fork);
// mode="preview" → blob: URL for images, fake relative path for PDFs
// (PDFs have no cheap browser preview — the link visually confirms
// "a PDF link will appear here on the live site"; clicking 404s, fine
// for preview).
function enrichShipped(data, thumbsByIdx, mode) {
  return {
    ...data,
    shipped: (data.shipped || []).map((s, idx) => {
      const t = thumbsByIdx[idx];
      if (!t) return s;
      const slug = projectSlug(s.name, idx);
      let path;
      if (mode === "preview") {
        path =
          t.kind === "image"
            ? t.previewUrl
            : `${slug}.pdf`;
      } else {
        path = `/projects/${slug}.${t.ext}`;
      }
      return { ...s, thumbnailPath: path };
    }),
  };
}

// Convert a File blob to base64 (no data: URL prefix).
function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result || "");
      const comma = result.indexOf(",");
      resolve(comma >= 0 ? result.slice(comma + 1) : result);
    };
    reader.onerror = () => reject(new Error("Failed to read photo file"));
    reader.readAsDataURL(file);
  });
}

const PHOTO_EXT_BY_TYPE = {
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

// Per-project attachment can be an image OR a PDF. PDFs are linked
// from the bio's Notable works line; images become inline thumbnails.
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
  return /^(jpg|jpeg|png|webp|pdf)$/.test(tail) ? tail.replace("jpeg", "jpg") : null;
}

export default function SetupForm() {
  const [generating, setGenerating] = useState(false);
  const [done, setDone] = useState(false);
  const [pdfFile, setPdfFile] = useState(null);
  const [photoFile, setPhotoFile] = useState(null);
  const [photoPreviewUrl, setPhotoPreviewUrl] = useState("");
  const [photoError, setPhotoError] = useState("");
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewData, setPreviewData] = useState(null);
  // Project thumbnails — keyed by shipped[] idx. Stored outside the
  // form because File objects don't survive zod / RHF, and useFieldArray
  // doesn't know about per-row file uploads.
  const [projectThumbs, setProjectThumbs] = useState({});
  const [projectThumbErrors, setProjectThumbErrors] = useState({});
  // Phase 1C — GitHub deploy state
  const { data: session, status: sessionStatus } = useSession();
  const [deployStep, setDeployStep] = useState("idle"); // idle | forking | committing | done | error
  const [deployResult, setDeployResult] = useState(null);
  const [deployError, setDeployError] = useState("");

  const {
    register,
    handleSubmit,
    control,
    watch,
    setValue,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(setupSchema),
    // onTouched: only validate fields the user has actually interacted
    // with. Prevents stale errors from sticking around after schema
    // changes (Phase 1B v2 has been iterating quickly on validation),
    // and stops LLM-auto-filled fields from being flagged before the
    // user has even seen them.
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
  useEffect(() => {
    if (!slugTouched && nameValue) {
      setValue("homepageSlug", deriveSlug(nameValue), {
        shouldValidate: false,
      });
    }
  }, [nameValue, slugTouched, setValue]);

  const fillExample = () => {
    setValue("name", "Jane Doe");
    setValue("homepageSlug", "Jane_Doe");
    setSlugTouched(true);
    setValue(
      "tagline",
      "Software engineer, writer, and occasional illustrator"
    );
    setValue(
      "bio",
      "Doe began her career at a small open-source tools startup in Berlin, where she shipped a developer console used by tens of thousands of teams. She has written essays on the relationship between toolmaking and craft."
    );
    setValue("siteName", "Doepedia");
    setValue("metaBaseUrl", "https://janedoe.example.com");
    setValue("githubOwner", "janedoe");
    setValue("githubRepo", "janedoe-wiki");
    setValue("email", "jane@example.com");
    setValue("linkedin", "https://www.linkedin.com/in/janedoe/");
    setValue("githubProfile", "https://github.com/janedoe");
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
      setThumbError(idx, "Use an image (JPG / PNG / WebP) or a PDF.");
      return;
    }
    const kind = ext === "pdf" ? "pdf" : "image";
    const sizeLimit = kind === "pdf" ? 10 * 1024 * 1024 : 3 * 1024 * 1024;
    if (f.size > sizeLimit) {
      setThumbError(
        idx,
        kind === "pdf" ? "PDF too large (max 10 MB)." : "Image too large (max 3 MB)."
      );
      return;
    }
    // Only images get a blob preview URL — PDFs render as a labeled
    // card in the form (no browser-cheap PDF thumbnail rendering).
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

  // useFieldArray's `remove(idx)` shifts subsequent rows down by one.
  // Mirror that shift in the thumbs map so each thumb stays paired with
  // its row.
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

  // The LLM upload path calls replace() to wholesale-reset shipped[].
  // The previous thumbs were attached to projects that no longer exist,
  // so nuke them — the user re-uploads against the new rows.
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

  // Auto-derive slug from name on add (user can override).
  const deriveOrKeep = (entity) => ({
    ...entity,
    slug: entity.slug || deriveSlug(entity.name || ""),
  });

  // Revoke any blob URLs still alive when the form unmounts (zip/deploy
  // paths don't release them on success — preview re-uses them).
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
      setPhotoError("Photo must be an image (JPG / PNG / WebP).");
      return;
    }
    if (f.size > 3 * 1024 * 1024) {
      setPhotoError("Photo too large (max 3 MB).");
      return;
    }
    setPhotoFile(f);
    if (photoPreviewUrl) URL.revokeObjectURL(photoPreviewUrl);
    setPhotoPreviewUrl(URL.createObjectURL(f));
  };

  // Auto-normalize URL-ish fields users pasted without a protocol.
  // "linkedin.com/in/me" -> "https://linkedin.com/in/me"
  const normalizeUrl = (v) => {
    if (!v) return "";
    const trimmed = v.trim();
    if (!trimmed) return "";
    if (/^https?:\/\//i.test(trimmed)) return trimmed;
    return "https://" + trimmed.replace(/^\/+/, "");
  };

  const handleDeploy = async () => {
    setDeployError("");
    setDeployResult(null);
    setDeployStep("forking");
    try {
      const raw = watch();
      // Same normalization the zip path uses, so the Vercel deploy
      // gets clean URLs.
      const formData = {
        ...raw,
        linkedin: normalizeUrl(raw.linkedin),
        githubProfile: normalizeUrl(raw.githubProfile),
        metaBaseUrl: normalizeUrl(raw.metaBaseUrl) || "",
      };
      if (!formData.name || !formData.homepageSlug) {
        throw new Error(
          "Please fill in your name (we use it for the slug)."
        );
      }
      const photoBase64 = photoFile ? await fileToBase64(photoFile) : null;
      const photoExt = photoFile
        ? PHOTO_EXT_BY_TYPE[photoFile.type] || "jpg"
        : null;

      // Build the projectThumbs payload the server expects:
      // [{ idx, slug, ext, base64 }]. Skip rows whose project name is
      // empty (slug would collide with project_<n> fallback, which is
      // ugly; better the user names the project first).
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
        throw new Error(json.error || `Deploy failed (${res.status})`);
      }
      setDeployResult(json);
      setDeployStep("done");
    } catch (e) {
      setDeployError(e.message || "Deploy failed.");
      setDeployStep("error");
    }
  };

  const onSubmit = async (rawData) => {
    setGenerating(true);
    setDone(false);
    try {
      const normalized = {
        ...rawData,
        linkedin: normalizeUrl(rawData.linkedin),
        githubProfile: normalizeUrl(rawData.githubProfile),
        metaBaseUrl: normalizeUrl(rawData.metaBaseUrl) || "https://example.com",
        githubOwner: rawData.githubOwner || "your-github-username",
        githubRepo: rawData.githubRepo || "your-wiki-repo",
      };
      // Decorate shipped[] so wikiPageTemplate emits <img> tags pointing
      // at /projects/<slug>.<ext> in the deployed site.
      const data = enrichShipped(normalized, projectThumbs, "live");

      // Build the projectThumbs the zip generator expects:
      // [{ slug, ext, file }]. Filter out rows without a project name.
      const zipThumbs = Object.entries(projectThumbs)
        .map(([k, t]) => {
          const idx = Number(k);
          const project = (normalized.shipped || [])[idx];
          if (!project?.name) return null;
          return {
            slug: projectSlug(project.name, idx),
            ext: t.ext,
            file: t.file,
          };
        })
        .filter(Boolean);

      const blob = await generateZip(data, {
        pdfFile,
        photoFile,
        projectThumbs: zipThumbs,
      });
      const zipName = (data.siteName || "yourpedia").toLowerCase().replace(/[^a-z0-9]/g, "");
      triggerDownload(blob, `${zipName}-${data.homepageSlug}.zip`);
      setDone(true);
    } catch (e) {
      alert("Generation failed: " + e.message);
    } finally {
      setGenerating(false);
    }
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
        <span>Or skip the upload and fill manually:</span>
        <button type="button" onClick={fillExample} className="setup-button">
          Fill with Jane Doe
        </button>
      </div>

      {/* Identity */}
      <div className="setup-section">
        <h2 className="setup-section-heading">Identity</h2>

        <div className="setup-field">
          <label className="setup-label setup-label-required">Full name</label>
          <input
            {...register("name")}
            className="setup-input"
            placeholder="Jane Doe"
          />
          {errors.name && (
            <div className="setup-error">{errors.name.message}</div>
          )}
        </div>

        <div className="setup-field">
          <label className="setup-label setup-label-required">
            Homepage slug
          </label>
          <input
            {...register("homepageSlug")}
            onChange={(e) => {
              setSlugTouched(true);
              register("homepageSlug").onChange(e);
            }}
            className="setup-input"
            placeholder="Jane_Doe"
          />
          <div className="setup-help">
            URL slug for your bio page (e.g. /wiki/Jane_Doe/). Use
            Title_Case_With_Underscores. Auto-derived from your name.
          </div>
          {errors.homepageSlug && (
            <div className="setup-error">{errors.homepageSlug.message}</div>
          )}
        </div>

        <div className="setup-field">
          <label className="setup-label">One-line tagline</label>
          <input
            {...register("tagline")}
            className="setup-input"
            placeholder="Software engineer, writer, and occasional illustrator"
          />
        </div>

        <div className="setup-field">
          <label className="setup-label">Bio (free-form prose)</label>
          <textarea
            {...register("bio")}
            rows={5}
            className="setup-textarea"
            placeholder="Write your story Wikipedia-style. Third person. A few paragraphs."
          />
        </div>

        <div className="setup-field">
          <label className="setup-label">Portrait photo (optional)</label>
          <div className="photo-row">
            {photoPreviewUrl && (
              <img
                src={photoPreviewUrl}
                alt="Portrait preview"
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
                  Remove
                </button>
              )}
            </div>
          </div>
          <div className="setup-help">
            Square crop recommended (600×600+). Will be saved as
            <code> public/portrait.&lt;ext&gt; </code> in your zip and
            wired into the bio infobox automatically. JPG / PNG / WebP, max 3 MB.
          </div>
          {photoError && <div className="setup-error">{photoError}</div>}
        </div>
      </div>

      {/* Site */}
      <div className="setup-section">
        <h2 className="setup-section-heading">Site</h2>

        <div className="setup-field">
          <label className="setup-label setup-label-required">Site name</label>
          <input
            {...register("siteName")}
            className="setup-input"
            placeholder="Yourpedia"
          />
          <div className="setup-help">
            Shown in the top bar of your site. The default is
            &quot;Yourpedia&quot; &mdash; rename it to anything you
            want (e.g. &quot;Janepedia&quot;, &quot;Doepedia&quot;,
            &quot;MyWiki&quot;).
          </div>
          {errors.siteName && (
            <div className="setup-error">{errors.siteName.message}</div>
          )}
        </div>

      </div>

      {/* Advanced — collapsed by default. The fields here all need to
          be filled AFTER deploy (Site URL only exists once Vercel has
          assigned one; GitHub owner/repo only exist once you've pushed
          your wiki to GitHub). Hidden by default so users don't get
          stuck on chicken-and-egg fields on first run. */}
      <details className="setup-advanced">
        <summary>
          <span className="setup-advanced-title">
            Advanced — fill after deploy
          </span>
          <span className="setup-advanced-hint">
            Site URL · GitHub repo · all optional. Skip for now and edit
            <code> site.config.js </code> after your first deploy.
          </span>
        </summary>

        <div className="setup-field" style={{ marginTop: 14 }}>
          <label className="setup-label">Site URL</label>
          <input
            {...register("metaBaseUrl")}
            className="setup-input"
            placeholder="your-site.vercel.app"
          />
          <div className="setup-help">
            Where your site will live after deploy. Leave empty if you
            haven't deployed yet — we'll insert a placeholder you can
            update later in <code>site.config.js</code>.
          </div>
          {errors.metaBaseUrl && (
            <div className="setup-error">{errors.metaBaseUrl.message}</div>
          )}
        </div>

        <div className="setup-field-row">
          <div className="setup-field">
            <label className="setup-label">GitHub owner</label>
            <input
              {...register("githubOwner")}
              className="setup-input"
              placeholder="your-github-username"
            />
            {errors.githubOwner && (
              <div className="setup-error">{errors.githubOwner.message}</div>
            )}
          </div>
          <div className="setup-field">
            <label className="setup-label">GitHub repo</label>
            <input
              {...register("githubRepo")}
              className="setup-input"
              placeholder="your-wiki-repo"
            />
            {errors.githubRepo && (
              <div className="setup-error">{errors.githubRepo.message}</div>
            )}
          </div>
        </div>
        <div className="setup-help">
          Drives the "View source / Talk / History" links at the top of
          every wiki page. Set after you create the GitHub repo for
          your wiki.
        </div>
      </details>

      {/* Contact */}
      <div className="setup-section">
        <h2 className="setup-section-heading">Contact (all optional)</h2>

        <div className="setup-field">
          <label className="setup-label">Email</label>
          <input
            {...register("email")}
            className="setup-input"
            placeholder="jane@example.com"
          />
          {errors.email && (
            <div className="setup-error">{errors.email.message}</div>
          )}
        </div>

        <div className="setup-field">
          <label className="setup-label">LinkedIn</label>
          <input
            {...register("linkedin")}
            className="setup-input"
            placeholder="linkedin.com/in/janedoe"
          />
          <div className="setup-help">
            Paste your profile URL or just the handle path. We&apos;ll
            add <code>https://</code> for you if it&apos;s missing.
          </div>
          {errors.linkedin && (
            <div className="setup-error">{errors.linkedin.message}</div>
          )}
        </div>

        <div className="setup-field">
          <label className="setup-label">GitHub profile</label>
          <input
            {...register("githubProfile")}
            className="setup-input"
            placeholder="github.com/janedoe"
          />
          {errors.githubProfile && (
            <div className="setup-error">{errors.githubProfile.message}</div>
          )}
        </div>
      </div>

      {/* Shipped */}
      <div className="setup-section">
        <h2 className="setup-section-heading">Notable works (optional)</h2>
        <div className="setup-help" style={{ marginTop: -8, marginBottom: 12 }}>
          Listed in your bio's "Notable works" section. Add as many as
          you want. Each will become its own wiki page later.
        </div>

        {fields.map((field, idx) => {
          const thumb = projectThumbs[idx];
          const thumbErr = projectThumbErrors[idx];
          return (
            <div key={field.id} className="setup-array-row">
              <div>
                <label className="setup-label">Name</label>
                <input
                  {...register(`shipped.${idx}.name`)}
                  className="setup-input"
                  placeholder="ProjectOne"
                />
              </div>
              <div>
                <label className="setup-label">Description</label>
                <input
                  {...register(`shipped.${idx}.description`)}
                  className="setup-input"
                  placeholder="open-source dev console (2024)"
                />
              </div>
              <button
                type="button"
                onClick={() => removeProjectRow(idx)}
                className="setup-button"
              >
                Remove
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
                    <span className="project-thumb-pdf-icon">📄</span>
                    <span className="project-thumb-pdf-name">
                      {thumb.fileName.length > 22
                        ? thumb.fileName.slice(0, 19) + "…"
                        : thumb.fileName}
                    </span>
                  </div>
                )}
                <div className="project-thumb-controls">
                  <label className="setup-label">
                    Thumbnail or PDF (optional)
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
                      Remove
                    </button>
                  )}
                  <div className="setup-help">
                    <strong>Image</strong> (JPG / PNG / WebP, max 3 MB) →
                    rendered as a thumbnail next to this project.{" "}
                    <strong>PDF</strong> (max 10 MB) → linked at the end
                    of the line. Saved as{" "}
                    <code>public/projects/&lt;slug&gt;.&lt;ext&gt;</code>.
                  </div>
                  {thumbErr && (
                    <div className="setup-error">{thumbErr}</div>
                  )}
                </div>
              </div>
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
          + Add a shipped project
        </button>
      </div>

      {/* Education */}
      <div className="setup-section">
        <h2 className="setup-section-heading">Education (optional)</h2>
        <div className="setup-help" style={{ marginTop: -8, marginBottom: 12 }}>
          Each entry becomes its own wiki page. Slug auto-derives from
          name. Body fields (English / Chinese) get auto-filled by the
          LLM from your PDF — leave empty if filling manually and a stub
          page will be generated.
        </div>
        {eduFields.map((field, idx) => (
          <div key={field.id} className="setup-array-row">
            <div>
              <label className="setup-label">Institution</label>
              <input
                {...register(`educations.${idx}.name`)}
                className="setup-input"
                placeholder="University of Pennsylvania"
                onBlur={(e) => {
                  // Auto-fill slug from name if user hasn't set one yet
                  const cur = watch(`educations.${idx}.slug`);
                  if (!cur && e.target.value) {
                    setValue(
                      `educations.${idx}.slug`,
                      deriveSlug(e.target.value),
                      { shouldValidate: false }
                    );
                  }
                }}
              />
            </div>
            <div>
              <label className="setup-label">Degree</label>
              <input
                {...register(`educations.${idx}.degree`)}
                className="setup-input"
                placeholder="MSE in Systems Engineering"
              />
            </div>
            <button
              type="button"
              onClick={() => removeEdu(idx)}
              className="setup-button"
            >
              Remove
            </button>
            <details
              className="setup-array-details"
              style={{ gridColumn: "1 / -1", marginTop: 6 }}
            >
              <summary>More fields (slug · dates · location · zh)</summary>
              <div className="setup-field-row" style={{ marginTop: 10 }}>
                <div>
                  <label className="setup-label">Slug</label>
                  <input
                    {...register(`educations.${idx}.slug`)}
                    className="setup-input"
                    placeholder="University_of_Pennsylvania"
                  />
                </div>
                <div>
                  <label className="setup-label">Dates</label>
                  <input
                    {...register(`educations.${idx}.date_range`)}
                    className="setup-input"
                    placeholder="Aug 2025 – Aug 2027 (expected)"
                  />
                </div>
              </div>
              <div className="setup-field-row">
                <div>
                  <label className="setup-label">Location</label>
                  <input
                    {...register(`educations.${idx}.location`)}
                    className="setup-input"
                    placeholder="Philadelphia, Pennsylvania, U.S."
                  />
                </div>
                <div>
                  <label className="setup-label">Name (zh)</label>
                  <input
                    {...register(`educations.${idx}.name_zh`)}
                    className="setup-input"
                    placeholder="宾夕法尼亚大学"
                  />
                </div>
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
          + Add an education entry
        </button>
      </div>

      {/* Experience */}
      <div className="setup-section">
        <h2 className="setup-section-heading">Experience (optional)</h2>
        <div className="setup-help" style={{ marginTop: -8, marginBottom: 12 }}>
          Each entry becomes its own wiki page (employer profile + your
          role). LLM auto-fills body content from your PDF.
        </div>
        {expFields.map((field, idx) => (
          <div key={field.id} className="setup-array-row">
            <div>
              <label className="setup-label">Employer</label>
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
              />
            </div>
            <div>
              <label className="setup-label">Role</label>
              <input
                {...register(`experiences.${idx}.role`)}
                className="setup-input"
                placeholder="Quantitative Research Intern"
              />
            </div>
            <button
              type="button"
              onClick={() => removeExp(idx)}
              className="setup-button"
            >
              Remove
            </button>
            <details
              className="setup-array-details"
              style={{ gridColumn: "1 / -1", marginTop: 6 }}
            >
              <summary>More fields (slug · dates · location · zh)</summary>
              <div className="setup-field-row" style={{ marginTop: 10 }}>
                <div>
                  <label className="setup-label">Slug</label>
                  <input
                    {...register(`experiences.${idx}.slug`)}
                    className="setup-input"
                    placeholder="China_Galaxy_Securities"
                  />
                </div>
                <div>
                  <label className="setup-label">Dates</label>
                  <input
                    {...register(`experiences.${idx}.date_range`)}
                    className="setup-input"
                    placeholder="Summer 2024"
                  />
                </div>
              </div>
              <div className="setup-field-row">
                <div>
                  <label className="setup-label">Location</label>
                  <input
                    {...register(`experiences.${idx}.location`)}
                    className="setup-input"
                    placeholder="Shanghai, China"
                  />
                </div>
                <div>
                  <label className="setup-label">Name (zh)</label>
                  <input
                    {...register(`experiences.${idx}.name_zh`)}
                    className="setup-input"
                    placeholder="中国银河证券"
                  />
                </div>
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
          + Add a work experience
        </button>
      </div>

      {/* Submit */}
      <div className="setup-section" style={{ marginTop: 36 }}>
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
              // Use blob: URLs in preview so the user sees their just-
              // uploaded thumbnails without a round-trip.
              setPreviewData(
                enrichShipped(normalized, projectThumbs, "preview")
              );
              setPreviewOpen(true);
            }}
            className="setup-button setup-button-secondary"
          >
            Preview wiki
          </button>
          <button
            type="submit"
            disabled={generating}
            className="setup-button-primary"
          >
            {generating
              ? "Generating…"
              : "Generate my wiki (download zip)"}
          </button>
        </div>
        {done && (
          <div className="deploy-card">
            <div className="deploy-card-title">
              ✓ Zip downloaded — now put your wiki on the internet
            </div>
            <p className="deploy-card-lede">
              The zip is a complete Next.js project. Three short steps and
              you have a live URL.
            </p>

            <ol className="deploy-steps">
              <li>
                <strong>Unzip</strong> the file you just downloaded. Open the
                folder in your terminal.
              </li>
              <li>
                <strong>Create a new GitHub repo</strong> at{" "}
                <a
                  href="https://github.com/new"
                  target="_blank"
                  rel="noreferrer"
                  className="deploy-card-link"
                >
                  github.com/new
                </a>{" "}
                (any name; don&apos;t initialize with a README).
              </li>
              <li>
                <strong>Push the folder</strong> to that repo. Paste this in
                your terminal (replace{" "}
                <code>YOUR-USERNAME</code> and <code>YOUR-REPO</code>):
                <pre className="deploy-cmd">
{`git init
git add .
git commit -m "Initial setup via Yourpedia"
git branch -M main
git remote add origin https://github.com/YOUR-USERNAME/YOUR-REPO.git
git push -u origin main`}
                </pre>
              </li>
              <li>
                <strong>Deploy on Vercel</strong> — click the button below,
                sign in (free), pick the repo you just pushed, hit Deploy.
                Vercel auto-detects Next.js. ~30 seconds.
                <div style={{ marginTop: 10 }}>
                  <a
                    href="https://vercel.com/new"
                    target="_blank"
                    rel="noreferrer"
                    className="deploy-vercel-button"
                  >
                    Open Vercel → Deploy my repo
                  </a>
                </div>
              </li>
            </ol>

            <div className="deploy-card-aside">
              <strong>No GitHub?</strong> You can also drag the unzipped
              folder onto{" "}
              <a
                href="https://vercel.com/new"
                target="_blank"
                rel="noreferrer"
                className="deploy-card-link"
              >
                vercel.com/new
              </a>
              {" "}— click &quot;Browse&quot; and select the folder. No git
              required, but you won&apos;t be able to update the wiki later
              without re-uploading the whole folder.
            </div>

            <div className="deploy-card-aside">
              Full step-by-step (with troubleshooting) is also in{" "}
              <code>README.md</code> inside the zip.
            </div>
          </div>
        )}
      </div>

      {/* Phase 1C — GitHub one-click deploy */}
      <div className="setup-section deploy-block">
        <h2 className="setup-section-heading">
          Or deploy with one click
        </h2>
        <p className="setup-help" style={{ marginTop: -8, marginBottom: 14 }}>
          Sign in with GitHub and Yourpedia will fork the template,
          commit your wiki content, and hand you a Vercel deploy
          button. No terminal, no git commands.
        </p>

        {sessionStatus === "loading" && (
          <div className="setup-help">Checking your GitHub session…</div>
        )}

        {sessionStatus === "unauthenticated" && (
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
            <span>Sign in with GitHub</span>
          </button>
        )}

        {sessionStatus === "authenticated" && deployStep === "idle" && (
          <div>
            <div className="deploy-signed-in">
              <span>
                Signed in as{" "}
                <strong>@{session.user?.githubLogin || session.user?.name}</strong>
              </span>
              <button
                type="button"
                onClick={() => signOut({ redirect: false })}
                className="deploy-signout-link"
              >
                sign out
              </button>
            </div>
            <button
              type="button"
              onClick={handleDeploy}
              className="deploy-action-button"
            >
              Deploy my wiki to GitHub + open Vercel
            </button>
          </div>
        )}

        {(deployStep === "forking" || deployStep === "committing") && (
          <div className="deploy-progress">
            <div
              className={`deploy-step ${deployStep === "forking" ? "is-active" : "is-done"}`}
            >
              <span className="deploy-step-dot">1</span>
              <span>Forking colarpedia-template into your GitHub…</span>
            </div>
            <div
              className={`deploy-step ${deployStep === "committing" ? "is-active" : "is-pending"}`}
            >
              <span className="deploy-step-dot">2</span>
              <span>Committing your wiki content…</span>
            </div>
            <div className="deploy-step is-pending">
              <span className="deploy-step-dot">3</span>
              <span>Opening Vercel deploy link…</span>
            </div>
          </div>
        )}

        {deployStep === "done" && deployResult && (
          <div className="deploy-result">
            <div className="deploy-result-title">
              ✓ Your wiki is on GitHub. One click to put it online.
            </div>
            <p className="setup-help" style={{ marginBottom: 10 }}>
              Repo:{" "}
              <a
                href={deployResult.forkUrl}
                target="_blank"
                rel="noreferrer"
                className="deploy-card-link"
              >
                {deployResult.forkUrl.replace("https://github.com/", "")}
              </a>{" "}
              · {deployResult.operations?.length || 0} files committed
              {deployResult.forkExisted && (
                <em>
                  {" "}
                  (reusing existing fork — old commits preserved)
                </em>
              )}
            </p>
            <a
              href={deployResult.vercelDeployUrl}
              target="_blank"
              rel="noreferrer"
              className="deploy-vercel-button"
            >
              Deploy on Vercel →
            </a>
            <div className="setup-help" style={{ marginTop: 10 }}>
              Click the button — Vercel will detect Next.js, ask you
              once for permission, and deploy in ~30s. After deploy,
              update <code>site.config.js</code> in your fork to set
              the real <code>baseUrl</code> and you&apos;re done.
            </div>
          </div>
        )}

        {deployStep === "error" && (
          <div className="deploy-error">
            <strong>Deploy failed:</strong> {deployError}
            <div style={{ marginTop: 8 }}>
              <button
                type="button"
                onClick={() => {
                  setDeployStep("idle");
                  setDeployError("");
                }}
                className="setup-button"
              >
                Try again
              </button>
            </div>
          </div>
        )}
      </div>

      {previewOpen && previewData && (
        <PreviewModal
          data={previewData}
          photoPreviewUrl={photoPreviewUrl}
          files={{ photoFile, pdfFile }}
          onApplyPolish={(section, idx, patch) => {
            // Apply each verified field to the form. shouldDirty so RHF
            // tracks user-editable state correctly; preview re-renders
            // automatically via watch().
            for (const [field, value] of Object.entries(patch)) {
              setValue(`${section}.${idx}.${field}`, value, {
                shouldDirty: true,
                shouldValidate: false,
              });
            }
            // Re-snapshot previewData so the modal's audit re-runs with
            // the patched form. previewData is what the modal renders;
            // refreshing it from current form state syncs both.
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
