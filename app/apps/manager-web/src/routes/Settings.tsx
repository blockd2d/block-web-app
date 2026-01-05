import React from "react";
import { supabase } from "../lib/supabase";

export function Settings() {
  const [org, setOrg] = React.useState<any>(null);
  React.useEffect(()=>{ supabase.from("v_my_membership").select("*").maybeSingle().then(({data})=>setOrg(data)); },[]);
  return (
    <div>
      <h1>Settings</h1>
      <p style={{ opacity:0.7 }}>Integrations are configured via environment variables in Cloudflare/Railway. This page is a view-only placeholder.</p>
      <pre style={{ background:"#111", color:"#ddd", padding:12, borderRadius:8, overflow:"auto" }}>
        {JSON.stringify(org, null, 2)}
      </pre>
    </div>
  );
}
