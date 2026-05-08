#!/usr/bin/env node
//
// Snapshot the colarpedia-template repo into public/template-bundle.json.
// Runs at npm install / dev / build time so /api/parse and the client-side
// generator can include the full template inside the user's zip without
// requiring them to fork GitHub.
//
// Usage:  npm run bundle:template
//
// The output JSON is shaped:
//   {
//     "generatedAt": "2026-05-08T...",
//     "files": [
//       { "path": "package.json", "content": "<base64>", "binary": false },
//       { "path": "public/portrait.jpg", "content": "<base64>", "binary": true },
//       ...
//     ]
//   }

const fs = require("node:fs");
const path = require("node:path");

const TEMPLATE_ROOT = path.resolve(
  __dirname,
  "..",
  "..",
  "colarpedia-template"
);

const OUTPUT = path.resolve(__dirname, "..", "public", "template-bundle.json");

// Files / dirs to skip — anything users don't need or shouldn't ship
const IGNORE_DIRS = new Set([
  "node_modules",
  ".next",
  ".git",
  "out",
  "_drafts",
  ".vercel",
  ".claude",
  // Phase 1A's form-only setup route lives at app/setup/ inside the
  // template repo. Fork users don't want a /setup route on their
  // deployed wiki — they generate their wiki via Yourpedia (this tool),
  // not by running the form on their own deploy. Strip it.
  "setup",
]);

const IGNORE_FILES = new Set([
  ".DS_Store",
  ".env",
  ".env.local",
  "package-lock.json", // user re-installs anyway; saves 100KB
]);

const BINARY_EXTENSIONS = new Set([
  ".png", ".jpg", ".jpeg", ".gif", ".webp", ".ico",
  ".pdf", ".woff", ".woff2", ".ttf", ".otf",
]);

function isBinary(file) {
  const ext = path.extname(file).toLowerCase();
  return BINARY_EXTENSIONS.has(ext);
}

function walk(dir, baseDir, out) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.isDirectory()) {
      if (IGNORE_DIRS.has(entry.name)) continue;
      walk(path.join(dir, entry.name), baseDir, out);
    } else if (entry.isFile()) {
      if (IGNORE_FILES.has(entry.name)) continue;
      const abs = path.join(dir, entry.name);
      const rel = path.relative(baseDir, abs).replace(/\\/g, "/");
      const buf = fs.readFileSync(abs);
      out.push({
        path: rel,
        content: buf.toString("base64"),
        binary: isBinary(entry.name),
      });
    }
  }
}

if (!fs.existsSync(TEMPLATE_ROOT)) {
  console.error(
    `[bundle-template] template repo not found at ${TEMPLATE_ROOT}.\n` +
      `Skipping bundle. Make sure ~/Desktop/colarpedia-template exists, ` +
      `or update TEMPLATE_ROOT in scripts/bundle-template.js.`
  );
  // Write a minimal stub so the import chain doesn't break in production.
  fs.mkdirSync(path.dirname(OUTPUT), { recursive: true });
  fs.writeFileSync(
    OUTPUT,
    JSON.stringify(
      { generatedAt: new Date().toISOString(), files: [], stub: true },
      null,
      2
    )
  );
  process.exit(0);
}

const files = [];
walk(TEMPLATE_ROOT, TEMPLATE_ROOT, files);
files.sort((a, b) => a.path.localeCompare(b.path));

const bundle = {
  generatedAt: new Date().toISOString(),
  source: "colarpedia-template",
  files,
};

fs.mkdirSync(path.dirname(OUTPUT), { recursive: true });
fs.writeFileSync(OUTPUT, JSON.stringify(bundle));

const totalBytes = files.reduce((s, f) => s + f.content.length, 0);
console.log(
  `[bundle-template] wrote ${files.length} files to ` +
    `${path.relative(process.cwd(), OUTPUT)} (${(totalBytes / 1024).toFixed(1)} KB base64)`
);