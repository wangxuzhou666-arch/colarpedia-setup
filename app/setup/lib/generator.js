// Client-side zip generator. Runs entirely in the user's browser —
// no API endpoint, no server compute.

import JSZip from "jszip";
import {
  siteConfigTemplate,
  wikiPageTemplate,
  readmeTemplate,
} from "./templates";

// Lazy fetch + cache the template bundle JSON (build-time snapshot of
// the colarpedia-template repo). Lets users get a fully-runnable Next.js
// app in their zip — no GitHub fork, no manual file copying.
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

// Files we'll OVERRIDE with user's generated content. These already
// have a path-clash with the bundle — skip them from the bundle so the
// generator's own output wins.
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

/**
 * Build the deliverable zip.
 *
 * @param {object} data            form values (zod-validated)
 * @param {object} [files]         optional file payloads
 * @param {File}   [files.pdfFile] the original résumé PDF (archived under raw/)
 * @param {File}   [files.photoFile] portrait photo for the bio infobox
 */
export async function generateZip(data, files = {}) {
  const zip = new JSZip();

  const photoExt = photoExtension(files.photoFile);
  const photoPath = photoExt ? `public/portrait.${photoExt}` : null;

  // 1. Layer the template bundle in first so user-generated files can override.
  const bundle = await loadTemplateBundle();
  let bundleStats = { included: 0, skipped: 0 };
  if (bundle && Array.isArray(bundle.files)) {
    for (const f of bundle.files) {
      if (TEMPLATE_OVERRIDES.has(f.path)) {
        bundleStats.skipped += 1;
        continue;
      }
      const data8 = base64ToUint8Array(f.content);
      // JSZip handles binary vs text the same way for Uint8Array.
      zip.file(f.path, data8);
      bundleStats.included += 1;
    }
  }

  // 2. User-generated files (these win over any same-path bundle entry).
  zip.file("site.config.js", siteConfigTemplate(data));
  zip.file(
    `wiki/${data.homepageSlug}.md`,
    wikiPageTemplate(data, { photoPath })
  );
  zip.file(
    "README.md",
    readmeTemplate(data, {
      hasPhoto: !!photoPath,
      hasOriginalPdf: !!files.pdfFile,
      includesTemplate: bundleStats.included > 0,
    })
  );

  if (files.photoFile && photoPath) {
    zip.file(photoPath, files.photoFile);
  }

  if (files.pdfFile) {
    // Archive the original résumé so the user keeps a copy alongside
    // their generated wiki, and can re-feed it into a future Yourpedia
    // run if the schema changes.
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