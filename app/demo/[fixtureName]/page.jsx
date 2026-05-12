// /demo/<fixtureName>/ — 示例 wiki 的 bio 主页（复用 hosted 渲染管线）。

import { notFound } from "next/navigation";
import { getFixture } from "../../../lib/demoFixtures";
import {
  resolveEntity,
  buildEntityBodyMarkdown,
  getRenderableSlugs,
  rewriteWikilinks,
} from "../../[siteSlug]/_lib/renderEntity";
import SiteShell from "../../[siteSlug]/_components/SiteShell";

function safeLang(raw) {
  return raw === "zh" ? "zh" : "en";
}

export async function generateMetadata({ params, searchParams }) {
  const { fixtureName } = await params;
  const sp = (await searchParams) || {};
  const lang = safeLang(sp.lang);
  const fx = getFixture(fixtureName);
  if (!fx) return { title: "Workplay · 示例不存在" };
  const isZh = lang === "zh";
  const name = (isZh ? fx.data.name_zh : fx.data.name) || fx.data.name;
  return {
    title: `${name} — ${fx.data.siteName || "Workplay"}（示例）`,
    description: (isZh ? fx.data.tagline_zh : fx.data.tagline) || "",
  };
}

export default async function DemoBio({ params, searchParams }) {
  const { fixtureName } = await params;
  const sp = (await searchParams) || {};
  const lang = safeLang(sp.lang);

  const fx = getFixture(fixtureName);
  if (!fx) notFound();

  const resolved = resolveEntity(fx.data, null);
  if (!resolved) notFound();

  const renderableSlugs = getRenderableSlugs(fx.data);
  const rawBody = buildEntityBodyMarkdown(fx.data, resolved, lang);
  const siteSlugPath = `demo/${fixtureName}`;
  const body = rewriteWikilinks(rawBody, siteSlugPath, renderableSlugs);

  return (
    <SiteShell
      siteSlug={siteSlugPath}
      siteData={fx.data}
      photoUrl={fx.photo_url}
      resolved={resolved}
      body={body}
      lang={lang}
    />
  );
}
