// /demo/<fixtureName>/<entitySlug>/ — 示例 wiki 内的项目 / 教育 / 工作 子页面

import { notFound } from "next/navigation";
import { getFixture } from "../../../../lib/demoFixtures";
import {
  resolveEntity,
  buildEntityBodyMarkdown,
  getRenderableSlugs,
  rewriteWikilinks,
} from "../../../[siteSlug]/_lib/renderEntity";
import SiteShell from "../../../[siteSlug]/_components/SiteShell";

function safeLang(raw) {
  return raw === "zh" ? "zh" : "en";
}

export async function generateMetadata({ params, searchParams }) {
  const { fixtureName, entitySlug } = await params;
  const sp = (await searchParams) || {};
  const lang = safeLang(sp.lang);
  const fx = getFixture(fixtureName);
  if (!fx) return { title: "Yourpedia · 示例不存在" };
  const resolved = resolveEntity(fx.data, entitySlug);
  if (!resolved) return { title: "Yourpedia · 页面不存在" };
  if (resolved.kind === "bio") {
    return { title: `${fx.data.name} — ${fx.data.siteName}（示例）` };
  }
  const e = resolved.entity;
  const isZh = lang === "zh";
  const name = isZh && e.name_zh ? e.name_zh : e.name;
  return { title: `${name} — ${fx.data.siteName}（示例）` };
}

export default async function DemoEntity({ params, searchParams }) {
  const { fixtureName, entitySlug } = await params;
  const sp = (await searchParams) || {};
  const lang = safeLang(sp.lang);

  const fx = getFixture(fixtureName);
  if (!fx) notFound();

  const resolved = resolveEntity(fx.data, entitySlug);
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
