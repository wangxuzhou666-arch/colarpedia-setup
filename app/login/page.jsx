"use client";

// Magic link 登录页：用户输邮箱 → Supabase 发一封登录链接邮件 → 用户点链接
// 回到 /auth/callback 完成 session 建立 → 跳转到 next 参数指定的页面（默认 /setup）。

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { getSupabaseBrowserClient } from "../../lib/supabase/client";

export default function LoginPage() {
  return (
    <Suspense fallback={<LoginShell><div className="setup-help" style={{ marginTop: 24 }}>正在加载…</div></LoginShell>}>
      <LoginInner />
    </Suspense>
  );
}

function LoginShell({ children }) {
  return (
    <>
      <div className="wiki-topbar">
        <div className="wiki-topbar-inner">
          <a href="/" className="wiki-logo">
            Yourpedia
            <span>把你的简历变成像维基百科的个人主页</span>
          </a>
        </div>
      </div>
      <main className="setup-shell">
        <h1 className="wiki-title">登录</h1>
        <p className="wiki-title-sub">
          填邮箱，我们发一封登录链接给你 · 不需要记密码
        </p>
        {children}
      </main>
    </>
  );
}

function LoginInner() {
  const searchParams = useSearchParams();
  const next = searchParams.get("next") || "/setup";
  const presetError = searchParams.get("error") || "";
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(presetError);
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email.trim()) {
      setError("邮箱不能为空");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const supabase = getSupabaseBrowserClient();
      const redirectTo = `${window.location.origin}/auth/callback?next=${encodeURIComponent(
        next
      )}`;
      const { error: signInError } = await supabase.auth.signInWithOtp({
        email: email.trim(),
        options: { emailRedirectTo: redirectTo },
      });
      if (signInError) throw signInError;
      setSent(true);
    } catch (err) {
      setError(humanizeAuthError(err.message));
    } finally {
      setBusy(false);
    }
  };

  return (
    <LoginShell>
      {sent ? (
        <div className="upload-info" style={{ marginTop: 24, padding: 16 }}>
          已经给 <strong>{email}</strong> 发了一封登录邮件。
          <br />
          打开邮箱点里面的链接就能登录（链接 1 小时内有效）。
          <div style={{ marginTop: 10, fontSize: "0.9em", color: "var(--wiki-text-soft)" }}>
            没收到？看下垃圾邮件 / 推广邮件文件夹，或{" "}
            <button
              type="button"
              onClick={() => {
                setSent(false);
                setEmail("");
              }}
              className="deploy-card-link"
              style={{ background: "none", border: "none", padding: 0, cursor: "pointer" }}
            >
              重发一封
            </button>
            。
          </div>
        </div>
      ) : (
        <form onSubmit={handleSubmit} style={{ marginTop: 24 }}>
          <div className="setup-field">
            <label className="setup-label setup-label-required">邮箱</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="setup-input"
              placeholder="you@example.com"
              autoComplete="email"
              disabled={busy}
              required
            />
            <div className="setup-help">
              我们会给这个邮箱发一封带登录链接的邮件，点链接就完成登录。
              没有密码，不用记。
            </div>
          </div>
          {error && <div className="setup-error">{error}</div>}
          <button
            type="submit"
            disabled={busy || !email.trim()}
            className="setup-button-primary"
            style={{ marginTop: 16 }}
          >
            {busy ? "正在发送…" : "发送登录链接"}
          </button>
        </form>
      )}
    </LoginShell>
  );
}

function humanizeAuthError(msg) {
  const m = String(msg || "");
  if (/rate limit|too many/i.test(m)) {
    return "请求太频繁了，等几分钟再试。";
  }
  if (/invalid email/i.test(m)) {
    return "邮箱格式不对，再检查一下。";
  }
  if (/network|fetch/i.test(m)) {
    return "网络请求失败，过几秒再试。";
  }
  return m || "登录失败，再试一次。";
}
