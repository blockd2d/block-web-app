import React from "react";
import { getConfig } from "../config";
import { supabase } from "../lib/supabase";
import posthog from "posthog-js";
import { PosthogEvents } from "@block/shared";

async function authedFetch(path: string, body: any) {
  const cfg = getConfig();
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  const res = await fetch(cfg.RAILWAY_API_BASE_URL + path, {
    method: "POST",
    headers: { "content-type":"application/json", authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  });
  return res.json();
}

async function getJob(jobId: string) {
  const cfg = getConfig();
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  const res = await fetch(cfg.RAILWAY_API_BASE_URL + `/v1/jobs/${jobId}`, { headers: { authorization: `Bearer ${token}` } });
  return res.json();
}

export function Generate() {
  const [county, setCounty] = React.useState("Hendricks");
  const [radius, setRadius] = React.useState(250);
  const [minHouses, setMinHouses] = React.useState(20);
  const [job, setJob] = React.useState<any>(null);

  const onRun = async () => {
    posthog.capture(PosthogEvents.territory_generate_clicked, { county });
    const out = await authedFetch("/v1/territories/generate", {
      county,
      filters: { radius_meters: radius, min_houses: minHouses },
    });
    setJob({ id: out.job_id, ...out });
    posthog.capture(PosthogEvents.territory_generate_job_started, { county, job_id: out.job_id });
  };

  React.useEffect(()=>{
    if (!job?.id) return;
    let alive = true
    return;
  },[job?.id]);

  const poll = async () => {
    if (!job?.id) return;
    const j = await getJob(job.id);
    setJob(j);
    if (j.status === "done") posthog.capture(PosthogEvents.territory_generate_job_completed, { job_id: job.id });
  };

  return (
    <div>
      <h1>Generate Territory Set</h1>
      <div style={{ display:"grid", gap:12, maxWidth: 520 }}>
        <label>County <input value={county} onChange={e=>setCounty(e.target.value)} /></label>
        <label>Radius (m) <input type="number" value={radius} onChange={e=>setRadius(Number(e.target.value))} /></label>
        <label>Min houses <input type="number" value={minHouses} onChange={e=>setMinHouses(Number(e.target.value))} /></label>
        <button onClick={onRun}>Run clustering job</button>
        {job && (
          <div style={{ padding:12, border:"1px solid rgba(0,0,0,0.15)", borderRadius:8 }}>
            <div><b>Job</b> {job.id}</div>
            <div>Status: {job.status} • {job.progress}%</div>
            <div style={{ opacity:0.7 }}>{job.message}</div>
            <button onClick={poll} style={{ marginTop:8 }}>Refresh</button>
            <pre style={{ marginTop:8, overflow:"auto", maxHeight: 220 }}>{JSON.stringify(job.result, null, 2)}</pre>
          </div>
        )}
      </div>
    </div>
  );
}
