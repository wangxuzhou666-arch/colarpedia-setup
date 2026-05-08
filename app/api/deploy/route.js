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
} from "@/app/setup/lib/templates";

export const runtime = "nodejs";
export const maxDuration = 60;

const TEMPLATE_OWNER = "wangxuzhou666-arch";
const TEMPLATE_REPO = "colarpedia-template";

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

  const { formData, photoBase64, photoExt } = body || {};
  if (!formData || !formData.name || !formData.homepageSlug) {
    return Response.json(
      { error: "Form data missing required fields (name, homepageSlug)." },
      { status: 400 }
    );
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
  const commitTag = "Yourpedia /setup auto-commit";

  // 2. Generate file contents
  const photoPath = photoBase64 && photoExt ? `public/portrait.${photoExt}` : null;
  const siteConfig = siteConfigTemplate(formData);
  const wikiEn = wikiPageTemplate(formData, { photoPath, lang: "en" });
  const hasZh =
    !!(formData.bio_zh || formData.tagline_zh || formData.name_zh) ||
    (formData.shipped || []).some((s) => s.description_zh);
  const wikiZh = hasZh
    ? wikiPageTemplate(formData, { photoPath, lang: "zh" })
    : null;

  try {
    // 3. Remove the Jane_Doe placeholder so the fork has a single
    // canonical bio page (theirs).
    if (
      (await deleteFileIfExists(
        octokit,
        owner,
        repo,
        "wiki/Jane_Doe.md",
        `${commitTag}: remove Jane_Doe placeholder`
      ))
    )
      operations.push("delete wiki/Jane_Doe.md");
    if (
      (await deleteFileIfExists(
        octokit,
        owner,
        repo,
        "wiki/Jane_Doe.zh.md",
        `${commitTag}: remove Jane_Doe.zh placeholder`
      ))
    )
      operations.push("delete wiki/Jane_Doe.zh.md");

    // 4. Commit user's content
    await putFile(
      octokit,
      owner,
      repo,
      "site.config.js",
      utf8ToBase64(siteConfig),
      `${commitTag}: site.config.js`
    );
    operations.push("write site.config.js");

    await putFile(
      octokit,
      owner,
      repo,
      `wiki/${formData.homepageSlug}.md`,
      utf8ToBase64(wikiEn),
      `${commitTag}: bio page (en)`
    );
    operations.push(`write wiki/${formData.homepageSlug}.md`);

    if (wikiZh) {
      await putFile(
        octokit,
        owner,
        repo,
        `wiki/${formData.homepageSlug}.zh.md`,
        utf8ToBase64(wikiZh),
        `${commitTag}: bio page (zh)`
      );
      operations.push(`write wiki/${formData.homepageSlug}.zh.md`);
    }

    if (photoBase64 && photoExt) {
      await putFile(
        octokit,
        owner,
        repo,
        `public/portrait.${photoExt}`,
        photoBase64, // already base64 from client
        `${commitTag}: portrait photo`
      );
      operations.push(`write public/portrait.${photoExt}`);
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