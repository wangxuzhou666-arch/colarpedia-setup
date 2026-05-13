// /api/publish — hosted publishing path 的核心 endpoint。
//
// 流程：
//   1. 验证当前用户已登录 Supabase（cookie session）
//   2. 接收 formData + photoBase64 + photoExt
//   3. 上传头像到 storage.portraits/<user_id>/portrait.<ext>
//   4. 查或新建 sites 行（每个用户限一个 site，幂等 upsert by owner_id）
//   5. 第一次发布时分配 globally-unique slug；后续更新保持 slug 不变
//   6. 返回 { slug, url, isFirstPublish }
//
// 不做：rate limit（Supabase RLS 已限了 owner_id；如要防 spam 后续上 Upstash）

import { getSupabaseServerClient, getSupabaseAdminClient } from "../../../lib/supabase/server";
import { deriveSlug } from "../../yourpedia/lib/schema";

export const runtime = "nodejs";
export const maxDuration = 60;

// 保留路径——这些 slug 不能给用户用，会跟现有路由冲突
const RESERVED_SLUGS = new Set([
  "setup", "login", "auth", "api", "_next", "public", "wiki",
  "dashboard", "admin", "about", "help", "settings", "logout",
  "404", "500", "favicon",
]);

const PHOTO_EXTS = new Set(["jpg", "jpeg", "png", "webp"]);

function sanitizeBaseSlug(name) {
  // deriveSlug 输出 Title_Case_With_Underscores —— hosted 路由用 lowercase-with-dashes 更像现代 URL
  const raw = deriveSlug(String(name || "").trim()) || "user";
  return raw
    .toLowerCase()
    .replace(/_/g, "-")
    .replace(/[^a-z0-9-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 48) || "user";
}

async function findUniqueSlug(adminClient, baseSlug) {
  // 先试 base，再 base-2、base-3…… 上限 50 次（实际不会走到）
  for (let i = 0; i < 50; i++) {
    const candidate = i === 0 ? baseSlug : `${baseSlug}-${i + 1}`;
    if (RESERVED_SLUGS.has(candidate)) continue;
    const { data, error } = await adminClient
      .from("sites")
      .select("id")
      .eq("slug", candidate)
      .maybeSingle();
    if (error) throw new Error(`slug 查询失败：${error.message}`);
    if (!data) return candidate;
  }
  // 极端情况兜底：用时间戳后缀
  return `${baseSlug}-${Date.now().toString(36)}`;
}

async function uploadPhoto(adminClient, userId, base64, ext) {
  if (!base64 || !ext) return null;
  const safeExt = String(ext).toLowerCase();
  if (!PHOTO_EXTS.has(safeExt)) return null;
  const buffer = Buffer.from(base64, "base64");
  if (buffer.length > 3 * 1024 * 1024) {
    throw new Error("头像太大（最多 3 MB）");
  }
  const path = `${userId}/portrait.${safeExt}`;
  const contentType = safeExt === "png" ? "image/png" : safeExt === "webp" ? "image/webp" : "image/jpeg";
  // 用 admin client 上传——RLS 是按 user folder 隔离的，admin 绕过没问题（owner_id 已经在 path 第一段）
  const { error: uploadError } = await adminClient.storage
    .from("portraits")
    .upload(path, buffer, {
      contentType,
      upsert: true,
    });
  if (uploadError) throw new Error(`头像上传失败：${uploadError.message}`);
  const { data } = adminClient.storage.from("portraits").getPublicUrl(path);
  return data.publicUrl;
}

export async function POST(request) {
  // 1. 拿当前用户
  let user;
  try {
    const supabase = await getSupabaseServerClient();
    const { data: { user: authUser }, error: userError } = await supabase.auth.getUser();
    if (userError || !authUser) {
      return Response.json({ error: "请先登录" }, { status: 401 });
    }
    user = authUser;
  } catch (e) {
    return Response.json({ error: `身份验证失败：${e.message}` }, { status: 500 });
  }

  // 2. 解析 body
  let body;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "请求格式不对" }, { status: 400 });
  }
  const { formData, photoBase64, photoExt } = body || {};
  if (!formData || typeof formData !== "object") {
    return Response.json({ error: "缺少 formData" }, { status: 400 });
  }
  const displayName = String(formData.name_zh || formData.name || "").trim();
  if (!displayName) {
    return Response.json({ error: "请先填姓名" }, { status: 400 });
  }

  const admin = getSupabaseAdminClient();

  // 3. 看用户是否已经有 site（决定是 INSERT 还是 UPDATE）
  let existing;
  try {
    const { data, error } = await admin
      .from("sites")
      .select("id, slug")
      .eq("owner_id", user.id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    existing = data;
  } catch (e) {
    return Response.json({ error: `查询站点失败：${e.message}` }, { status: 500 });
  }

  // 4. 头像（先传，URL 进 sites.data）
  let photoUrl = null;
  try {
    photoUrl = await uploadPhoto(admin, user.id, photoBase64, photoExt);
  } catch (e) {
    return Response.json({ error: e.message }, { status: 400 });
  }

  // 5. 写 sites
  const now = new Date().toISOString();
  const dataPayload = {
    ...formData,
    // 记一下哪些字段在 publish 时是用户填的——后续编辑时方便对账
    _publishedAt: now,
  };

  if (existing) {
    // UPDATE：保留 slug、保留 published_at
    try {
      const { error } = await admin
        .from("sites")
        .update({
          display_name: displayName,
          data: dataPayload,
          ...(photoUrl ? { photo_url: photoUrl } : {}),
        })
        .eq("id", existing.id);
      if (error) throw new Error(error.message);
    } catch (e) {
      return Response.json({ error: `更新站点失败：${e.message}` }, { status: 500 });
    }
    return Response.json({
      slug: existing.slug,
      url: `/${existing.slug}/`,
      isFirstPublish: false,
    });
  }

  // INSERT：分配新 slug
  let slug;
  try {
    const baseSlug = sanitizeBaseSlug(formData.name || formData.name_zh);
    slug = await findUniqueSlug(admin, baseSlug);
  } catch (e) {
    return Response.json({ error: `slug 分配失败：${e.message}` }, { status: 500 });
  }

  try {
    const { error } = await admin.from("sites").insert({
      owner_id: user.id,
      slug,
      display_name: displayName,
      data: dataPayload,
      photo_url: photoUrl,
      published_at: now,
    });
    if (error) throw new Error(error.message);
  } catch (e) {
    return Response.json({ error: `创建站点失败：${e.message}` }, { status: 500 });
  }

  return Response.json({
    slug,
    url: `/${slug}/`,
    isFirstPublish: true,
  });
}
