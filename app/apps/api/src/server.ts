import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import bodyParser from "body-parser";
import { getEnv } from "./env.js";
import { authMiddleware, type AuthedRequest } from "./auth.js";
import { enqueueJob } from "./jobs.js";
import { supabaseAdmin } from "./supabase.js";
import { twilioClient, validateTwilioSignature } from "./twilio.js";
import { stripe } from "./stripe.js";

const env = getEnv();
const app = express();

app.use(helmet());
app.use(cors({ origin: true, credentials: true }));
app.use(morgan("dev"));
app.use(bodyParser.json({ limit: "2mb" }));
app.use(bodyParser.urlencoded({ extended: true }));

app.get("/health", (_req, res) => res.json({ ok: true }));

// Authed V1
app.use("/v1", authMiddleware(env.SUPABASE_JWT_SECRET));

app.post("/v1/territories/generate", async (req: AuthedRequest, res) => {
  const { county, filters, name } = req.body || {};
  if (!county) return res.status(400).json({ error: "county required" });

  const jobId = await enqueueJob(req.user!.orgId, "territory_generate", {
    county,
    filters: filters ?? {},
    name: name ?? null,
    requestedBy: req.user!.userId,
  });

  // Write audit log
  await supabaseAdmin.from("audit_log").insert({
    org_id: req.user!.orgId,
    actor_user_id: req.user!.userId,
    action_type: "territory_generate_requested",
    entity_type: "jobs_queue",
    entity_id: jobId,
    after: { county, filters },
  });

  return res.json({ job_id: jobId });
});

app.get("/v1/jobs/:jobId", async (req: AuthedRequest, res) => {
  const jobId = req.params.jobId;
  const { data, error } = await supabaseAdmin
    .from("jobs_queue")
    .select("*")
    .eq("id", jobId)
    .eq("org_id", req.user!.orgId)
    .maybeSingle();
  if (error || !data) return res.status(404).json({ error: "not found" });
  return res.json(data);
});

app.post("/v1/exports/sales", async (req: AuthedRequest, res) => {
  const { format } = req.body || {};
  const jobId = await enqueueJob(req.user!.orgId, "export_sales", {
    format: format === "json" ? "json" : "csv",
    requestedBy: req.user!.userId,
  });
  return res.json({ job_id: jobId });
});

app.post("/v1/exports/assignments", async (req: AuthedRequest, res) => {
  const jobId = await enqueueJob(req.user!.orgId, "export_assignments", {
    requestedBy: req.user!.userId,
  });
  return res.json({ job_id: jobId });
});

app.post("/v1/messages/send", async (req: AuthedRequest, res) => {
  const { phone_e164, body, property_id } = req.body || {};
  if (!phone_e164 || !body) return res.status(400).json({ error: "phone_e164 and body required" });

  const msg = await twilioClient.messages.create({
    to: phone_e164,
    body,
    messagingServiceSid: env.TWILIO_MESSAGING_SERVICE_SID,
  });

  const { error } = await supabaseAdmin.from("messages").insert({
    org_id: req.user!.orgId,
    property_id: property_id ?? null,
    phone_e164,
    direction: "outbound",
    body,
    twilio_sid: msg.sid,
    sent_by_user_id: req.user!.userId,
    status: msg.status ?? "sent",
  });
  if (error) console.error(error);

  return res.json({ sid: msg.sid, status: msg.status });
});

// Stripe: create intent for labor job completion
app.post("/v1/payments/create_intent", async (req: AuthedRequest, res) => {
  const { job_id, amount, currency } = req.body || {};
  if (!job_id || !amount) return res.status(400).json({ error: "job_id and amount required" });

  // Ensure labor owns job OR admin/manager
  const { data: job } = await supabaseAdmin
    .from("jobs")
    .select("id, org_id, assigned_labor_user_id, status")
    .eq("id", job_id)
    .eq("org_id", req.user!.orgId)
    .maybeSingle();

  if (!job) return res.status(404).json({ error: "job not found" });
  if (req.user!.role === "labor" && job.assigned_labor_user_id !== req.user!.userId) {
    return res.status(403).json({ error: "not your job" });
  }

  const pi = await stripe.paymentIntents.create({
    amount: Math.round(Number(amount) * 100),
    currency: currency || "usd",
    automatic_payment_methods: { enabled: true },
    metadata: { org_id: req.user!.orgId, job_id },
  });

  await supabaseAdmin.from("job_payments").insert({
    org_id: req.user!.orgId,
    job_id,
    stripe_payment_intent_id: pi.id,
    status: pi.status,
    amount: Number(amount),
    currency: currency || "usd",
  });

  return res.json({ client_secret: pi.client_secret, payment_intent_id: pi.id });
});

// Webhooks
app.post("/webhooks/twilio/inbound", bodyParser.urlencoded({ extended: false }), async (req, res) => {
  const signature = req.header("x-twilio-signature") || "";
  const url = (env.RAILWAY_PUBLIC_URL || "") + req.originalUrl;
  const ok = validateTwilioSignature(url, req.body || {}, signature);

  if (!ok) return res.status(403).send("Invalid signature");

  const { From, Body, To } = req.body || {};
  // TODO: map To number / messaging service to org_id; for now expect OrgId param
  const orgId = req.body?.OrgId;
  if (!orgId) return res.status(400).send("Missing OrgId routing");

  await supabaseAdmin.from("messages").insert({
    org_id: orgId,
    phone_e164: From,
    direction: "inbound",
    body: Body ?? "",
    status: "received",
  });

  res.type("text/xml").send("<Response></Response>");
});

app.post("/webhooks/stripe", bodyParser.raw({ type: "application/json" }), async (req, res) => {
  const sig = req.header("stripe-signature") || "";
  let event;
  try {
    event = stripe.webhooks.constructEvent(req.body, sig, env.STRIPE_WEBHOOK_SECRET);
  } catch (err: any) {
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  if (event.type === "payment_intent.succeeded" || event.type === "payment_intent.payment_failed") {
    const pi: any = event.data.object;
    const jobId = pi.metadata?.job_id;
    const orgId = pi.metadata?.org_id;
    if (jobId && orgId) {
      await supabaseAdmin
        .from("job_payments")
        .update({ status: pi.status, updated_at: new Date().toISOString() })
        .eq("org_id", orgId)
        .eq("job_id", jobId)
        .eq("stripe_payment_intent_id", pi.id);

      if (event.type === "payment_intent.succeeded") {
        await supabaseAdmin.from("jobs").update({ status: "paid" }).eq("org_id", orgId).eq("id", jobId);
      }
    }
  }

  res.json({ received: true });
});

const port = Number(env.PORT || 8080);
app.listen(port, () => {
  console.log(`API listening on ${port}`);
});
