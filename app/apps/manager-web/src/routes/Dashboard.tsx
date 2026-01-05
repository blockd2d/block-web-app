import React from "react";
import { supabase } from "../lib/supabase";

export function Dashboard() {
  const [m, setM] = React.useState<any>(null);
  React.useEffect(()=>{ supabase.from("v_my_membership").select("*").maybeSingle().then(({data})=>setM(data)); },[]);
  return (
    <div>
      <h1>Dashboard</h1>
      <pre style={{ background:"#111", color:"#ddd", padding:12, borderRadius:8, overflow:"auto" }}>
        {JSON.stringify(m, null, 2)}
      </pre>
    </div>
  );
}
