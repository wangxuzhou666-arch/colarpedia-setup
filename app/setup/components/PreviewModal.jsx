"use client";

// Wiki preview modal — renders any page in the user's wiki using the
// same design tokens as the live Wikipedia-style site, before they
// download / deploy. Sprint 1.5 upgrade: multi-page navigation.
//
//   - Left sidebar lists Bio / Notable works / Education / Experience
//     (only sections with entries are shown).
//   - Wikilinks ([[Slug]]) inside any rendered page are clickable when
//     the target exists in the payload — clicking jumps to that
//     entity's preview without leaving the modal. Targets that aren't
//     in the payload still render as Wikipedia-style red links.
//   - en / zh tab applies to whichever page is currently shown.
//   - Local heuristic auditor sits in a yellow drawer above the
//     content — zero LLM calls, just rule-based completeness hints.

import { useEffect, useMemo, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeRaw from "rehype-raw";
import { auditWikiData, groupSuggestions } from "../lib/wikiAuditor";
import {
  wikiPageTemplate,
  projectPageTemplate,
  institutionPageTemplate,
} from "../lib/templates";
import GapFillDialog from "./GapFillDialog";

// Build the polish-target list for the audit panel's Quick row.
// Every named entity surfaces here — even if the auditor didn't flag
// any concrete gaps — so the user can attach material to ENRICH a
// fully-filled entity, not just fill blanks. flaggedCount tells the
// UI whether to label "(N gaps)" (auditor flagged things) or
// "(enrich)" (no gaps but available for material attach).
function buildPolishTargets(suggestions, data) {
  const byKey = new Map();
  // 1. Auditor-flagged gaps first
  for (const s of suggestions) {
    if (!s.canPolish || !s.fixField) continue;
    const { section, idx, field } = s.fixField;
    const key = `${section}::${idx}`;
    if (!byKey.has(key)) {
      byKey.set(key, { section, idx, fields: [], flaggedCount: 0 });
    }
    const t = byKey.get(key);
    t.fields.push(field);
    t.flaggedCount++;
  }
  // 2. Backfill: every named entity with a slug, even if no gaps
  const ensure = (section, idx, defaults) => {
    const key = `${section}::${idx}`;
    if (byKey.has(key)) return;
    byKey.set(key, {
      section,
      idx,
      fields: defaults,
      flaggedCount: 0,
    });
  };
  (data.shipped || []).forEach((s, i) => {
    if (s?.name && s?.slug) {
      ensure("shipped", i, ["body", "body_zh", "tech_stack", "url"]);
    }
  });
  (data.educations || []).forEach((e, i) => {
    if (e?.name && e?.slug) {
      ensure("educations", i, ["body", "body_zh", "degree", "date_range"]);
    }
  });
  (data.experiences || []).forEach((e, i) => {
    if (e?.name && e?.slug) {
      ensure("experiences", i, ["body", "body_zh", "role", "date_range"]);
    }
  });
  return Array.from(byKey.values());
}

function stripFrontmatter(md) {
  const m = md.match(/^---\n[\s\S]*?\n---\n([\s\S]*)$/);
  return m ? m[1] : md;
}

// [[Slug]] / [[Slug|Display]] →
//   - <a class="wikilink-live" data-slug="…"> when the slug exists in
//     the payload (clickable, click handler below intercepts and
//     navigates inside the modal)
//   - <span class="redlink"> otherwise (Wikipedia "page coming" style)
function preprocessWikiLinks(body, renderableSlugs) {
  return body.replace(
    /\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g,
    (_, target, label) => {
      const slug = String(target).trim();
      const display = String(label || target).trim();
      if (renderableSlugs.has(slug)) {
        return `<a href="#" class="wikilink-live" data-slug="${slug}">${display}</a>`;
      }
      return `<span class="redlink">${display}</span>`;
    }
  );
}

// Resolve which entity (and which template) the current sidebar
// selection points at.
function resolvePageData(currentSlug, data) {
  if (!currentSlug || currentSlug === data.homepageSlug) {
    return { kind: "bio", entity: null };
  }
  const s = (data.shipped || []).find((x) => x.slug === currentSlug);
  if (s) return { kind: "shipped", entity: s };
  const ed = (data.educations || []).find((x) => x.slug === currentSlug);
  if (ed) return { kind: "education", entity: ed };
  const ex = (data.experiences || []).find((x) => x.slug === currentSlug);
  if (ex) return { kind: "experience", entity: ex };
  return { kind: "bio", entity: null };
}

export default function PreviewModal({
  data,
  photoPreviewUrl,
  files,
  onApplyPolish, // (section, idx, patch) => void  — parent setValue
  onClose,
}) {
  const [lang, setLang] = useState("zh");
  const [showAudit, setShowAudit] = useState(true);
  const [currentSlug, setCurrentSlug] = useState(data.homepageSlug);
  const [gapFillOpen, setGapFillOpen] = useState(null); // { section, idx, fields }

  const isZh = lang === "zh";
  const hasZh =
    !!(data.bio_zh || data.tagline_zh || data.name_zh) ||
    (data.shipped || []).some((s) => s.description_zh || s.body_zh);

  // Local heuristic auditor — runs on every form change. Zero token cost.
  const audit = useMemo(
    () => auditWikiData(data, files || {}),
    [data, files]
  );
  const grouped = useMemo(() => groupSuggestions(audit), [audit]);
  const totalSuggestions = audit.length;
  const polishTargets = useMemo(
    () => buildPolishTargets(audit, data),
    [audit, data]
  );

  // Entities the modal can navigate into. Used both for the sidebar
  // and for upgrading [[Slug]] from redlinks to live wikilinks.
  const renderableSlugs = useMemo(() => {
    const slugs = new Set();
    if (data.homepageSlug) slugs.add(data.homepageSlug);
    for (const s of data.shipped || []) if (s.slug) slugs.add(s.slug);
    for (const e of data.educations || []) if (e.slug) slugs.add(e.slug);
    for (const e of data.experiences || []) if (e.slug) slugs.add(e.slug);
    return slugs;
  }, [data]);

  const pageData = useMemo(
    () => resolvePageData(currentSlug, data),
    [currentSlug, data]
  );

  // Reset to bio if the current selection disappears (e.g. user
  // removed that row from the form mid-preview).
  useEffect(() => {
    if (currentSlug && !renderableSlugs.has(currentSlug)) {
      setCurrentSlug(data.homepageSlug);
    }
  }, [renderableSlugs, currentSlug, data.homepageSlug]);

  const md = useMemo(() => {
    if (pageData.kind === "bio") {
      return wikiPageTemplate(data, {
        lang,
        photoPath: photoPreviewUrl ? "public/__preview_photo__" : null,
      });
    }
    const ctx = {
      homepageSlug: data.homepageSlug,
      name: data.name,
      name_zh: data.name_zh,
    };
    if (pageData.kind === "shipped") {
      return projectPageTemplate(pageData.entity, ctx, { lang });
    }
    if (pageData.kind === "education") {
      return institutionPageTemplate(pageData.entity, ctx, "education", { lang });
    }
    if (pageData.kind === "experience") {
      return institutionPageTemplate(pageData.entity, ctx, "experience", { lang });
    }
    return "";
  }, [pageData, data, lang, photoPreviewUrl]);

  const body = useMemo(
    () => preprocessWikiLinks(stripFrontmatter(md), renderableSlugs),
    [md, renderableSlugs]
  );

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

  // Delegate clicks on .wikilink-live so the modal can intercept and
  // navigate without ever hitting "#" / page reload.
  const onBodyClick = (e) => {
    const a = e.target.closest && e.target.closest("a.wikilink-live");
    if (!a) return;
    e.preventDefault();
    const slug = a.dataset.slug;
    if (slug && renderableSlugs.has(slug)) {
      setCurrentSlug(slug);
      // Scroll content area to top so the user lands at the new page header.
      const content = e.currentTarget.querySelector(".preview-content");
      if (content) content.scrollTop = 0;
    }
  };

  // ---- Per-page header / infobox / chrome ----
  let pageTitle = "";
  let pageSubtitle = "";
  let infoboxJsx = null;

  if (pageData.kind === "bio") {
    pageTitle = (isZh && data.name_zh ? data.name_zh : data.name) || "[姓名]";
    pageSubtitle = (isZh ? data.tagline_zh : data.tagline) || "";
    const knownForLabel = isZh ? "以…著称" : "Known for";
    const contactLabel = isZh ? "联系方式" : "Contact";
    const emailLabel = isZh ? "邮箱" : "Email";
    const captionText = isZh
      ? `照片：${pageTitle}`
      : `Photo of ${pageTitle}`;
    const captionPlaceholder = isZh
      ? "把你的照片放到 /public/portrait.jpg"
      : "Replace /public/portrait.jpg with your photo";
    infoboxJsx = (
      <aside className="wiki-infobox" aria-label="Infobox">
        <div className="wiki-infobox-title">{pageTitle}</div>
        <div className="wiki-infobox-image">
          {photoPreviewUrl ? (
            <>
              <img
                src={photoPreviewUrl}
                alt={pageTitle || ""}
                style={{ width: "100%" }}
              />
              <div className="wiki-infobox-caption">{captionText}</div>
            </>
          ) : (
            <>
              <div className="placeholder">no photo</div>
              <div className="wiki-infobox-caption">{captionPlaceholder}</div>
            </>
          )}
        </div>
        <table>
          <tbody>
            {pageSubtitle && (
              <tr>
                <th>{knownForLabel}</th>
                <td>{pageSubtitle}</td>
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
    );
  } else {
    // Entity page — text-only infobox built from the entity object.
    const e = pageData.entity || {};
    pageTitle = isZh && e.name_zh ? `${e.name_zh} (${e.name})` : e.name;
    if (pageData.kind === "shipped") {
      pageSubtitle = (isZh ? e.description_zh : e.description) || "";
    } else if (pageData.kind === "education") {
      pageSubtitle = (isZh ? e.degree_zh : e.degree) || "";
    } else {
      pageSubtitle = (isZh ? e.role_zh : e.role) || "";
    }
    const rows = [];
    if (pageData.kind === "shipped") {
      rows.push([isZh ? "类型" : "Type", isZh ? "项目" : "Project"]);
      if (e.role) rows.push([isZh ? "角色" : "Role", isZh ? (e.role_zh || e.role) : e.role]);
      if (e.date_range) rows.push([isZh ? "时间" : "Dates", e.date_range]);
      if (e.url) rows.push(["URL", e.url.replace(/^https?:\/\/(www\.)?/, "")]);
      if (Array.isArray(e.tech_stack) && e.tech_stack.length)
        rows.push([isZh ? "技术栈" : "Tech stack", e.tech_stack.join(", ")]);
    } else if (pageData.kind === "education") {
      rows.push([isZh ? "类型" : "Type", isZh ? "教育机构" : "Educational institution"]);
      if (e.location) rows.push([isZh ? "地点" : "Location", e.location]);
      if (e.degree || e.degree_zh)
        rows.push([
          isZh ? "学位" : "Degree",
          isZh ? e.degree_zh || e.degree : e.degree,
        ]);
      if (e.date_range) rows.push([isZh ? "时间" : "Dates", e.date_range]);
    } else {
      rows.push([isZh ? "类型" : "Type", isZh ? "雇主" : "Employer"]);
      if (e.location) rows.push([isZh ? "地点" : "Location", e.location]);
      if (e.role || e.role_zh)
        rows.push([
          isZh ? "职位" : "Role",
          isZh ? e.role_zh || e.role : e.role,
        ]);
      if (e.date_range) rows.push([isZh ? "时间" : "Dates", e.date_range]);
    }
    infoboxJsx = (
      <aside className="wiki-infobox" aria-label="信息卡">
        <div className="wiki-infobox-title">{e.name}</div>
        <table>
          <tbody>
            {rows.map(([k, v]) => (
              <tr key={k}>
                <th>{k}</th>
                <td>{v}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </aside>
    );
  }

  // ---- Sidebar sections ----
  const navSections = [
    {
      heading: isZh ? "传记" : "Biography",
      items: data.homepageSlug
        ? [{ slug: data.homepageSlug, label: data.name || "[bio]" }]
        : [],
    },
    {
      heading: isZh ? "代表作品" : "Notable works",
      items: (data.shipped || [])
        .filter((s) => s.slug)
        .map((s) => ({
          slug: s.slug,
          label: (isZh && s.name_zh ? s.name_zh : s.name) || s.slug,
        })),
    },
    {
      heading: isZh ? "工作经历" : "Experience",
      items: (data.experiences || [])
        .filter((e) => e.slug)
        .map((e) => ({
          slug: e.slug,
          label: (isZh && e.name_zh ? e.name_zh : e.name) || e.slug,
        })),
    },
    {
      heading: isZh ? "教育背景" : "Education",
      items: (data.educations || [])
        .filter((e) => e.slug)
        .map((e) => ({
          slug: e.slug,
          label: (isZh && e.name_zh ? e.name_zh : e.name) || e.slug,
        })),
    },
  ].filter((s) => s.items.length > 0);

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
          {totalSuggestions > 0 && (
            <button
              type="button"
              className={`preview-audit-toggle ${showAudit ? "is-active" : ""}`}
              onClick={() => setShowAudit((v) => !v)}
              title={`${totalSuggestions} 条改进建议`}
            >
              💡 {totalSuggestions} 条建议
            </button>
          )}
          <span className="preview-meta">
            预览 · 上线后会是这个样子
          </span>
          <button
            type="button"
            className="preview-close"
            onClick={onClose}
            aria-label="关闭预览"
          >
            ✕
          </button>
        </div>

        {showAudit && totalSuggestions > 0 && (
          <div className="preview-audit-panel" role="region" aria-label="Completeness suggestions">
            <div className="preview-audit-header">
              <strong>想让 wiki 更丰富？</strong>
              <span className="preview-audit-sub">
                这些建议是本地检查，不消耗 AI 额度。直接改表单，或点
                <em>补充内容</em>用一份新的 PDF 自动补全某条经历。
              </span>
            </div>

            {polishTargets.length > 0 && onApplyPolish && (
              <div className="preview-audit-polish-row">
                <strong>补充内容：</strong>
                {polishTargets.map((t) => {
                  const arr = data[t.section] || [];
                  const ent = arr[t.idx];
                  if (!ent) return null;
                  const isGap = t.flaggedCount > 0;
                  const labelSuffix = isGap
                    ? `（缺 ${t.flaggedCount} 项）`
                    : `（润色）`;
                  return (
                    <button
                      key={`${t.section}-${t.idx}`}
                      type="button"
                      className={`preview-audit-polish-btn ${isGap ? "is-gap" : "is-enrich"}`}
                      onClick={() => setGapFillOpen(t)}
                      title={
                        isGap
                          ? `补全缺失字段：${t.fields.join("、")}`
                          : `用新的 PDF / 文字补充 ${ent.name} 的详情`
                      }
                    >
                      📎 {ent.name || `[${t.section}[${t.idx}]]`}{" "}
                      <span className="preview-audit-polish-fields">
                        {labelSuffix}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}

            {grouped.warn.length > 0 && (
              <ul className="preview-audit-list is-warn">
                {grouped.warn.map((s, i) => (
                  <li key={`w-${i}`}>{s.message}</li>
                ))}
              </ul>
            )}
            {grouped.tip.length > 0 && (
              <ul className="preview-audit-list is-tip">
                {grouped.tip.map((s, i) => (
                  <li key={`t-${i}`}>{s.message}</li>
                ))}
              </ul>
            )}
            {grouped.info.length > 0 && (
              <details className="preview-audit-info">
                <summary>还有 {grouped.info.length} 条小建议</summary>
                <ul className="preview-audit-list is-info">
                  {grouped.info.map((s, i) => (
                    <li key={`i-${i}`}>{s.message}</li>
                  ))}
                </ul>
              </details>
            )}
          </div>
        )}

        {gapFillOpen && onApplyPolish && (() => {
          const arr = data[gapFillOpen.section] || [];
          const entity = arr[gapFillOpen.idx];
          if (!entity) return null;
          // Sibling slugs — for the LLM's wikilink awareness in body fields.
          const siblings = [
            ...(data.shipped || []).map((s) => s.slug).filter(Boolean),
            ...(data.educations || []).map((e) => e.slug).filter(Boolean),
            ...(data.experiences || []).map((e) => e.slug).filter(Boolean),
          ].filter((s) => s !== entity.slug);
          return (
            <GapFillDialog
              entityType={gapFillOpen.section}
              entityIdx={gapFillOpen.idx}
              entity={entity}
              gaps={gapFillOpen.fields}
              homepageSlug={data.homepageSlug}
              siblingSlugs={siblings}
              onApply={(idx, patch) => {
                onApplyPolish(gapFillOpen.section, idx, patch);
              }}
              onClose={() => setGapFillOpen(null)}
            />
          );
        })()}

        <div className="preview-body" onClick={onBodyClick}>
          <nav className="preview-nav" aria-label="页面导航">
            {navSections.map((section) => (
              <div key={section.heading} className="preview-nav-section">
                <div className="preview-nav-heading">{section.heading}</div>
                <ul>
                  {section.items.map((item) => (
                    <li key={item.slug}>
                      <button
                        type="button"
                        className={`preview-nav-item ${
                          currentSlug === item.slug ? "is-active" : ""
                        }`}
                        onClick={() => setCurrentSlug(item.slug)}
                      >
                        {item.label}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </nav>

          <div className="preview-content">
            <main className="wiki-main preview-wiki-main">
              <h1 className="wiki-title">{pageTitle || "[暂未命名]"}</h1>
              {pageSubtitle && <p className="wiki-title-sub">{pageSubtitle}</p>}
              {infoboxJsx}
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
    </div>
  );
}
