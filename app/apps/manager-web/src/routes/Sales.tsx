import React from "react";
import { supabase } from "../lib/supabase";
import { getConfig } from "../config";
import posthog from "posthog-js";
import { PosthogEvents } from "@block/shared";

async function authedPost(path:string, body:any){
  const cfg = getConfig();
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  const res = await fetch(cfg.RAILWAY_API_BASE_URL + path, {
    method:"POST",
    headers:{ "content-type":"application/json", authorization:`Bearer ${token}` },
    body: JSON.stringify(body),
  });
  return res.json();
}

export function Sales() {
  const [rows, setRows] = React.useState<any[]>([]);
  React.useEffect(()=>{ supabase.from("sales").select("*").order("created_at",{ascending:false}).limit(200).then(({data})=>setRows(data||[])); },[]);

  const exportSales = async (format:"csv"|"json")=>{
    posthog.capture(PosthogEvents.export_requested, { type:"sales", format });
    const out = await authedPost("/v1/exports/sales", { format });
    alert(`Export job queued: ${out.job_id}`);
  };

  return (
    <div>
      <h1>Sales</h1>
      <div style={{ display:"flex", gap:8, marginBottom:12 }}>
        <button onClick={()=>exportSales("csv")}>Export CSV</button>
        <button onClick={()=>exportSales("json")}>Export JSON</button>
      </div>
      <table cellPadding={8} style={{ width:"100%", borderCollapse:"collapse" }}>
        <thead><tr><th align="left">Property</th><th align="left">Rep</th><th align="left">Price</th><th align="left">Status</th><th align="left">Created</th></tr></thead>
        <tbody>
          {rows.map(r=>(
            <tr key={r.id} style={{ borderTop:"1px solid rgba(0,0,0,0.1)" }}>
              <td>{r.property_id}</td><td>{r.rep_user_id}</td><td>{r.price}</td><td>{r.status}</td><td>{new Date(r.created_at).toLocaleString()}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
