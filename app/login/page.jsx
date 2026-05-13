"use client";

// Magic link 登录页：用户输邮箱 → Supabase 发一封登录链接邮件 → 用户点链接
// 回到 /auth/callback 完成 session 建立 → 跳转到 next 参数指定的页面（默认 /yourpedia）。

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
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
            Workplay
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
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get("next") || "/yourpedia";
  const presetError = searchParams.get("error") || "";
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(presetError);
  const [sent, setSent] = useState(false);
  const [code, setCode] = useState("");
  const [verifying, setVerifying] = useState(false);

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

  // 跨设备 fallback：用户在邮件里复制 6 位 token，回原始设备粘贴 → 走 token verify
  // 不依赖 PKCE code_verifier（cookie 是 device-bound 的），所以跨设备可用
  const handleVerifyOtp = async (e) => {
    e.preventDefault();
    const token = code.trim();
    if (!/^\d{6}$/.test(token)) {
      setError("验证码是 6 位数字");
      return;
    }
    setVerifying(true);
    setError("");
    try {
      const supabase = getSupabaseBrowserClient();
      const { error: verifyError } = await supabase.auth.verifyOtp({
        email: email.trim(),
        token,
        type: "email",
      });
      if (verifyError) throw verifyError;
      router.replace(next);
    } catch (err) {
      setError(humanizeAuthError(err.message));
    } finally {
      setVerifying(false);
    }
  };

  return (
    <LoginShell>
      {sent ? (
        <>
          <div className="upload-info" style={{ marginTop: 24, padding: 16 }}>
            已经给 <strong>{email}</strong> 发了一封登录邮件。
            <br />
            <strong>同一设备收的邮件</strong>：直接点邮件里的链接登录。
            <br />
            <strong>不同设备</strong>（比如手机收邮件，电脑登录）：用邮件里的 6 位验证码，填到下面。
            <div style={{ marginTop: 10, fontSize: "0.9em", color: "var(--wiki-text-soft)" }}>
              没收到？看下垃圾邮件 / 推广邮件文件夹，或{" "}
              <button
                type="button"
                onClick={() => {
                  setSent(false);
                  setEmail("");
                  setCode("");
                  setError("");
                }}
                className="deploy-card-link"
                style={{ background: "none", border: "none", padding: 0, cursor: "pointer" }}
              >
                重发一封
              </button>
              。
            </div>
          </div>
          <form onSubmit={handleVerifyOtp} style={{ marginTop: 16 }}>
            <div className="setup-field">
              <label className="setup-label">6 位验证码</label>
              <input
                type="text"
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                className="setup-input"
                placeholder="6 位验证码"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                disabled={verifying}
                style={
                  code.length > 0
                    ? {
                        letterSpacing: "8px",
                        fontFamily:
                          "ui-monospace, SFMono-Regular, Menlo, monospace",
                        fontSize: "22px",
                        fontWeight: 600,
                        textAlign: "center",
                      }
                    : { fontSize: "16px" }
                }
              />
              <div className="setup-help">
                从邮件里复制粘贴最快。
              </div>
            </div>
            {error && <div className="setup-error">{error}</div>}
            <button
              type="submit"
              disabled={verifying || code.length !== 6}
              className="setup-button-primary"
              style={{ marginTop: 16 }}
            >
              {verifying ? "正在登录…" : "验证并登录"}
            </button>
          </form>
        </>
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
  if (/expired|expir/i.test(m)) {
    return "验证码过期了，点上面「重发一封」拿新的。";
  }
  if (/token|otp|invalid/i.test(m)) {
    return "验证码不对，再检查一下，或点「重发一封」。";
  }
  if (/network|fetch/i.test(m)) {
    return "网络请求失败，过几秒再试。";
  }
  return m || "登录失败，再试一次。";
}
