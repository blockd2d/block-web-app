import React from "react";
import { supabase } from "../lib/supabase";

export function Territories() {
  const [rows, setRows] = React.useState<any[]>([]);
  React.useEffect(()=>{ supabase.from("territory_sets").select("*").order("created_at",{ascending:false}).then(({data})=>setRows(data||[])); },[]);
  return (
    <div>
      <h1>Territory Sets</h1>
      <table cellPadding={8} style={{ width:"100%", borderCollapse:"collapse" }}>
        <thead><tr><th align="left">County</th><th align="left">Name</th><th align="left">Status</th><th align="left">Created</th></tr></thead>
        <tbody>
          {rows.map(r=>(
            <tr key={r.id} style={{ borderTop:"1px solid rgba(0,0,0,0.1)" }}>
              <td>{r.county}</td><td>{r.name}</td><td>{r.status}</td><td>{new Date(r.created_at).toLocaleString()}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
