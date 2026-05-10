// 服务端 Supabase client。两个变体：
//   - getSupabaseServerClient(): 跟 cookie 绑定的会话 client，用于 server
//     component / route handler 里读取当前登录用户。RLS 会按用户身份生效。
//   - getSupabaseAdminClient(): 用 service_role key 的 admin client，绕过
//     RLS。**只用于** 不依赖用户身份的场景（如管理 slug 唯一性、读取任意
//     用户的 site 给 [slug] 路由渲染）。永远不要在 browser bundle 引用。

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { createClient } from "@supabase/supabase-js";

export async function getSupabaseServerClient() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options);
            });
          } catch {
            // server component 调用 setAll 会抛——session 刷新逻辑放
            // middleware 里就不会触发这里。
          }
        },
      },
    }
  );
}

let cachedAdmin = null;

export function getSupabaseAdminClient() {
  if (cachedAdmin) return cachedAdmin;
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error(
      "[supabase/server] SUPABASE_SERVICE_ROLE_KEY 未配置——admin client 无法初始化。"
    );
  }
  cachedAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  );
  return cachedAdmin;
}