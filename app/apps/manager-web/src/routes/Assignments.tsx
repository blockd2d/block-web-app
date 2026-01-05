import React from "react";
import { supabase } from "../lib/supabase";
import posthog from "posthog-js";
import { PosthogEvents } from "@block/shared";

export function Assignments() {
  const [clusters, setClusters] = React.useState<any[]>([]);
  const [reps, setReps] = React.useState<any[]>([]);
  const [selectedCluster, setSelectedCluster] = React.useState<string>("");
  const [selectedRep, setSelectedRep] = React.useState<string>("");

  React.useEffect(()=>{
    supabase.from("clusters").select("id, cluster_key, territory_set_id").order("created_at",{ascending:false}).limit(200).then(({data})=>setClusters(data||[]));
    supabase.from("org_memberships").select("user_id, role").eq("role","rep").then(({data})=>setReps(data||[]));
  },[]);

  const assign = async () => {
    if (!selectedCluster || !selectedRep) return;
    const { data: me } = await supabase.auth.getUser();
    await supabase.from("cluster_assignments").insert({
      org_id: (await supabase.from("v_my_membership").select("org_id").maybeSingle()).data?.org_id,
      cluster_id: selectedCluster,
      rep_user_id: selectedRep,
      assigned_by: me.user?.id,
    });
    posthog.capture(PosthogEvents.cluster_assigned, { cluster_id: selectedCluster, rep_user_id: selectedRep });
    alert("Assigned");
  };

  return (
    <div>
      <h1>Assignments</h1>
      <div style={{ display:"grid", gap:12, maxWidth: 520 }}>
        <label>Cluster
          <select value={selectedCluster} onChange={e=>setSelectedCluster(e.target.value)}>
            <option value="">Select cluster</option>
            {clusters.map(c=><option key={c.id} value={c.id}>{c.cluster_key}</option>)}
          </select>
        </label>
        <label>Rep
          <select value={selectedRep} onChange={e=>setSelectedRep(e.target.value)}>
            <option value="">Select rep</option>
            {reps.map(r=><option key={r.user_id} value={r.user_id}>{r.user_id}</option>)}
          </select>
        </label>
        <button onClick={assign}>Assign</button>
      </div>
    </div>
  );
}
