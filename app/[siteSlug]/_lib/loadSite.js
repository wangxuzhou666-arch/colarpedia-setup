// 服务端：根据 slug 查 site 行（公开读，绕过 cookie session）

import { getSupabaseAdminClient } from "../../../lib/supabase/server";

export async function loadSiteBySlug(slug) {
  if (!slug || typeof slug !== "string") return null;
  const admin = getSupabaseAdminClient();
  const { data, error } = await admin
    .from("sites")
    .select("slug, display_name, data, photo_url, published_at")
    .eq("slug", slug)
    .maybeSingle();
  if (error || !data) return null;
  return data;
}
