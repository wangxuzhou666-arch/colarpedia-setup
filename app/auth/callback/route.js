// Magic link 回调：用户从邮件点链接进来后会带着 ?code=... 到这里。
// 我们用 code 换 session（Supabase 自动写 cookie），然后跳到 next 参数指定的页面。

import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "../../../lib/supabase/server";

export async function GET(request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const next = url.searchParams.get("next") || "/setup";

  // 安全检查：next 必须是站内相对路径，不能是 //evil.com 之类
  const safeNext = next.startsWith("/") && !next.startsWith("//") ? next : "/setup";

  if (!code) {
    return NextResponse.redirect(
      new URL(`/login?error=${encodeURIComponent("登录链接已失效，重新登录一次")}`, request.url)
    );
  }

  const supabase = await getSupabaseServerClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    return NextResponse.redirect(
      new URL(
        `/login?error=${encodeURIComponent("登录链接验证失败：" + error.message)}`,
        request.url
      )
    );
  }

  return NextResponse.redirect(new URL(safeNext, request.url));
}
