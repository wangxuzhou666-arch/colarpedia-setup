// Hosted 站点的页面骨架：顶栏 + 左侧目录 + 主内容（infobox + body）+ 页脚。
// 服务端组件——所有内容都从 site data 直接渲染，不走 client。
// markdown body 走子组件 SiteWikiBody（client，因为 react-markdown 体积大放 client bundle 更好）。

import Link from "next/link";
import SiteWikiBody from "./SiteWikiBody";

function safeUrlDisplay(url) {
  if (!url) return "";
  try {
    return String(url).replace(/^https?:\/\/(www\.)?/, "");
  } catch {
    return url;
  }
}

function buildBioInfobox(siteData, photoUrl, isZh) {
  const titleName = (isZh && siteData.name_zh ? siteData.name_zh : siteData.name) || "[姓名]";
  const tagline = (isZh ? siteData.tagline_zh : siteData.tagline) || "";
  const knownForLabel = isZh ? "以…著称" : "Known for";
  const contactLabel = isZh ? "联系方式" : "Contact";
  const emailLabel = isZh ? "邮箱" : "Email";

  return (
    <aside className="wiki-infobox" aria-label={isZh ? "信息卡" : "Infobox"}>
      <div className="wiki-infobox-title">{titleName}</div>
      <div className="wiki-infobox-image">
        {photoUrl ? (
          <>
            <img src={photoUrl} alt={titleName} style={{ width: "100%" }} />
            <div className="wiki-infobox-caption">
              {isZh ? `照片：${titleName}` : `Photo of ${titleName}`}
            </div>
          </>
        ) : (
          <>
            <div className="placeholder">no photo</div>
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
          {(siteData.email || siteData.linkedin || siteData.githubProfile) && (
            <tr>
              <td colSpan={2} className="wiki-infobox-section">
                {contactLabel}
              </td>
            </tr>
          )}
          {siteData.email && (
            <tr>
              <th>{emailLabel}</th>
              <td>{siteData.email}</td>
            </tr>
          )}
          {siteData.linkedin && (
            <tr>
              <th>LinkedIn</th>
              <td>
                <a href={siteData.linkedin} target="_blank" rel="noreferrer">
                  {safeUrlDisplay(siteData.linkedin)}
                </a>
              </td>
            </tr>
          )}
          {siteData.githubProfile && (
            <tr>
              <th>GitHub</th>
              <td>
                <a href={siteData.githubProfile} target="_blank" rel="noreferrer">
                  {safeUrlDisplay(siteData.githubProfile)}
                </a>
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </aside>
  );
}

function buildEntityInfobox(kind, entity, isZh) {
  const rows = [];
  if (kind === "shipped") {
    rows.push([isZh ? "类型" : "Type", isZh ? "项目" : "Project"]);
    if (entity.role || entity.role_zh) {
      rows.push([
        isZh ? "角色" : "Role",
        isZh ? entity.role_zh || entity.role : entity.role,
      ]);
    }
    if (entity.date_range) rows.push([isZh ? "时间" : "Dates", entity.date_range]);
    if (entity.url) rows.push(["URL", safeUrlDisplay(entity.url)]);
    if (Array.isArray(entity.tech_stack) && entity.tech_stack.length) {
      rows.push([isZh ? "技术栈" : "Tech stack", entity.tech_stack.join(", ")]);
    }
  } else if (kind === "education") {
    rows.push([isZh ? "类型" : "Type", isZh ? "教育机构" : "Educational institution"]);
    if (entity.location) rows.push([isZh ? "地点" : "Location", entity.location]);
    if (entity.degree || entity.degree_zh) {
      rows.push([
        isZh ? "学位" : "Degree",
        isZh ? entity.degree_zh || entity.degree : entity.degree,
      ]);
    }
    if (entity.date_range) rows.push([isZh ? "时间" : "Dates", entity.date_range]);
  } else {
    rows.push([isZh ? "类型" : "Type", isZh ? "雇主" : "Employer"]);
    if (entity.location) rows.push([isZh ? "地点" : "Location", entity.location]);
    if (entity.role || entity.role_zh) {
      rows.push([
        isZh ? "职位" : "Role",
        isZh ? entity.role_zh || entity.role : entity.role,
      ]);
    }
    if (entity.date_range) rows.push([isZh ? "时间" : "Dates", entity.date_range]);
  }

  const logo = entity.logo;
  const logoCaption =
    (isZh ? entity.logo_caption_zh : entity.logo_caption) || entity.logo_caption || "";

  return (
    <aside className="wiki-infobox" aria-label={isZh ? "信息卡" : "Infobox"}>
      <div className="wiki-infobox-title">{entity.name}</div>
      {logo && (
        <div className="wiki-infobox-image">
          <img
            src={logo}
            alt={entity.name}
            style={{
              width: "100%",
              maxHeight: 200,
              objectFit: "contain",
              background: "#fff",
              padding: 12,
              boxSizing: "border-box",
            }}
          />
          {logoCaption && (
            <div className="wiki-infobox-caption">{logoCaption}</div>
          )}
        </div>
      )}
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

function buildSidebar(siteSlug, siteData, isZh) {
  const sections = [
    {
      heading: isZh ? "传记" : "Biography",
      items: siteData.homepageSlug
        ? [{ slug: siteData.homepageSlug, label: (isZh ? siteData.name_zh : siteData.name) || siteData.name }]
        : [],
    },
    {
      heading: isZh ? "代表作品" : "Notable works",
      items: (siteData.shipped || [])
        .filter((s) => s.slug && s.name)
        .map((s) => ({
          slug: s.slug,
          label: (isZh && s.name_zh ? s.name_zh : s.name) || s.slug,
        })),
    },
    {
      heading: isZh ? "工作经历" : "Experience",
      items: (siteData.experiences || [])
        .filter((e) => e.slug && e.name)
        .map((e) => ({
          slug: e.slug,
          label: (isZh && e.name_zh ? e.name_zh : e.name) || e.slug,
        })),
    },
    {
      heading: isZh ? "教育背景" : "Education",
      items: (siteData.educations || [])
        .filter((e) => e.slug && e.name)
        .map((e) => ({
          slug: e.slug,
          label: (isZh && e.name_zh ? e.name_zh : e.name) || e.slug,
        })),
    },
  ].filter((s) => s.items.length > 0);

  return (
    <nav className="preview-nav" aria-label={isZh ? "页面导航" : "Wiki pages"}>
      {sections.map((section) => (
        <div key={section.heading} className="preview-nav-section">
          <div className="preview-nav-heading">{section.heading}</div>
          <ul>
            {section.items.map((item) => (
              <li key={item.slug}>
                <Link
                  className="preview-nav-item"
                  href={
                    item.slug === siteData.homepageSlug
                      ? `/${siteSlug}`
                      : `/${siteSlug}/${item.slug}`
                  }
                >
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </nav>
  );
}

export default function SiteShell({
  siteSlug,
  siteData,
  photoUrl,
  resolved,
  body,
  lang,
}) {
  const isZh = lang === "zh";
  const otherLang = isZh ? "en" : "zh";
  const otherLangLabel = isZh ? "English" : "中文";

  let pageTitle, pageSubtitle, infobox;
  if (resolved.kind === "bio") {
    pageTitle = (isZh && siteData.name_zh ? siteData.name_zh : siteData.name) || "[姓名]";
    pageSubtitle = (isZh ? siteData.tagline_zh : siteData.tagline) || "";
    infobox = buildBioInfobox(siteData, photoUrl, isZh);
  } else {
    const e = resolved.entity;
    pageTitle = isZh && e.name_zh ? `${e.name_zh} (${e.name})` : e.name;
    if (resolved.kind === "shipped") {
      pageSubtitle = (isZh ? e.description_zh : e.description) || "";
    } else if (resolved.kind === "education") {
      pageSubtitle = (isZh ? e.degree_zh : e.degree) || "";
    } else {
      pageSubtitle = (isZh ? e.role_zh : e.role) || "";
    }
    infobox = buildEntityInfobox(resolved.kind, e, isZh);
  }

  const siteName = siteData.siteName || "Yourpedia";

  // 当前页 URL（用于 ?lang= 切换链接保留路径）
  const currentEntityPath =
    resolved.kind === "bio" ? "" : `/${resolved.entity.slug}`;
  const langSwitchHref = `/${siteSlug}${currentEntityPath}?lang=${otherLang}`;

  return (
    <>
      <div className="wiki-topbar">
        <div className="wiki-topbar-inner">
          <a href={`/${siteSlug}`} className="wiki-logo">
            {siteName}
            <span>{(isZh ? siteData.name_zh : siteData.name) || siteSlug}</span>
          </a>
          <div style={{ marginLeft: "auto", display: "flex", gap: 12, alignItems: "center" }}>
            <a href={langSwitchHref} style={{ fontSize: 13, color: "var(--wiki-text-soft, #54595d)" }}>
              {otherLangLabel}
            </a>
          </div>
        </div>
      </div>

      <div className="preview-body" style={{ display: "flex", maxWidth: 1200, margin: "0 auto" }}>
        {buildSidebar(siteSlug, siteData, isZh)}

        <div className="preview-content" style={{ flex: 1 }}>
          <main className="wiki-main preview-wiki-main">
            <h1 className="wiki-title">{pageTitle || "[暂未命名]"}</h1>
            {pageSubtitle && <p className="wiki-title-sub">{pageSubtitle}</p>}
            {infobox}
            <SiteWikiBody body={body} />
          </main>
        </div>
      </div>

      <footer className="wiki-footer">
        <p>
          {isZh
            ? "本页面由作者本人维护。"
            : "This page is maintained by its author."}{" "}
          <a href="/setup/">{isZh ? "用 Yourpedia 也做一个 →" : "Make yours with Yourpedia →"}</a>
        </p>
      </footer>
    </>
  );
}
