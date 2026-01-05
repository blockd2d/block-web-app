import React from "react";
import { supabase } from "../lib/supabase";
import posthog from "posthog-js";
import { PosthogEvents } from "@block/shared";

export function Login() {
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [err, setErr] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErr(null);
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) return setErr(error.message);
    if (data.session) posthog.capture(PosthogEvents.org_login_success);
  };

  return (
    <div style={{ maxWidth: 420, margin: "64px auto", padding: 16 }}>
      <h1>Login</h1>
      <p style={{ opacity: 0.7 }}>Invite-only. Use your org credentials.</p>
      <form onSubmit={onSubmit} style={{ display:"grid", gap:12 }}>
        <input placeholder="Email" value={email} onChange={e=>setEmail(e.target.value)} />
        <input placeholder="Password" type="password" value={password} onChange={e=>setPassword(e.target.value)} />
        <button disabled={loading}>{loading ? "Signing in..." : "Sign in"}</button>
        {err && <div style={{ color:"crimson" }}>{err}</div>}
      </form>
    </div>
  );
}
