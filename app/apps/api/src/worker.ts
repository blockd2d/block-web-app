import { getEnv } from "./env.js";
import { supabaseAdmin } from "./supabase.js";
import { gridDbscan, hullToGeoJSONPolygon, convexHullLngLat } from "./geo.js";

const env = getEnv();

async function sleep(ms:number){ return new Promise(r=>setTimeout(r,ms)); }

async function pickJob() {
  const { data, error } = await supabaseAdmin
    .from("jobs_queue")
    .select("*")
    .eq("status", "queued")
    .order("created_at", { ascending: true })
    .limit(1);

  if (error) throw error;
  return data?.[0] ?? null;
}

async function updateJob(id: string, patch: any) {
  await supabaseAdmin.from("jobs_queue").update({ ...patch, updated_at: new Date().toISOString() }).eq("id", id);
}

async function doTerritoryGenerate(job: any) {
  const { county, filters, name, requestedBy } = job.params || {};
  const orgId = job.org_id;

  // create territory_set
  const { data: ts, error: tsErr } = await supabaseAdmin
    .from("territory_sets")
    .insert({
      org_id: orgId,
      county,
      name: name || `Territory Set ${new Date().toISOString()}`,
      filters: filters || {},
      status: "running",
      created_by: requestedBy || null,
    })
    .select("*")
    .single();
  if (tsErr) throw tsErr;

  await updateJob(job.id, { status: "running", progress: 5, message: "Loading properties" });

  // Load properties (paged)
  let page = 0;
  const pageSize = 20000;
  let points: any[] = [];
  while (true) {
    const { data, error } = await supabaseAdmin
      .from("properties")
      .select("property_id, lat, lng, value_score, price_estimate")
      .eq("org_id", orgId)
      .eq("county", county)
      .range(page * pageSize, (page + 1) * pageSize - 1);

    if (error) throw error;
    if (!data || data.length === 0) break;
    // basic filters
    for (const r of data) {
      const min = filters?.value_min ?? null;
      const max = filters?.value_max ?? null;
      const v = r.value_score ?? r.price_estimate ?? null;
      if (min != null && v != null && v < min) continue;
      if (max != null && v != null && v > max) continue;
      points.push({ id: r.property_id, lat: r.lat, lng: r.lng });
    }
    page++;
    if (data.length < pageSize) break;
    await updateJob(job.id, { progress: Math.min(30, 5 + page * 3), message: `Loaded ${points.length} properties` });
  }

  const radius = Number(filters?.radius_meters ?? 250);
  const minHouses = Number(filters?.min_houses ?? 20);

  await updateJob(job.id, { progress: 35, message: `Clustering ${points.length} points` });
  const clusters = gridDbscan(points, radius, minHouses);

  await updateJob(job.id, { progress: 60, message: `Writing ${clusters.length} clusters` });

  // write clusters + cluster_properties
  for (let i=0; i<clusters.length; i++){
    const c = clusters[i];
    const hull = convexHullLngLat(c.points.map(p=>({lng:p.lng, lat:p.lat})));
    const poly = hullToGeoJSONPolygon(hull);

    const stats = { count: c.points.length };
    const { data: cl, error: clErr } = await supabaseAdmin
      .from("clusters")
      .insert({
        org_id: orgId,
        territory_set_id: ts.id,
        cluster_key: c.key,
        center_lat: c.center.lat,
        center_lng: c.center.lng,
        polygon_geojson: poly,
        stats,
      })
      .select("id")
      .single();
    if (clErr) throw clErr;

    const rows = c.points.map(p=>({ org_id: orgId, cluster_id: cl.id, property_id: p.id }));
    // chunk insert
    const chunkSize = 5000
    for (let k=0; k<rows.length; k+=chunkSize){
      const { error } = await supabaseAdmin.from("cluster_properties").insert(rows.slice(k,k+chunkSize));
      if (error) throw error;
    }
    await updateJob(job.id, { progress: Math.min(95, 60 + Math.floor((i+1)/clusters.length*35)), message: `Stored cluster ${i+1}/${clusters.length}` });
  }

  await supabaseAdmin.from("territory_sets").update({ status: "ready" }).eq("id", ts.id);

  await updateJob(job.id, { status: "done", progress: 100, message: "Territory set ready", result: { territory_set_id: ts.id, clusters: clusters.length } });
}

async function doExportSales(job:any) {
  const orgId = job.org_id;
  const format = job.params?.format === "json" ? "json" : "csv";
  await updateJob(job.id, { status: "running", progress: 10, message: "Exporting sales" });

  const { data, error } = await supabaseAdmin.from("sales").select("*").eq("org_id", orgId);
  if (error) throw error;

  let content = "";
  let ext = "";
  if (format === "json") {
    content = JSON.stringify(data ?? [], null, 2);
    ext = "json";
  } else {
    const rows = data ?? [];
    const headers = ["id","property_id","rep_user_id","price","service_type","status","created_at"];
    const escape = (v:any)=> `"${String(v ?? "").replace(/"/g,'""')}"`;
    content = [headers.join(","), ...rows.map(r=> headers.map(h=>escape(r[h])).join(","))].join("\n");
    ext = "csv";
  }

  // Write exports record
  const { data: ex, error: exErr } = await supabaseAdmin.from("exports").insert({
    org_id: orgId,
    type: "sales",
    params: { format },
    status: "running",
  }).select("*").single();
  if (exErr) throw exErr;

  const path = `${orgId}/sales_${ex.id}.${ext}`;

  // Upload via Supabase Storage
  const { error: upErr } = await supabaseAdmin.storage.from("exports").upload(path, content, {
    contentType: format === "json" ? "application/json" : "text/csv",
    upsert: true,
  });
  if (upErr) throw upErr;

  await supabaseAdmin.from("exports").update({ status: "ready", file_path: path }).eq("id", ex.id);

  await updateJob(job.id, { status: "done", progress: 100, message: "Export ready", result: { export_id: ex.id, file_path: path } });
}

async function doExportAssignments(job:any) {
  const orgId = job.org_id;
  await updateJob(job.id, { status: "running", progress: 10, message: "Exporting assignments" });

  const { data, error } = await supabaseAdmin
    .from("cluster_assignments")
    .select("id, cluster_id, rep_user_id, assigned_at, status")
    .eq("org_id", orgId);
  if (error) throw error;

  const rows = data ?? [];
  const headers = ["id","cluster_id","rep_user_id","assigned_at","status"];
  const escape = (v:any)=> `"${String(v ?? "").replace(/"/g,'""')}"`;
  const content = [headers.join(","), ...rows.map(r=> headers.map(h=>escape(r[h])).join(","))].join("\n");

  const { data: ex, error: exErr } = await supabaseAdmin.from("exports").insert({
    org_id: orgId,
    type: "assignments",
    params: {},
    status: "running",
  }).select("*").single();
  if (exErr) throw exErr;

  const path = `${orgId}/assignments_${ex.id}.csv`;
  const { error: upErr } = await supabaseAdmin.storage.from("exports").upload(path, content, {
    contentType: "text/csv",
    upsert: true,
  });
  if (upErr) throw upErr;

  await supabaseAdmin.from("exports").update({ status: "ready", file_path: path }).eq("id", ex.id);

  await updateJob(job.id, { status: "done", progress: 100, message: "Export ready", result: { export_id: ex.id, file_path: path } });
}

async function runOnce() {
  const job = await pickJob();
  if (!job) return false;
  await updateJob(job.id, { status: "running", progress: 1, message: "Starting" });

  try {
    if (job.kind === "territory_generate") await doTerritoryGenerate(job);
    else if (job.kind === "export_sales") await doExportSales(job);
    else if (job.kind === "export_assignments") await doExportAssignments(job);
    else await updateJob(job.id, { status: "failed", progress: 100, message: `Unknown job kind: ${job.kind}` });
  } catch (e:any) {
    await updateJob(job.id, { status: "failed", progress: 100, message: e?.message ?? "Worker error" });
  }
  return true;
}

async function main() {
  console.log("Worker started");
  while (true) {
    const did = await runOnce();
    if (!did) await sleep(1500);
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
