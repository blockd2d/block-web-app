// src/lib/env.ts
import { z } from "zod";
var Bool = z.preprocess((v) => {
  if (typeof v === "string") return v === "true" || v === "1";
  return v;
}, z.boolean());
var EnvSchema = z.object({
  NODE_ENV: z.string().default("development"),
  PORT: z.string().default("4000"),
  SUPABASE_URL: z.union([z.string().url(), z.literal("")]).optional().default(""),
  SUPABASE_ANON_KEY: z.string().optional().default(""),
  SUPABASE_SERVICE_ROLE_KEY: z.string().optional().default(""),
  COOKIE_DOMAIN: z.string().default("localhost"),
  COOKIE_SECURE: Bool.default(false),
  SESSION_COOKIE_NAME: z.string().default("block_session"),
  REFRESH_COOKIE_NAME: z.string().default("block_refresh"),
  CSRF_COOKIE_NAME: z.string().default("block_csrf"),
  WEB_BASE_URL: z.string().default("http://localhost:3000"),
  TURNSTILE_SECRET_KEY: z.string().optional().default(""),
  MOBILE_TURNSTILE_BYPASS: Bool.default(true),
  POSTHOG_API_KEY: z.string().optional().default(""),
  POSTHOG_HOST: z.string().optional().default("https://app.posthog.com"),
  POSTMARK_SERVER_TOKEN: z.string().optional().default(""),
  POSTMARK_FROM_EMAIL: z.string().optional().default("admin@blockd2d.com"),
  APP_BASE_URL: z.string().optional().default("http://localhost:3000"),
  TWILIO_ACCOUNT_SID: z.string().optional().default(""),
  TWILIO_AUTH_TOKEN: z.string().optional().default(""),
  TWILIO_NUMBER: z.string().optional().default(""),
  STRIPE_SECRET_KEY: z.string().optional().default(""),
  STRIPE_WEBHOOK_SECRET: z.string().optional().default(""),
  PUBLIC_WEB_URL: z.string().optional().default("http://localhost:3000")
});
var env = EnvSchema.parse(process.env);

// src/lib/supabase.ts
import { createClient } from "@supabase/supabase-js";
function requireSupabase() {
  if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY || !env.SUPABASE_ANON_KEY) {
    throw new Error("Supabase is not configured. Set SUPABASE_URL, SUPABASE_ANON_KEY, and SUPABASE_SERVICE_ROLE_KEY in apps/api/.env");
  }
}
function createServiceClient() {
  requireSupabase();
  return createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
    global: { headers: { "X-Client-Info": "block-v7-api" } }
  });
}

// src/worker/processors.ts
import { dbscanCluster } from "@blockd2d/shared";
import { stringify } from "csv-stringify/sync";
import PDFDocument from "pdfkit";
import twilio from "twilio";

// src/lib/postmark.ts
async function sendPostmarkEmail(message) {
  const token = env.POSTMARK_SERVER_TOKEN || "";
  if (!token) {
    if (env.NODE_ENV === "production") throw new Error("Missing POSTMARK_SERVER_TOKEN");
    return { ok: true, skipped: true };
  }
  const res = await fetch("https://api.postmarkapp.com/email", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      "X-Postmark-Server-Token": token
    },
    body: JSON.stringify(message)
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Postmark send failed: ${res.status} ${text}`.slice(0, 500));
  }
  return { ok: true };
}

// src/worker/processors.ts
var twilioClient = twilio(env.TWILIO_ACCOUNT_SID, env.TWILIO_AUTH_TOKEN);
var PALETTE = [
  "#E74C3C",
  "#E67E22",
  "#F1C40F",
  "#2ECC71",
  "#1ABC9C",
  "#3498DB",
  "#9B59B6",
  "#34495E",
  "#16A085",
  "#27AE60",
  "#2980B9",
  "#8E44AD",
  "#2C3E50",
  "#C0392B",
  "#D35400"
];
var INTERACTIONS_CHUNK_SIZE = 200;
function pickColor(i) {
  return PALETTE[i % PALETTE.length];
}
function supabaseErrorMessage(err, prefix = "") {
  const msg = err?.message || String(err);
  const parts = [prefix, msg];
  if (err?.details) parts.push(String(err.details));
  if (err?.hint) parts.push(String(err.hint));
  if (err?.code) parts.push(`code: ${err.code}`);
  return parts.filter(Boolean).join("; ");
}
async function updateClusterSet(client, org_id, cluster_set_id, patch) {
  await client.from("cluster_sets").update(patch).eq("org_id", org_id).eq("id", cluster_set_id);
}
async function processJob(client, job) {
  switch (job.type) {
    case "cluster_generate":
      return await processClusterGenerate(client, job);
    case "export_sales":
      return await processExportSales(client, job);
    case "export_assignments":
      return await processExportAssignments(client, job);
    case "contract_generate":
      return await processContractGenerate(client, job);
    case "twilio_send_sms":
      return await processTwilioSendSms(client, job);
    case "join_provision":
      return await processJoinProvision(client, job);
    default:
      return { ok: true, skipped: true, reason: "unknown type" };
  }
}
async function processJoinProvision(client, job) {
  const joinRequestId = job.payload?.join_request_id;
  if (!joinRequestId) throw new Error("missing join_request_id");
  const { data: req, error } = await client.from("join_requests").select(
    "id,status,company_name,owner_full_name,owner_email,decision_reason,approved_company_id,approved_admin_user_id,public_token"
  ).eq("id", joinRequestId).single();
  if (error || !req) throw new Error(error?.message || "join request not found");
  const status = String(req.status || "");
  const ownerEmail = String(req.owner_email || "").trim();
  const ownerName = String(req.owner_full_name || "").trim();
  const companyName = String(req.company_name || "").trim();
  const from = env.POSTMARK_FROM_EMAIL || "admin@blockd2d.com";
  const appBaseUrl = String(env.APP_BASE_URL || env.WEB_BASE_URL || "http://localhost:3000").replace(/\/$/, "");
  if (status === "rejected") {
    const reason = String(req.decision_reason || "").trim();
    if (!reason) throw new Error("decision_reason is required for rejected join requests");
    await sendPostmarkEmail({
      From: from,
      To: ownerEmail,
      Subject: "Your Block access request",
      TextBody: `Thanks for your interest in Block.

We\u2019re not able to approve your request at this time.

Reason: ${reason}
`
    });
    return { ok: true, status: "rejected", emailed: true };
  }
  if (status !== "approved") return { ok: true, skipped: true, reason: `status=${status}` };
  if (req.approved_company_id && req.approved_admin_user_id) {
    return { ok: true, skipped: true, reason: "already provisioned" };
  }
  let orgId = req.approved_company_id;
  if (!orgId) {
    const org = await client.from("organizations").insert({ name: companyName }).select("id").single();
    if (org.error || !org.data) throw new Error(org.error?.message || "unable to create organization");
    orgId = org.data.id;
    await client.from("join_requests").update({ approved_company_id: orgId }).eq("id", joinRequestId);
  }
  let userId = req.approved_admin_user_id;
  if (!userId) {
    const inviteRes = await client.auth?.admin?.inviteUserByEmail?.(ownerEmail, {
      data: { name: ownerName },
      redirectTo: `${appBaseUrl}/invite/accept`
    });
    if (inviteRes?.error) throw new Error(inviteRes.error.message || "unable to invite user");
    userId = inviteRes?.data?.user?.id || inviteRes?.data?.id || null;
    if (!userId) throw new Error("invite did not return user id");
    await client.from("join_requests").update({ approved_admin_user_id: userId }).eq("id", joinRequestId);
    const prof = await client.from("profiles").insert({
      id: userId,
      org_id: orgId,
      role: "admin",
      name: ownerName || "Admin",
      email: ownerEmail
    });
    if (prof.error && !/duplicate key/i.test(prof.error.message || "")) {
      throw new Error(prof.error.message);
    }
  }
  await sendPostmarkEmail({
    From: from,
    To: ownerEmail,
    Subject: "You\u2019re approved for Block",
    TextBody: `Good news \u2014 your request to join Block has been approved.

You should receive an invite email to set your password shortly.

Sign in: ${appBaseUrl}/login
`
  });
  return { ok: true, status: "approved", org_id: orgId, user_id: userId };
}
async function processClusterGenerate(client, job) {
  const { org_id } = job;
  const cluster_set_id = job.payload?.cluster_set_id;
  if (!org_id || !cluster_set_id) throw new Error("missing org_id/cluster_set_id");
  console.log("Cluster generate started", { cluster_set_id, org_id });
  const { data: set } = await client.from("cluster_sets").select("*").eq("org_id", org_id).eq("id", cluster_set_id).single();
  if (!set) throw new Error("cluster_set not found");
  if (!set.county_id) throw new Error("cluster_set has no county_id; zone-derived sets are not generated by worker");
  await updateClusterSet(client, org_id, cluster_set_id, { status: "running", progress: 1 });
  const filters = set.filters_json || {};
  const radius_m = Number(filters.radius_m || 500);
  const min_houses = Number(filters.min_houses || 12);
  const value_min = filters.value_min != null ? Number(filters.value_min) : null;
  const value_max = filters.value_max != null ? Number(filters.value_max) : null;
  const exclude_dnk = !!filters.exclude_dnk;
  const only_unworked = !!filters.only_unworked;
  let q = client.from("properties").select("id,lat,lng,value_estimate").eq("org_id", org_id).eq("county_id", set.county_id).limit(2e5);
  if (value_min != null) q = q.gte("value_estimate", value_min);
  if (value_max != null) q = q.lte("value_estimate", value_max);
  const { data, error } = await q;
  let props = data || null;
  if (error) throw new Error(supabaseErrorMessage(error, "properties select"));
  if ((exclude_dnk || only_unworked) && (props || []).length) {
    const propIds = (props || []).map((p) => p.id);
    const worked = /* @__PURE__ */ new Set();
    const dnk = /* @__PURE__ */ new Set();
    for (let i = 0; i < propIds.length; i += INTERACTIONS_CHUNK_SIZE) {
      const chunk = propIds.slice(i, i + INTERACTIONS_CHUNK_SIZE);
      const { data: inter, error: ie } = await client.from("interactions").select("property_id,outcome").eq("org_id", org_id).in("property_id", chunk);
      if (ie) throw new Error(supabaseErrorMessage(ie, "interactions select"));
      for (const row of inter || []) {
        worked.add(row.property_id);
        const o = String(row.outcome || "").toLowerCase();
        if (o === "do_not_knock" || o === "dnk") dnk.add(row.property_id);
      }
    }
    let filtered = props || [];
    if (exclude_dnk) filtered = filtered.filter((p) => !dnk.has(p.id));
    if (only_unworked) filtered = filtered.filter((p) => !worked.has(p.id));
    props = filtered;
  }
  const points = (props || []).map((p) => ({ id: p.id, lat: p.lat, lng: p.lng, value: p.value_estimate }));
  const valueById = new Map(points.map((p) => [p.id, Number(p.value || 0)]));
  await updateClusterSet(client, org_id, cluster_set_id, { progress: 10 });
  const clusters = dbscanCluster(points, radius_m, min_houses, (p) => {
    const pct = Math.max(10, Math.min(85, Math.floor(10 + p * 75)));
    client.from("cluster_sets").update({ progress: pct }).eq("id", cluster_set_id).eq("org_id", org_id).then(() => {
    }, () => {
    });
    client.from("jobs_queue").update({ progress: pct }).eq("id", job.id).then(() => {
    }, () => {
    });
  });
  const { error: delErr } = await client.from("clusters").delete().eq("org_id", org_id).eq("cluster_set_id", cluster_set_id);
  if (delErr) throw new Error(supabaseErrorMessage(delErr, "clusters delete"));
  const insertedClusterIds = [];
  for (let i = 0; i < clusters.length; i++) {
    const c = clusters[i];
    let total_value = 0;
    for (const pid of c.memberPropertyIds) total_value += valueById.get(pid) || 0;
    const avg_value = c.memberPropertyIds.length ? total_value / c.memberPropertyIds.length : 0;
    const row = {
      org_id,
      cluster_set_id,
      center_lat: c.center.lat,
      center_lng: c.center.lng,
      hull_geojson: { type: "Polygon", coordinates: [[...c.hull.map((p) => [p.lng, p.lat]), [c.hull[0].lng, c.hull[0].lat]]] },
      // keep both legacy keys (total_value/avg_value) and the UI keys (total_potential/avg_value_estimate)
      stats_json: {
        size: c.memberPropertyIds.length,
        total_value,
        avg_value,
        total_potential: total_value,
        avg_value_estimate: avg_value
      },
      color: pickColor(i)
    };
    const { data: inserted, error: iErr } = await client.from("clusters").insert(row).select("id").single();
    if (iErr) throw new Error(supabaseErrorMessage(iErr, `cluster insert at index ${i}: `));
    insertedClusterIds.push(inserted.id);
    const pairs = c.memberPropertyIds.map((pid) => ({ org_id, cluster_id: inserted.id, property_id: pid }));
    for (let j = 0; j < pairs.length; j += 1e3) {
      const { error: cpErr } = await client.from("cluster_properties").insert(pairs.slice(j, j + 1e3));
      if (cpErr) throw new Error(supabaseErrorMessage(cpErr, `cluster_properties insert cluster index ${i} batch ${j}: `));
    }
    if (i % 5 === 0) {
      const pct = Math.floor(85 + i / Math.max(1, clusters.length) * 14);
      await updateClusterSet(client, org_id, cluster_set_id, { progress: pct });
      await client.from("jobs_queue").update({ progress: pct }).eq("id", job.id);
    }
  }
  await updateClusterSet(client, org_id, cluster_set_id, { status: "complete", progress: 100 });
  await client.from("jobs_queue").update({ progress: 100 }).eq("id", job.id);
  return { ok: true, cluster_set_id, clusters: clusters.length, properties: points.length };
}
async function processExportSales(client, job) {
  const { org_id } = job;
  const export_id = job.payload?.export_id;
  const format = job.payload?.format || "csv";
  if (!org_id || !export_id) throw new Error("missing");
  await client.from("exports").update({ status: "running" }).eq("id", export_id).eq("org_id", org_id);
  const { data: rows, error } = await client.from("sales_view").select(
    "id,rep_id,rep_name,address1,city,state,zip,price,service_type,sale_status,pipeline_status,customer_name,customer_phone,customer_email,created_at,updated_at"
  ).eq("org_id", org_id).limit(2e5);
  if (error) throw new Error(error.message);
  let body;
  let contentType = "text/csv";
  let ext = "csv";
  if (format === "json") {
    body = Buffer.from(JSON.stringify(rows || [], null, 2), "utf8");
    contentType = "application/json";
    ext = "json";
  } else {
    body = Buffer.from(stringify(rows || [], { header: true }), "utf8");
  }
  const path = `${org_id}/exports/sales_${(/* @__PURE__ */ new Date()).toISOString().slice(0, 10)}_${export_id}.${ext}`;
  const up = await client.storage.from("exports").upload(path, body, { upsert: true, contentType });
  if (up.error) throw new Error(up.error.message);
  await client.from("exports").update({ status: "complete", storage_path: path }).eq("id", export_id).eq("org_id", org_id);
  return { ok: true, export_id, path };
}
async function processExportAssignments(client, job) {
  const { org_id } = job;
  const export_id = job.payload?.export_id;
  const format = job.payload?.format || "csv";
  const cluster_set_id = job.payload?.cluster_set_id;
  if (!org_id || !export_id) throw new Error("missing");
  await client.from("exports").update({ status: "running" }).eq("id", export_id).eq("org_id", org_id);
  let q = client.from("clusters").select("id,cluster_set_id,assigned_rep_id,center_lat,center_lng,stats_json,created_at").eq("org_id", org_id);
  if (cluster_set_id) q = q.eq("cluster_set_id", cluster_set_id);
  const { data: rows, error } = await q.limit(2e5);
  if (error) throw new Error(error.message);
  let body;
  let contentType = "text/csv";
  let ext = "csv";
  if (format === "json") {
    body = Buffer.from(JSON.stringify(rows || [], null, 2), "utf8");
    contentType = "application/json";
    ext = "json";
  } else {
    body = Buffer.from(stringify(rows || [], { header: true }), "utf8");
  }
  const path = `${org_id}/exports/assignments_${(/* @__PURE__ */ new Date()).toISOString().slice(0, 10)}_${export_id}.${ext}`;
  const up = await client.storage.from("exports").upload(path, body, { upsert: true, contentType });
  if (up.error) throw new Error(up.error.message);
  await client.from("exports").update({ status: "complete", storage_path: path }).eq("id", export_id).eq("org_id", org_id);
  return { ok: true, export_id, path };
}
async function processContractGenerate(client, job) {
  const { org_id } = job;
  const sale_id = job.payload?.sale_id;
  if (!org_id || !sale_id) throw new Error("missing");
  const { data: sale } = await client.from("sales").select("*").eq("org_id", org_id).eq("id", sale_id).single();
  if (!sale) throw new Error("sale not found");
  const { data: prop } = await client.from("properties").select("*").eq("org_id", org_id).eq("id", sale.property_id).single();
  const { data: sigRow } = await client.from("sale_attachments").select("storage_path, created_at").eq("org_id", org_id).eq("sale_id", sale_id).eq("type", "signature").order("created_at", { ascending: false }).limit(1).maybeSingle();
  let signatureBuf = null;
  let signaturePath = sigRow?.storage_path || null;
  if (signaturePath) {
    const dl = await client.storage.from("attachments").download(signaturePath);
    if (!dl.error && dl.data) {
      const ab = await dl.data.arrayBuffer();
      signatureBuf = Buffer.from(ab);
    }
  }
  const doc = new PDFDocument({ size: "LETTER", margin: 48 });
  const chunks = [];
  doc.on("data", (d) => chunks.push(d));
  const done = new Promise((resolve) => doc.on("end", () => resolve(Buffer.concat(chunks))));
  doc.fontSize(20).text("Block Service Agreement", { align: "center" });
  doc.moveDown();
  doc.fontSize(12).text(`Sale ID: ${sale.id}`);
  doc.text(`Customer Phone: ${sale.customer_phone || "N/A"}`);
  doc.text(`Customer Email: ${sale.customer_email || "N/A"}`);
  doc.text(`Service: ${sale.service_type || "N/A"}`);
  doc.text(`Price: ${sale.price != null ? "$" + sale.price : "N/A"}`);
  if (sale.notes) {
    doc.moveDown(0.5);
    doc.text(`Notes: ${sale.notes}`);
  }
  doc.moveDown();
  doc.text("Property:");
  doc.text(`${prop?.address1 || ""}`);
  doc.text(`${prop?.city || ""} ${prop?.state || ""} ${prop?.zip || ""}`);
  doc.moveDown();
  doc.text("Terms:");
  doc.text("1) Customer agrees to pay for services rendered.");
  doc.text("2) Photos may be taken before and after.");
  doc.text("3) Satisfaction and rework policy as agreed by provider.");
  doc.moveDown();
  doc.text("Signature:");
  if (signatureBuf) {
    const y = doc.y + 8;
    doc.rect(72, y, 260, 80).stroke();
    try {
      doc.image(signatureBuf, 80, y + 8, { fit: [244, 64] });
    } catch {
      doc.fontSize(10).text("(signature image could not be rendered)", 80, y + 30);
    }
    doc.moveDown(6);
    doc.fontSize(12);
    doc.text(`Signed at: ${sigRow?.created_at ? new Date(sigRow.created_at).toLocaleString() : (/* @__PURE__ */ new Date()).toLocaleString()}`);
  } else {
    doc.text("____________________________");
    doc.text("Date: ______________________");
  }
  doc.end();
  const pdf = await done;
  const path = `${org_id}/contracts/contract_${sale_id}.pdf`;
  const up = await client.storage.from("contracts").upload(path, pdf, { contentType: "application/pdf", upsert: true });
  if (up.error) throw new Error(up.error.message);
  await client.from("contracts").upsert(
    {
      org_id,
      sale_id,
      pdf_path: path,
      signature_image_path: signaturePath,
      signed_at: sigRow?.created_at || null,
      terms_version: "v1"
    },
    { onConflict: "sale_id" }
  );
  return { ok: true, sale_id, path };
}
async function processTwilioSendSms(client, job) {
  const { org_id } = job;
  const message_id = job.payload?.message_id;
  if (!org_id || !message_id) throw new Error("missing org_id/message_id");
  const { data: msg, error: mErr } = await client.from("messages").select("id,thread_id,body,to_phone,from_phone,status").eq("org_id", org_id).eq("id", message_id).single();
  if (mErr || !msg) throw new Error(mErr?.message || "message not found");
  let to = String(msg.to_phone || "").trim();
  if (!to) {
    const { data: thread } = await client.from("message_threads").select("customer_phone").eq("org_id", org_id).eq("id", msg.thread_id).maybeSingle();
    to = String(thread?.customer_phone || "").trim();
  }
  const { data: settings } = await client.from("org_settings").select("twilio_number").eq("org_id", org_id).maybeSingle();
  const from = String(msg.from_phone || settings?.twilio_number || env.TWILIO_NUMBER || "").trim();
  if (!to || !from) {
    await client.from("messages").update({ status: "failed" }).eq("org_id", org_id).eq("id", message_id);
    return { ok: false, error: "missing to/from number" };
  }
  if (!env.TWILIO_ACCOUNT_SID || !env.TWILIO_AUTH_TOKEN) {
    await client.from("messages").update({ status: "skipped", from_phone: from, to_phone: to }).eq("org_id", org_id).eq("id", message_id);
    return { ok: true, skipped: true, reason: "twilio not configured" };
  }
  const clientTwilio = twilio(env.TWILIO_ACCOUNT_SID, env.TWILIO_AUTH_TOKEN);
  const res = await clientTwilio.messages.create({ to, from, body: String(msg.body || "") });
  await client.from("messages").update({
    status: "sent",
    twilio_sid: res.sid,
    sent_at: (/* @__PURE__ */ new Date()).toISOString(),
    from_phone: from,
    to_phone: to
  }).eq("org_id", org_id).eq("id", message_id);
  return { ok: true, sid: res.sid };
}

// src/worker.ts
async function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}
async function main() {
  const service = createServiceClient();
  console.log("Worker started", { env: env.NODE_ENV });
  while (true) {
    try {
      const { data: job } = await service.from("jobs_queue").select("*").eq("status", "queued").order("created_at", { ascending: true }).limit(1).single();
      if (!job) {
        await sleep(2e3);
        continue;
      }
      await service.from("jobs_queue").update({ status: "running", started_at: (/* @__PURE__ */ new Date()).toISOString(), progress: 1 }).eq("id", job.id);
      try {
        const result = await processJob(service, job);
        console.log("Job complete", { job_id: job.id, type: job.type, result });
        await service.from("jobs_queue").update({ status: "complete", progress: 100, finished_at: (/* @__PURE__ */ new Date()).toISOString(), result }).eq("id", job.id);
      } catch (err) {
        console.error("Job failed", job.id, job.type, err?.message, err?.stack, {
          details: err?.details,
          hint: err?.hint,
          code: err?.code
        });
        const errMsg = err?.message || String(err);
        await service.from("jobs_queue").update({ status: "failed", finished_at: (/* @__PURE__ */ new Date()).toISOString(), error: errMsg }).eq("id", job.id);
        if (job.type === "cluster_generate" && job.org_id && job.payload?.cluster_set_id) {
          await service.from("cluster_sets").update({ status: "failed", error: errMsg }).eq("org_id", job.org_id).eq("id", job.payload.cluster_set_id);
        }
      }
    } catch (err) {
      console.error("Worker loop error", err);
      await sleep(2e3);
    }
  }
}
main();
//# sourceMappingURL=worker.js.map