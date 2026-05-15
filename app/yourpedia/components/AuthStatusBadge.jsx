"use client";

import { useEffect, useState } from "react";
import { getSupabaseBrowserClient } from "../../../lib/supabase/client";

export default function AuthStatusBadge() {
  const [state, setState] = useState({ loading: true, user: null });

  useEffect(() => {
    let mounted = true;
    const supabase = getSupabaseBrowserClient();
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!mounted) return;
      setState({ loading: false, user });
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, sess) => {
      if (!mounted) return;
      setState({ loading: false, user: sess?.user || null });
    });
    return () => {
      mounted = false;
      subscription?.unsubscribe();
    };
  }, []);

  const handleSignOut = async () => {
    const supabase = getSupabaseBrowserClient();
    await supabase.auth.signOut();
    setState({ loading: false, user: null });
  };

  if (state.loading) {
    return <div className="auth-status-badge auth-status-loading">…</div>;
  }

  if (state.user) {
    return (
      <div className="auth-status-badge">
        <span className="auth-status-dot" aria-hidden />
        <span className="auth-status-email">{state.user.email}</span>
        <button
          type="button"
          onClick={handleSignOut}
          className="auth-status-signout"
        >
          退出
        </button>
      </div>
    );
  }

  return (
    <div className="auth-status-badge">
      <span className="auth-status-anon">未登录</span>
      <a href="/login" className="auth-status-login">登录</a>
    </div>
  );
}
