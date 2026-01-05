import React from "react";
import { Routes, Route, Navigate, Link } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { Login } from "./Login";
import { Dashboard } from "./Dashboard";
import { Territories } from "./Territories";
import { Generate } from "./Generate";
import { Assignments } from "./Assignments";
import { Sales } from "./Sales";
import { Audit } from "./Audit";
import { Settings } from "./Settings";

function useSession() {
  const [session, setSession] = React.useState<any>(null);
  React.useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, []);
  return session;
}

function AuthedLayout() {
  return (
    <div style={{ display:"grid", gridTemplateColumns:"240px 1fr", minHeight:"100vh", fontFamily:"ui-sans-serif, system-ui" }}>
      <aside style={{ padding:16, borderRight:"1px solid rgba(255,255,255,0.08)" }}>
        <h2 style={{ margin:0 }}>Block V7</h2>
        <nav style={{ display:"grid", gap:8, marginTop:16 }}>
          <Link to="/app/dashboard">Dashboard</Link>
          <Link to="/app/territories">Territories</Link>
          <Link to="/app/generate">Generate</Link>
          <Link to="/app/assignments">Assignments</Link>
          <Link to="/app/sales">Sales</Link>
          <Link to="/app/audit">Audit</Link>
          <Link to="/app/settings">Settings</Link>
        </nav>
        <button style={{ marginTop:16 }} onClick={() => supabase.auth.signOut()}>Sign out</button>
      </aside>
      <main style={{ padding:16 }}>
        <Routes>
          <Route path="dashboard" element={<Dashboard/>} />
          <Route path="territories" element={<Territories/>} />
          <Route path="generate" element={<Generate/>} />
          <Route path="assignments" element={<Assignments/>} />
          <Route path="sales" element={<Sales/>} />
          <Route path="audit" element={<Audit/>} />
          <Route path="settings" element={<Settings/>} />
          <Route path="*" element={<Navigate to="dashboard" replace />} />
        </Routes>
      </main>
    </div>
  );
}

export function App() {
  const session = useSession();
  if (!session) return <Routes><Route path="*" element={<Login />} /></Routes>;
  return (
    <Routes>
      <Route path="/login" element={<Navigate to="/app/dashboard" replace />} />
      <Route path="/app/*" element={<AuthedLayout />} />
      <Route path="*" element={<Navigate to="/app/dashboard" replace />} />
    </Routes>
  );
}
