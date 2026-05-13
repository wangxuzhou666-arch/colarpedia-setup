// /api/upload-entity-logo — 给 entity（项目/学校/雇主）上传 infobox logo。
//
// 复用 portraits bucket（RLS 已允许 `{auth.uid}/*` 任意子路径）。
// 路径策略：
//   - 已登录：`{user_id}/entity-logos/{section}-{slug}-{ts}.{ext}` — RLS 友好
//   - 未登录：`_anonymous/{ts}-{rand}.{ext}` — 走 admin client，rate-limit 兜底
//
// 返回 public URL，前端写入 entity.logo 字段，跟随 sites.data 一起发布。
//
// Demo / 未登录用户也能上传（让陌生人完整试用），靠 Upstash rate-limit
// 防滥用：未登录 5/IP/day，登录 30/day。3 MB + jpg/png/webp 白名单。
// xhs launch 之后看用量再决定是否切 blob-only / 加 captcha。

import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import crypto from "crypto";
import { getSupabaseServerClient, getSupabaseAdminClient } from "../../../lib/supabase/server";

export const runtime = "nodejs";
export const maxDuration = 30;

const PHOTO_EXTS = new Set(["jpg", "jpeg", "png", "webp"]);
const ALLOWED_SECTIONS = new Set(["shipped", "educations", "experiences"]);
const MAX_BYTES = 3 * 1024 * 1024;

const HAS_UPSTASH =
  !!process.env.UPSTASH_REDIS_REST_URL && !!process.env.UPSTASH_REDIS_REST_TOKEN;

let uploadAnonLimiter = null;
let uploadAuthLimiter = null;
if (HAS_UPSTASH) {
  const redis = new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL,
    token: process.env.UPSTASH_REDIS_REST_TOKEN,
  });
  uploadAnonLimiter = new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(5, "24 h"),
    analytics: true,
    prefix: "rl:upload-anon",
  });
  uploadAuthLimiter = new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(30, "24 h"),
    analytics: true,
    prefix: "rl:upload-auth",
  });
}

function clientIp(req) {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    "unknown"
  );
}

function anonKey(req) {
  const ip = clientIp(req);
  const ua = req.headers.get("user-agent") || "unknown";
  const day = new Date().toISOString().slice(0, 10);
  return crypto
    .createHash("sha256")
    .update(`${ip}|${ua}|${day}`)
    .digest("hex")
    .slice(0, 16);
}

async function checkUploadRateLimit(req, userId) {
  if (!HAS_UPSTASH) return { ok: true };
  try {
    if (userId) {
      const r = await uploadAuthLimiter.limit(userId);
      return { ok: r.success, remaining: r.remaining, reset: r.reset, limit: r.limit };
    }
    const r = await uploadAnonLimiter.limit(anonKey(req));
    return { ok: r.success, remaining: r.remaining, reset: r.reset, limit: r.limit };
  } catch (e) {
    // Fail-open（同 lib/ratelimit.js 决策）
    console.error("[upload-ratelimit] Upstash error, failing open:", e.message);
    return { ok: true, _failOpen: true };
  }
}

function safeSlugSegment(s) {
  return String(s || "")
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 48) || "entity";
}

export async function POST(request) {
  // 1. 身份（未登录也允许通过，userId 为 null）
  let userId = null;
  try {
    const supabase = await getSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    userId = user?.id || null;
  } catch {
    // 静默：未登录走匿名路径，登录失败也降级匿名
  }

  // 2. rate-limit（5/IP/day 匿名，30/day 登录）
  const rl = await checkUploadRateLimit(request, userId);
  if (!rl.ok) {
    return Response.json(
      {
        error: userId
          ? "今天上传次数用完了，明天再试"
          : "今天匿名上传额度用完，登录后可上传更多",
        requireAuth: !userId,
      },
      { status: 429 }
    );
  }

  // 3. body
  let body;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "请求格式不对" }, { status: 400 });
  }
  const { base64, ext, section, slug } = body || {};
  if (!base64) return Response.json({ error: "缺少图片数据" }, { status: 400 });
  const safeExt = String(ext || "").toLowerCase();
  if (!PHOTO_EXTS.has(safeExt)) {
    return Response.json({ error: "图片格式不支持（请用 jpg/png/webp）" }, { status: 400 });
  }
  if (!ALLOWED_SECTIONS.has(section)) {
    return Response.json({ error: "section 不合法" }, { status: 400 });
  }

  // 4. decode + size guard
  let buffer;
  try {
    buffer = Buffer.from(base64, "base64");
  } catch {
    return Response.json({ error: "图片解码失败" }, { status: 400 });
  }
  if (buffer.length > MAX_BYTES) {
    return Response.json({ error: "图片太大（最多 3 MB）" }, { status: 400 });
  }

  // 5. 上传 — 登录用户进 `{user_id}/entity-logos/...`，匿名进 `_anonymous/...`
  const ts = Date.now().toString(36);
  const rand = crypto.randomBytes(4).toString("hex");
  const path = userId
    ? `${userId}/entity-logos/${section}-${safeSlugSegment(slug)}-${ts}.${safeExt}`
    : `_anonymous/${ts}-${rand}.${safeExt}`;
  const contentType =
    safeExt === "png" ? "image/png"
      : safeExt === "webp" ? "image/webp"
        : "image/jpeg";

  const admin = getSupabaseAdminClient();
  const { error: uploadError } = await admin.storage
    .from("portraits")
    .upload(path, buffer, { contentType, upsert: false });
  if (uploadError) {
    return Response.json({ error: `上传失败：${uploadError.message}` }, { status: 500 });
  }

  const { data } = admin.storage.from("portraits").getPublicUrl(path);
  return Response.json({ url: data.publicUrl, path });
}
