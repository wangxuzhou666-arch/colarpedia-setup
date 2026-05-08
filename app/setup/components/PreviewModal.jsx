"use client";

// Wiki preview modal — renders the user's bio page using the same
// design tokens as the live wiki, before they download the zip.
// Helps users see what they're shipping; also catches obvious LLM
// glitches (truncated bio, weird tagline) without the deploy round-trip.

import { useEffect, useMemo, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeRaw from "rehype-raw";

// Pull the markdown body out of a frontmatter-prefixed file.
function stripFrontmatter(md) {
  const m = md.match(/^---\n[\s\S]*?\n---\n([\s\S]*)$/);
  return m ? m[1] : md;
}

// Render [[Slug]] / [[Slug|Display]] as red links — preview has no
// real wiki pages to point at, so all wikilinks render as redlinks
// (the same Wikipedia convention the live site uses).
function preprocessWikiLinks(body) {
  // Render [[Slug]] / [[Slug|Display]] as redlink spans (not anchors).
  // We use <span> instead of <a> because:
  //   1. Preview has no real wiki pages to link to (everything is "future").
  //   2. rehype-raw / React strip lowercase onclick handlers, so an
  //      anchor would either navigate to "#" or not work at all.
  //   3. <span class="redlink"> reads identically — same Wikipedia
  //      convention, no broken click behavior.
  return body.replace(
    /\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g,
    (_, target, label) => {
      const display = (label || target).trim();
      return `<span class="redlink">${display}</span>`;
    }
  );
}

import { wikiPageTemplate } from "../lib/templates";

export default function PreviewModal({
  data,
  photoPreviewUrl,
  onClose,
}) {
  const [lang, setLang] = useState("en");
  const hasZh =
    !!(data.bio_zh || data.tagline_zh || data.name_zh) ||
    (data.shipped || []).some((s) => s.description_zh);

  // Close on Escape.
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  // Lock body scroll while open.
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  const isZh = lang === "zh";
  const titleName = isZh && data.name_zh ? data.name_zh : data.name;
  const tagline = (isZh ? data.tagline_zh : data.tagline) || "";

  const md = useMemo(
    () =>
      wikiPageTemplate(data, {
        lang,
        photoPath: photoPreviewUrl ? "public/__preview_photo__" : null,
      }),
    [data, lang, photoPreviewUrl]
  );
  const body = useMemo(() => preprocessWikiLinks(stripFrontmatter(md)), [md]);

  const knownForLabel = isZh ? "以…著称" : "Known for";
  const contactLabel = isZh ? "联系方式" : "Contact";
  const emailLabel = isZh ? "邮箱" : "Email";
  const captionText = isZh
    ? `照片：${titleName}`
    : `Photo of ${titleName}`;
  const captionPlaceholder = isZh
    ? "把你的照片放到 /public/portrait.jpg"
    : "Replace /public/portrait.jpg with your photo";

  return (
    <div
      className="preview-overlay"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="preview-modal"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="preview-toolbar">
          <div className="preview-tabs">
            <button
              type="button"
              className={`preview-tab ${lang === "en" ? "is-active" : ""}`}
              onClick={() => setLang("en")}
            >
              English
            </button>
            {hasZh && (
              <button
                type="button"
                className={`preview-tab ${lang === "zh" ? "is-active" : ""}`}
                onClick={() => setLang("zh")}
              >
                中文
              </button>
            )}
          </div>
          <div className="preview-toolbar-spacer" />
          <span className="preview-meta">
            Preview — exact rendering after deploy
          </span>
          <button
            type="button"
            className="preview-close"
            onClick={onClose}
            aria-label="Close preview"
          >
            ✕
          </button>
        </div>

        <div className="preview-content">
          <main className="wiki-main preview-wiki-main">
            <h1 className="wiki-title">{titleName || "[Your name]"}</h1>
            {tagline && <p className="wiki-title-sub">{tagline}</p>}

            <aside className="wiki-infobox" aria-label="Infobox">
              <div className="wiki-infobox-title">
                {titleName || "[Your name]"}
              </div>
              <div className="wiki-infobox-image">
                {photoPreviewUrl ? (
                  <>
                    <img
                      src={photoPreviewUrl}
                      alt={titleName || ""}
                      style={{ width: "100%" }}
                    />
                    <div className="wiki-infobox-caption">{captionText}</div>
                  </>
                ) : (
                  <>
                    <div className="placeholder">no photo</div>
                    <div className="wiki-infobox-caption">
                      {captionPlaceholder}
                    </div>
                  </>
                )}
              </div>
              <table>
                <tbody>
                  {tagline && (
                    <tr>
                      <th>{knownForLabel}</th>
                      <td>{tagline}</td>
                    </tr>
                  )}
                  {(data.email || data.linkedin || data.githubProfile) && (
                    <tr>
                      <td colSpan={2} className="wiki-infobox-section">
                        {contactLabel}
                      </td>
                    </tr>
                  )}
                  {data.email && (
                    <tr>
                      <th>{emailLabel}</th>
                      <td>{data.email}</td>
                    </tr>
                  )}
                  {data.linkedin && (
                    <tr>
                      <th>LinkedIn</th>
                      <td>{data.linkedin.replace(/^https?:\/\/(www\.)?/, "")}</td>
                    </tr>
                  )}
                  {data.githubProfile && (
                    <tr>
                      <th>GitHub</th>
                      <td>
                        {data.githubProfile.replace(/^https?:\/\/(www\.)?/, "")}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </aside>

            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              rehypePlugins={[rehypeRaw]}
            >
              {body}
            </ReactMarkdown>
          </main>
        </div>
      </div>
    </div>
  );
}
