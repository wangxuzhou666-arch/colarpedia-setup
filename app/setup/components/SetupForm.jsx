"use client";

import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useState } from "react";
import { setupSchema, deriveSlug } from "../lib/schema";
import { generateZip, triggerDownload } from "../lib/generator";
import UploadPanel from "./UploadPanel";

export default function SetupForm() {
  const [generating, setGenerating] = useState(false);
  const [done, setDone] = useState(false);
  const [pdfFile, setPdfFile] = useState(null);
  const [photoFile, setPhotoFile] = useState(null);
  const [photoPreviewUrl, setPhotoPreviewUrl] = useState("");
  const [photoError, setPhotoError] = useState("");

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
    },
  });

  const { fields, append, remove, replace } = useFieldArray({
    control,
    name: "shipped",
  });

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

  const onSubmit = async (rawData) => {
    setGenerating(true);
    setDone(false);
    try {
      const data = {
        ...rawData,
        linkedin: normalizeUrl(rawData.linkedin),
        githubProfile: normalizeUrl(rawData.githubProfile),
        metaBaseUrl: normalizeUrl(rawData.metaBaseUrl) || "https://example.com",
        githubOwner: rawData.githubOwner || "your-github-username",
        githubRepo: rawData.githubRepo || "your-wiki-repo",
      };
      const blob = await generateZip(data, { pdfFile, photoFile });
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
        replaceShipped={replace}
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

        {fields.map((field, idx) => (
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
              onClick={() => remove(idx)}
              className="setup-button"
            >
              Remove
            </button>
          </div>
        ))}

        <button
          type="button"
          onClick={() => append({ name: "", description: "" })}
          className="setup-button-add"
        >
          + Add a shipped project
        </button>
      </div>

      {/* Submit */}
      <div className="setup-section" style={{ marginTop: 36 }}>
        <button
          type="submit"
          disabled={generating}
          className="setup-button-primary"
        >
          {generating
            ? "Generating…"
            : "Generate my wiki (download zip)"}
        </button>
        {done && (
          <div className="setup-success">
            Zip downloaded. See README.md inside for the 5-step deploy
            instructions.
          </div>
        )}
      </div>
    </form>
  );
}
