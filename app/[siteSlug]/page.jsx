// /<siteSlug>/ — 一个 hosted wiki 站点的 bio 主页。
// 同 [siteSlug]/[entitySlug]/page.jsx 共享渲染逻辑。

import { notFound } from "next/navigation";
import { loadSiteBySlug } from "./_lib/loadSite";
import {
  resolveEntity,
  buildEntityBodyMarkdown,
  getRenderableSlugs,
  rewriteWikilinks,
} from "./_lib/renderEntity";
import SiteShell from "./_components/SiteShell";

export const revalidate = 60; // ISR：60 秒缓存，用户编辑后最迟 60 秒生效

function safeLang(raw) {
  return raw === "zh" ? "zh" : "en";
}

export async function generateMetadata({ params, searchParams }) {
  const { siteSlug } = await params;
  const sp = (await searchParams) || {};
  const lang = safeLang(sp.lang);
  const site = await loadSiteBySlug(siteSlug);
  if (!site) return { title: "Workplay · 页面不存在" };
  const isZh = lang === "zh";
  const name = (isZh ? site.data.name_zh : site.data.name) || site.display_name;
  const tagline = (isZh ? site.data.tagline_zh : site.data.tagline) || "";
  return {
    title: `${name} — ${site.data.siteName || "Workplay"}`,
    description: tagline || (isZh ? `关于 ${name} 的人物条目。` : `Biographical article on ${name}.`),
  };
}

export default async function SiteHomePage({ params, searchParams }) {
  const { siteSlug } = await params;
  const sp = (await searchParams) || {};
  const lang = safeLang(sp.lang);

  const site = await loadSiteBySlug(siteSlug);
  if (!site) notFound();

  const resolved = resolveEntity(site.data, null);
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
