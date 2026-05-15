// Supabase auth session 自动刷新中间件。
// 没有这层的话，magic link 登录后的 cookie 在 server component 里读不到。

import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";

export async function middleware(request) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => {
            request.cookies.set(name, value);
          });
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options);
          });
        },
      },
    }
  );

  // 调用 getUser() 触发 session 刷新（如果有 refresh token 则换新 access token）。
  // 包 try/catch：refresh token 过期 / 无效时 supabase 会抛 AuthApiError，
  // 这种情况就当用户未登录、继续走匿名，绝不能让整个 middleware 500 把
  // 所有请求拖垮（前端会被包装成 next-auth ClientFetchError）。
  try {
    await supabase.auth.getUser();
  } catch (err) {
    // 过期 refresh token 是预期路径，不打 noisy log；其它错误才上报
    if (err?.code !== "refresh_token_not_found") {
      console.error("[middleware] supabase.auth.getUser failed:", err);
    }
  }

  return response;
}

export const config = {
  matcher: [
    // 跳过 Next.js 静态资源 + 图片优化
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};