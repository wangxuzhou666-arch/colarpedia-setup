// 把 site data + entitySlug + lang 转成可渲染的 markdown body。
// 复用 setup/lib/templates 里现有的模板函数，只是去掉 YAML frontmatter
// 留 body——hosted 路由的 infobox 用 JSX 直接从 entity 拼，不走 frontmatter。

import {
  wikiPageTemplate,
  projectPageTemplate,
  institutionPageTemplate,
} from "../../setup/lib/templates";

const FRONTMATTER_RE = /^---\n[\s\S]*?\n---\n/;

function stripFrontmatter(md) {
  return md.replace(FRONTMATTER_RE, "");
}

export function resolveEntity(siteData, entitySlug) {
  if (!entitySlug || entitySlug === siteData.homepageSlug) {
    return { kind: "bio", entity: null };
  }
  const s = (siteData.shipped || []).find((x) => x.slug === entitySlug);
  if (s) return { kind: "shipped", entity: s };
  const ed = (siteData.educations || []).find((x) => x.slug === entitySlug);
  if (ed) return { kind: "education", entity: ed };
  const ex = (siteData.experiences || []).find((x) => x.slug === entitySlug);
  if (ex) return { kind: "experience", entity: ex };
  return null;
}

export function buildEntityBodyMarkdown(siteData, resolved, lang) {
  const ctx = {
    homepageSlug: siteData.homepageSlug,
    name: siteData.name,
    name_zh: siteData.name_zh,
  };
  let md = "";
  if (resolved.kind === "bio") {
    md = wikiPageTemplate(siteData, { lang });
  } else if (resolved.kind === "shipped") {
    md = projectPageTemplate(resolved.entity, ctx, { lang });
  } else if (resolved.kind === "education") {
    md = institutionPageTemplate(resolved.entity, ctx, "education", { lang });
  } else {
    md = institutionPageTemplate(resolved.entity, ctx, "experience", { lang });
  }
  return stripFrontmatter(md);
}

export function getRenderableSlugs(siteData) {
  const set = new Set();
  if (siteData.homepageSlug) set.add(siteData.homepageSlug);
  for (const s of siteData.shipped || []) if (s.slug) set.add(s.slug);
  for (const e of siteData.educations || []) if (e.slug) set.add(e.slug);
  for (const e of siteData.experiences || []) if (e.slug) set.add(e.slug);
  return set;
}

// 把 markdown 里的 [[Slug]] / [[Slug|Display]] 改写成 hosted 站点内
// 的真实链接 /<siteSlug>/<targetSlug>。在 payload 里找不到的 slug
// 渲染成 wikipedia 风格的红链。
export function rewriteWikilinks(body, siteSlug, renderableSlugs) {
  return body.replace(
    /\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g,
    (_, target, label) => {
      const slug = String(target).trim();
      const display = String(label || target).trim();
      if (renderableSlugs.has(slug)) {
        return `<a class="wikilink-live" href="/${siteSlug}/${slug}">${display}</a>`;
      }
      return `<span class="redlink">${display}</span>`;
    }
  );
}
