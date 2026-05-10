"use client";

// 浏览器端 Supabase client，用于 magic link 触发、读取 session、订阅 auth 状态变化。
// 永远不要在这里用 service_role key —— 浏览器 bundle 会泄漏。

import { createBrowserClient } from "@supabase/ssr";

let cached = null;

export function getSupabaseBrowserClient() {
  if (cached) return cached;
  cached = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );
  return cached;
}