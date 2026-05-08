// Client-side zip generator. Runs entirely in the user's browser —
// no API endpoint, no server compute, compatible with `output: 'export'`.

import JSZip from "jszip";
import {
  siteConfigTemplate,
  wikiPageTemplate,
  readmeTemplate,
} from "./templates";

export async function generateZip(data) {
  const zip = new JSZip();

  zip.file("site.config.js", siteConfigTemplate(data));
  zip.file(`wiki/${data.homepageSlug}.md`, wikiPageTemplate(data));
  zip.file("README.md", readmeTemplate(data));

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
