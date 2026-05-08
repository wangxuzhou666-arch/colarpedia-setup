// Client-side zip generator. Runs entirely in the user's browser —
// no API endpoint, no server compute.

import JSZip from "jszip";
import {
  siteConfigTemplate,
  wikiPageTemplate,
  readmeTemplate,
} from "./templates";

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

  zip.file("site.config.js", siteConfigTemplate(data));
  zip.file(
    `wiki/${data.homepageSlug}.md`,
    wikiPageTemplate(data, { photoPath })
  );
  zip.file(
    "README.md",
    readmeTemplate(data, { hasPhoto: !!photoPath, hasOriginalPdf: !!files.pdfFile })
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