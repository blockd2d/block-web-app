import React from "react";
import { supabase } from "../lib/supabase";
import posthog from "posthog-js";
import { PosthogEvents } from "@block/shared";

export function Audit() {
  const [rows, setRows] = React.useState<any[]>([]);
  React.useEffect(()=>{
    posthog.capture(PosthogEvents.audit_log_viewed);
    supabase.from("audit_log").select("*").order("created_at",{ascending:false}).limit(200).then(({data})=>setRows(data||[]));
  },[]);
  return (
    <div>
      <h1>Audit Log</h1>
      <pre style={{ background:"#111", color:"#ddd", padding:12, borderRadius:8, overflow:"auto", maxHeight: 520 }}>
        {JSON.stringify(rows, null, 2)}
      </pre>
    </div>
  );
}
