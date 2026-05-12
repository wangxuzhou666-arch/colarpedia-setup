// /<siteSlug>/<entitySlug>/ — wiki 站点内的子页面（项目 / 教育 / 工作）。

import { notFound } from "next/navigation";
import { loadSiteBySlug } from "../_lib/loadSite";
import {
  resolveEntity,
  buildEntityBodyMarkdown,
  getRenderableSlugs,
  rewriteWikilinks,
} from "../_lib/renderEntity";
import SiteShell from "../_components/SiteShell";

export const revalidate = 60;

function safeLang(raw) {
  return raw === "zh" ? "zh" : "en";
}

export async function generateMetadata({ params, searchParams }) {
  const { siteSlug, entitySlug } = await params;
  const sp = (await searchParams) || {};
  const lang = safeLang(sp.lang);
  const site = await loadSiteBySlug(siteSlug);
  if (!site) return { title: "Workplay · 页面不存在" };
  const resolved = resolveEntity(site.data, entitySlug);
  if (!resolved) return { title: "Workplay · 页面不存在" };
  if (resolved.kind === "bio") {
    return { title: `${site.display_name} — ${site.data.siteName || "Workplay"}` };
  }
  const e = resolved.entity;
  const isZh = lang === "zh";
  const name = isZh && e.name_zh ? e.name_zh : e.name;
  return {
    title: `${name} — ${site.data.siteName || "Workplay"}`,
  };
}

export default async function SiteEntityPage({ params, searchParams }) {
  const { siteSlug, entitySlug } = await params;
  const sp = (await searchParams) || {};
  const lang = safeLang(sp.lang);

  const site = await loadSiteBySlug(siteSlug);
  if (!site) notFound();

  const resolved = resolveEntity(site.data, entitySlug);
  if (!resolved) notFound();

  const renderableSlugs = getRenderableSlugs(site.data);
  const rawBody = buildEntityBodyMarkdown(site.data, resolved, lang);
  const body = rewriteWikilinks(rawBody, siteSlug, renderableSlugs);

  return (
    <SiteShell
      siteSlug={siteSlug}
      siteData={site.data}
      photoUrl={site.photo_url}
      resolved={resolved}
      body={body}
      lang={lang}
    />
  );
}
