// Client-side zip generator. Runs entirely in the user's browser —
// no API endpoint, no server compute.
//
// Sprint 1: emits multi-page wiki — bio + per-project + per-education
// + per-experience + auto-index, en + zh.

import JSZip from "jszip";
import {
  siteConfigTemplate,
  wikiPageTemplate,
  projectPageTemplate,
  institutionPageTemplate,
  indexPageTemplate,
  readmeTemplate,
} from "./templates";

// Lazy fetch + cache the template bundle JSON.
let _templateBundleCache = null;
async function loadTemplateBundle() {
  if (_templateBundleCache) return _templateBundleCache;
  try {
    const res = await fetch("/template-bundle.json");
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    _templateBundleCache = await res.json();
    return _templateBundleCache;
  } catch (e) {
    console.warn("[generator] template bundle unavailable:", e.message);
    return null;
  }
}

function base64ToUint8Array(b64) {
  const bin = atob(b64);
  const arr = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
  return arr;
}

const TEMPLATE_OVERRIDES = new Set([
  "site.config.js",
  "README.md",
  "wiki/Jane_Doe.md",
  "wiki/Jane_Doe.zh.md",
  "wiki/index.md",
  "wiki/log.md",
]);

const PHOTO_EXT_BY_TYPE = {
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

function photoExtension(file) {
  if (!file) return null;
  const byType = PHOTO_EXT_BY_TYPE[file.type];
  if (byType) return byType;
  const dot = file.name.lastIndexOf(".");
  if (dot >= 0) return file.name.slice(dot + 1).toLowerCase();
  return "jpg";
}

// Detect whether the payload has any zh content. Drives whether we
// emit the .zh.md mirrors at all.
function detectHasZh(data) {
  if (data.bio_zh || data.tagline_zh || data.name_zh) return true;
  if ((data.shipped || []).some((s) => s.description_zh || s.body_zh || s.name_zh)) return true;
  if ((data.educations || []).some((e) => e.body_zh || e.name_zh || e.degree_zh)) return true;
  if ((data.experiences || []).some((e) => e.body_zh || e.name_zh || e.role_zh)) return true;
  return false;
}

/**
 * Build the deliverable zip.
 *
 * @param {object} data            zod-validated form data
 * @param {object} [files]         optional file payloads
 * @param {File}   [files.pdfFile] original résumé PDF (archived in raw/)
 * @param {File}   [files.photoFile] portrait photo
 * @param {Array<{slug: string, ext: string, file: File}>} [files.projectThumbs]
 *        Per-project thumbnails (image or PDF) → public/projects/<slug>.<ext>.
 */
export async function generateZip(data, files = {}) {
  const zip = new JSZip();

  const photoExt = photoExtension(files.photoFile);
  const photoPath = photoExt ? `public/portrait.${photoExt}` : null;

  // 1. Layer the template bundle in first so user-generated files override.
  const bundle = await loadTemplateBundle();
  let bundleStats = { included: 0, skipped: 0 };
  if (bundle && Array.isArray(bundle.files)) {
    for (const f of bundle.files) {
      if (TEMPLATE_OVERRIDES.has(f.path)) {
        bundleStats.skipped += 1;
        continue;
      }
      zip.file(f.path, base64ToUint8Array(f.content));
      bundleStats.included += 1;
    }
  }

  const hasZh = detectHasZh(data);
  const ctx = {
    homepageSlug: data.homepageSlug,
    name: data.name,
    name_zh: data.name_zh,
  };

  // 2. site.config (with auto-populated sidebar)
  zip.file("site.config.js", siteConfigTemplate(data));

  // 3. Bio (en + zh if applicable)
  zip.file(
    `wiki/${data.homepageSlug}.md`,
    wikiPageTemplate(data, { photoPath, lang: "en" })
  );
  if (hasZh) {
    zip.file(
      `wiki/${data.homepageSlug}.zh.md`,
      wikiPageTemplate(data, { photoPath, lang: "zh" })
    );
  }

  // 4. Per-project pages
  for (const p of data.shipped || []) {
    if (!p.slug || !p.name) continue;
    zip.file(`wiki/${p.slug}.md`, projectPageTemplate(p, ctx, { lang: "en" }));
    if (hasZh) {
      zip.file(
        `wiki/${p.slug}.zh.md`,
        projectPageTemplate(p, ctx, { lang: "zh" })
      );
    }
  }

  // 5. Per-education pages
  for (const e of data.educations || []) {
    if (!e.slug || !e.name) continue;
    zip.file(
      `wiki/${e.slug}.md`,
      institutionPageTemplate(e, ctx, "education", { lang: "en" })
    );
    if (hasZh) {
      zip.file(
        `wiki/${e.slug}.zh.md`,
        institutionPageTemplate(e, ctx, "education", { lang: "zh" })
      );
    }
  }

  // 6. Per-experience pages
  for (const ex of data.experiences || []) {
    if (!ex.slug || !ex.name) continue;
    zip.file(
      `wiki/${ex.slug}.md`,
      institutionPageTemplate(ex, ctx, "experience", { lang: "en" })
    );
    if (hasZh) {
      zip.file(
        `wiki/${ex.slug}.zh.md`,
        institutionPageTemplate(ex, ctx, "experience", { lang: "zh" })
      );
    }
  }

  // 7. Auto index.md
  zip.file("wiki/index.md", indexPageTemplate(data, { lang: "en" }));
  if (hasZh) {
    zip.file("wiki/index.zh.md", indexPageTemplate(data, { lang: "zh" }));
  }

  // 8. README
  zip.file(
    "README.md",
    readmeTemplate(data, {
      hasPhoto: !!photoPath,
      hasOriginalPdf: !!files.pdfFile,
      includesTemplate: bundleStats.included > 0,
      hasChinese: hasZh,
    })
  );

  if (files.photoFile && photoPath) {
    zip.file(photoPath, files.photoFile);
  }

  if (Array.isArray(files.projectThumbs)) {
    for (const t of files.projectThumbs) {
      if (!t?.file || !t?.slug || !t?.ext) continue;
      zip.file(`public/projects/${t.slug}.${t.ext}`, t.file);
    }
  }

  if (files.pdfFile) {
    const safeName = files.pdfFile.name.replace(/[^A-Za-z0-9._-]/g, "_");
    zip.file(`raw/${safeName}`, files.pdfFile);
  }

  return zip.generateAsync({ type: "blob" });
}

export function triggerDownload(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
