// /api/deploy — uses the user's GitHub OAuth access_token to:
//   1. Fork wangxuzhou666-arch/colarpedia-template into the user's account
//      (or reuse an existing fork if they ran this before).
//   2. Wait for the fork to become readable (GitHub fork creation is async).
//   3. Delete the Jane_Doe placeholder pages from the fork.
//   4. Commit the user's site.config.js, wiki/<Slug>.md, optional .zh.md,
//      and optional portrait photo.
//   5. Return the fork URL + a Vercel one-click deploy URL.
//
// Access token is read from the JWT cookie via getToken — never sent to
// the client, never logged, never persisted.

import { Octokit } from "@octokit/rest";
import { getToken } from "next-auth/jwt";
import {
  siteConfigTemplate,
  wikiPageTemplate,
  projectPageTemplate,
  institutionPageTemplate,
  indexPageTemplate,
} from "@/app/setup/lib/templates";

export const runtime = "nodejs";
export const maxDuration = 60;

const TEMPLATE_OWNER = "wangxuzhou666-arch";
const TEMPLATE_REPO = "colarpedia-template";

// Server-side slug guard. Defends against a hostile or buggy client
// that bypasses the form's zod check and posts a path-traversal slug
// (e.g. "../.github/workflows/x") which would otherwise be interpolated
// into wiki/<slug>.md and committed to the user's fork at an attacker-
// chosen path. Mirrors the LLM tool schema pattern + adds length cap.
const SLUG_RE = /^[A-Z][A-Za-z0-9_]{0,63}$/;

function badRequest(message) {
  return Response.json({ error: message }, { status: 400 });
}

function validateSlug(s, where) {
  if (typeof s !== "string" || !SLUG_RE.test(s)) {
    return `Invalid slug at ${where}: must match Title_Case_With_Underscores (≤64 chars). Got: ${JSON.stringify(s)}`;
  }
  return null;
}

// --- helpers ---------------------------------------------------------

function utf8ToBase64(s) {
  // Server runs in Node — Buffer is the simplest reliable encoder.
  return Buffer.from(s, "utf8").toString("base64");
}

async function getFileShaIfExists(octokit, owner, repo, path) {
  try {
    const r = await octokit.repos.getContent({ owner, repo, path });
    if (Array.isArray(r.data)) return null; // it's a directory
    return r.data.sha;
  } catch (e) {
    if (e.status === 404) return null;
    throw e;
  }
}

async function putFile(octokit, owner, repo, path, contentBase64, message) {
  const sha = await getFileShaIfExists(octokit, owner, repo, path);
  await octokit.repos.createOrUpdateFileContents({
    owner,
    repo,
    path,
    message,
    content: contentBase64,
    sha: sha || undefined,
  });
}

async function deleteFileIfExists(octokit, owner, repo, path, message) {
  const sha = await getFileShaIfExists(octokit, owner, repo, path);
  if (!sha) return false;
  await octokit.repos.deleteFile({ owner, repo, path, message, sha });
  return true;
}

async function ensureForkExists(octokit, login) {
  // 1. Already forked?
  try {
    const r = await octokit.repos.get({ owner: login, repo: TEMPLATE_REPO });
    if (r.data) return { existed: true, repo: r.data };
  } catch (e) {
    if (e.status !== 404) throw e;
  }
  // 2. Create fork
  await octokit.repos.createFork({
    owner: TEMPLATE_OWNER,
    repo: TEMPLATE_REPO,
  });
  // 3. Poll until the fork is queryable
  const start = Date.now();
  while (Date.now() - start < 30_000) {
    try {
      const r = await octokit.repos.get({
        owner: login,
        repo: TEMPLATE_REPO,
      });
      if (r.data) return { existed: false, repo: r.data };
    } catch (e) {
      if (e.status !== 404) throw e;
    }
    await new Promise((res) => setTimeout(res, 1500));
  }
  throw new Error(
    "Fork creation timed out after 30s — try again, GitHub is sometimes slow."
  );
}

// --- handler ---------------------------------------------------------

export async function POST(req) {
  const token = await getToken({ req, secret: process.env.AUTH_SECRET });
  if (!token?.accessToken || !token?.githubLogin) {
    return Response.json(
      { error: "Not signed in. Click 'Sign in with GitHub' first." },
      { status: 401 }
    );
  }

  let body;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const { formData, photoBase64, photoExt, projectThumbs } = body || {};
  if (!formData || !formData.name || !formData.homepageSlug) {
    return badRequest("Form data missing required fields (name, homepageSlug).");
  }

  // -------- Slug validation (B1 + B4) --------
  // Re-validate every slug server-side regardless of what the client
  // claims zod approved. Bio's homepageSlug is required; entity slugs
  // are optional (empty = skip standalone page, only bio bullet).
  const slugErr = validateSlug(formData.homepageSlug, "homepageSlug");
  if (slugErr) return badRequest(slugErr);

  const checkOptional = (arr, field) => {
    for (let i = 0; i < (arr || []).length; i++) {
      const slug = arr[i]?.slug;
      if (!slug) continue;
      const err = validateSlug(slug, `${field}[${i}].slug`);
      if (err) return err;
    }
    return null;
  };
  for (const [arr, field] of [
    [formData.shipped, "shipped"],
    [formData.educations, "educations"],
    [formData.experiences, "experiences"],
  ]) {
    const err = checkOptional(arr, field);
    if (err) return badRequest(err);
  }

  // Collision check across the whole payload — two entities with the
  // same slug would silently overwrite each other's wiki/<slug>.md.
  const slugList = [
    { slug: formData.homepageSlug, where: "homepageSlug" },
    ...(formData.shipped || [])
      .map((s, i) => ({ slug: s?.slug, where: `shipped[${i}]` }))
      .filter((x) => x.slug),
    ...(formData.educations || [])
      .map((e, i) => ({ slug: e?.slug, where: `educations[${i}]` }))
      .filter((x) => x.slug),
    ...(formData.experiences || [])
      .map((e, i) => ({ slug: e?.slug, where: `experiences[${i}]` }))
      .filter((x) => x.slug),
  ];
  const seen = new Map();
  for (const { slug, where } of slugList) {
    if (seen.has(slug)) {
      return badRequest(
        `Duplicate slug "${slug}" (${seen.get(slug)} and ${where}). Each entity must have a unique slug.`
      );
    }
    seen.set(slug, where);
  }

  const login = token.githubLogin;
  const octokit = new Octokit({ auth: token.accessToken });

  // 1. Fork (or reuse)
  let forkInfo;
  try {
    forkInfo = await ensureForkExists(octokit, login);
  } catch (e) {
    return Response.json(
      { error: `Fork failed: ${e.message}` },
      { status: 502 }
    );
  }

  const owner = login;
  const repo = TEMPLATE_REPO;
  const branch = forkInfo.repo?.default_branch || "main";
  void branch; // reserved for future per-branch commits

  const operations = []; // log for debugging / response payload
  const commitTag = "Workplay /setup auto-commit";

  // 2. Generate file contents
  const photoPath = photoBase64 && photoExt ? `public/portrait.${photoExt}` : null;

  // Sanitize incoming thumbs and build an idx → metadata map. We trust
  // the client only for { idx, slug, ext, base64 }; everything else
  // (where files land, what HTML the wiki ends up with) is decided
  // here.
  const cleanThumbs = Array.isArray(projectThumbs)
    ? projectThumbs.filter(
        (t) =>
          t &&
          Number.isInteger(t.idx) &&
          typeof t.slug === "string" &&
          /^[A-Za-z0-9_-]+$/.test(t.slug) &&
          typeof t.ext === "string" &&
          /^(jpg|jpeg|png|webp|pdf)$/i.test(t.ext) &&
          typeof t.base64 === "string" &&
          t.base64.length > 0
      )
    : [];
  const thumbByIdx = new Map(cleanThumbs.map((t) => [t.idx, t]));

  // Enrich shipped[] with thumbnailPath BEFORE wikiPageTemplate runs,
  // so the bio's Notable works lines pick up <img> tags for projects
  // that have thumbnails uploaded.
  const enrichedFormData = {
    ...formData,
    shipped: (formData.shipped || []).map((s, idx) => {
      const t = thumbByIdx.get(idx);
      if (!t) return s;
      return { ...s, thumbnailPath: `/projects/${t.slug}.${t.ext}` };
    }),
  };

  // Detect zh content across ALL entity arrays — bio + projects + edu + exp.
  const hasZh =
    !!(enrichedFormData.bio_zh || enrichedFormData.tagline_zh || enrichedFormData.name_zh) ||
    (enrichedFormData.shipped || []).some(
      (s) => s.description_zh || s.body_zh || s.name_zh
    ) ||
    (enrichedFormData.educations || []).some(
      (e) => e.body_zh || e.name_zh || e.degree_zh
    ) ||
    (enrichedFormData.experiences || []).some(
      (e) => e.body_zh || e.name_zh || e.role_zh
    );

  const ctx = {
    homepageSlug: enrichedFormData.homepageSlug,
    name: enrichedFormData.name,
    name_zh: enrichedFormData.name_zh,
  };

  // Build the full file list ahead of the commit loop. Each entry =
  // { path, content, summary } where content is utf8 string OR base64
  // (for binary). isBase64=true marks pre-encoded payloads.
  const filesToWrite = [];

  filesToWrite.push({
    path: "site.config.js",
    content: siteConfigTemplate(enrichedFormData),
    summary: "site.config.js",
  });

  // Bio
  filesToWrite.push({
    path: `wiki/${enrichedFormData.homepageSlug}.md`,
    content: wikiPageTemplate(enrichedFormData, { photoPath, lang: "en" }),
    summary: "bio page (en)",
  });
  if (hasZh) {
    filesToWrite.push({
      path: `wiki/${enrichedFormData.homepageSlug}.zh.md`,
      content: wikiPageTemplate(enrichedFormData, { photoPath, lang: "zh" }),
      summary: "bio page (zh)",
    });
  }

  // Per-project pages
  for (const p of enrichedFormData.shipped || []) {
    if (!p.slug || !p.name) continue;
    filesToWrite.push({
      path: `wiki/${p.slug}.md`,
      content: projectPageTemplate(p, ctx, { lang: "en" }),
      summary: `project page ${p.slug} (en)`,
    });
    if (hasZh) {
      filesToWrite.push({
        path: `wiki/${p.slug}.zh.md`,
        content: projectPageTemplate(p, ctx, { lang: "zh" }),
        summary: `project page ${p.slug} (zh)`,
      });
    }
  }

  // Per-education pages
  for (const e of enrichedFormData.educations || []) {
    if (!e.slug || !e.name) continue;
    filesToWrite.push({
      path: `wiki/${e.slug}.md`,
      content: institutionPageTemplate(e, ctx, "education", { lang: "en" }),
      summary: `education page ${e.slug} (en)`,
    });
    if (hasZh) {
      filesToWrite.push({
        path: `wiki/${e.slug}.zh.md`,
        content: institutionPageTemplate(e, ctx, "education", { lang: "zh" }),
        summary: `education page ${e.slug} (zh)`,
      });
    }
  }

  // Per-experience pages
  for (const ex of enrichedFormData.experiences || []) {
    if (!ex.slug || !ex.name) continue;
    filesToWrite.push({
      path: `wiki/${ex.slug}.md`,
      content: institutionPageTemplate(ex, ctx, "experience", { lang: "en" }),
      summary: `experience page ${ex.slug} (en)`,
    });
    if (hasZh) {
      filesToWrite.push({
        path: `wiki/${ex.slug}.zh.md`,
        content: institutionPageTemplate(ex, ctx, "experience", { lang: "zh" }),
        summary: `experience page ${ex.slug} (zh)`,
      });
    }
  }

  // Auto index
  filesToWrite.push({
    path: "wiki/index.md",
    content: indexPageTemplate(enrichedFormData, { lang: "en" }),
    summary: "wiki index (en)",
  });
  if (hasZh) {
    filesToWrite.push({
      path: "wiki/index.zh.md",
      content: indexPageTemplate(enrichedFormData, { lang: "zh" }),
      summary: "wiki index (zh)",
    });
  }

  try {
    // 3. Remove the Jane_Doe placeholders so the fork has a clean canonical wiki.
    for (const placeholder of [
      "wiki/Jane_Doe.md",
      "wiki/Jane_Doe.zh.md",
    ]) {
      if (
        await deleteFileIfExists(
          octokit,
          owner,
          repo,
          placeholder,
          `${commitTag}: remove ${placeholder}`
        )
      ) {
        operations.push(`delete ${placeholder}`);
      }
    }

    // 4. Commit all content files. One commit per file (Contents API
    // doesn't support multi-file atomic commits without dropping to
    // the lower-level Tree API — fine for now since N is small).
    for (const f of filesToWrite) {
      await putFile(
        octokit,
        owner,
        repo,
        f.path,
        utf8ToBase64(f.content),
        `${commitTag}: ${f.summary}`
      );
      operations.push(`write ${f.path}`);
    }

    // 5. Portrait photo (binary, already base64 from client)
    if (photoBase64 && photoExt) {
      await putFile(
        octokit,
        owner,
        repo,
        `public/portrait.${photoExt}`,
        photoBase64,
        `${commitTag}: portrait photo`
      );
      operations.push(`write public/portrait.${photoExt}`);
    }

    // 6. Per-project thumbnails (binary)
    for (const t of cleanThumbs) {
      const path = `public/projects/${t.slug}.${t.ext.toLowerCase()}`;
      await putFile(
        octokit,
        owner,
        repo,
        path,
        t.base64,
        `${commitTag}: project thumbnail (${t.slug})`
      );
      operations.push(`write ${path}`);
    }
  } catch (e) {
    return Response.json(
      {
        error: `Commit failed: ${e.message}`,
        partial: operations,
      },
      { status: 502 }
    );
  }

  const forkUrl = `https://github.com/${owner}/${repo}`;
  const vercelDeployUrl = `https://vercel.com/new/clone?repository-url=${encodeURIComponent(
    forkUrl
  )}&project-name=${encodeURIComponent(
    formData.homepageSlug?.toLowerCase().replace(/_/g, "-") || "my-wiki"
  )}`;

  return Response.json({
    success: true,
    forkExisted: forkInfo.existed,
    forkUrl,
    vercelDeployUrl,
    operations,
  });
}