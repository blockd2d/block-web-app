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

// src/server.ts
import Fastify from "fastify";
import cookie from "@fastify/cookie";
import formbody from "@fastify/formbody";
import cors from "@fastify/cors";
import rateLimit from "@fastify/rate-limit";

// src/lib/auth.ts
import crypto from "crypto";

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
function createAnonClient() {
  requireSupabase();
  return createClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
    global: { headers: { "X-Client-Info": "block-v7-api-anon" } }
  });
}

// src/lib/auth.ts
var DEV_ACCOUNT = {
  email: "stephenonochie@gmail.com",
  password: "BlockDev2025!",
  userId: "00000000-0000-4000-8000-000000000001",
  orgId: "00000000-0000-4000-8000-000000000002",
  sessionPrefix: "dev_session_"
};
function isDevSession(token) {
  return typeof token === "string" && token.startsWith(DEV_ACCOUNT.sessionPrefix);
}
function getAccessTokenFromRequest(req) {
  const auth = req.headers["authorization"];
  if (typeof auth === "string" && auth.startsWith("Bearer ")) return auth.slice("Bearer ".length);
  const c = req.cookies?.[env.SESSION_COOKIE_NAME];
  return typeof c === "string" && c.length > 0 ? c : null;
}
function isBearerRequest(req) {
  const auth = req.headers["authorization"];
  return typeof auth === "string" && auth.startsWith("Bearer ");
}
async function buildAuthContext(req) {
  const accessToken = getAccessTokenFromRequest(req);
  if (!accessToken) return null;
  if (isDevSession(accessToken)) {
    return {
      user_id: DEV_ACCOUNT.userId,
      profile_id: DEV_ACCOUNT.userId,
      org_id: DEV_ACCOUNT.orgId,
      role: "admin",
      email: DEV_ACCOUNT.email
    };
  }
  const supabaseAnon = createAnonClient();
  const { data, error } = await supabaseAnon.auth.getUser(accessToken);
  if (error || !data.user) return null;
  const service = createServiceClient();
  const { data: profile, error: pErr } = await service.from("profiles").select("id, org_id, role, email").eq("id", data.user.id).single();
  if (pErr || !profile) return null;
  return {
    user_id: data.user.id,
    profile_id: profile.id,
    org_id: profile.org_id,
    role: profile.role,
    email: profile.email
  };
}
function requireRole(ctx, allowed) {
  if (!allowed.includes(ctx.role)) {
    const err = new Error("Forbidden");
    err.statusCode = 403;
    throw err;
  }
}
function setAuthCookies(reply, session) {
  const opts = {
    httpOnly: true,
    secure: env.COOKIE_SECURE,
    sameSite: "lax",
    path: "/",
    domain: env.COOKIE_DOMAIN === "localhost" ? void 0 : env.COOKIE_DOMAIN
  };
  reply.setCookie(env.SESSION_COOKIE_NAME, session.access_token, { ...opts, maxAge: 60 * 60 });
  reply.setCookie(env.REFRESH_COOKIE_NAME, session.refresh_token, { ...opts, maxAge: 60 * 60 * 24 * 30 });
  const csrf = crypto.randomUUID();
  reply.setCookie(env.CSRF_COOKIE_NAME, csrf, {
    httpOnly: false,
    secure: env.COOKIE_SECURE,
    sameSite: "lax",
    path: "/",
    domain: env.COOKIE_DOMAIN === "localhost" ? void 0 : env.COOKIE_DOMAIN,
    maxAge: 60 * 60 * 24 * 7
  });
  return csrf;
}
function clearAuthCookies(reply) {
  const opts = {
    httpOnly: true,
    secure: env.COOKIE_SECURE,
    sameSite: "lax",
    path: "/",
    domain: env.COOKIE_DOMAIN === "localhost" ? void 0 : env.COOKIE_DOMAIN
  };
  reply.clearCookie(env.SESSION_COOKIE_NAME, opts);
  reply.clearCookie(env.REFRESH_COOKIE_NAME, opts);
  reply.clearCookie(env.CSRF_COOKIE_NAME, { ...opts, httpOnly: false });
}
function requireCsrf(req) {
  if (isBearerRequest(req)) return;
  const header = req.headers["x-csrf"];
  const cookie2 = req.cookies?.[env.CSRF_COOKIE_NAME];
  if (!cookie2 || !header || cookie2 !== header) {
    const err = new Error("CSRF token missing or invalid");
    err.statusCode = 403;
    throw err;
  }
}
async function refreshSession(refreshToken) {
  const supabaseAnon = createAnonClient();
  const { data, error } = await supabaseAnon.auth.refreshSession({ refresh_token: refreshToken });
  if (error || !data.session) {
    const err = new Error("Refresh failed");
    err.statusCode = 401;
    throw err;
  }
  return data.session;
}

// src/routes/auth.ts
import { LoginSchema } from "@blockd2d/shared";

// src/lib/turnstile.ts
async function verifyTurnstile(opts) {
  if (opts.bypass) return { ok: true, skipped: true, bypass: true };
  if (!env.TURNSTILE_SECRET_KEY) return { ok: true, skipped: true };
  if (!opts.token) return { ok: true, skipped: true };
  const form = new URLSearchParams();
  form.set("secret", env.TURNSTILE_SECRET_KEY);
  form.set("response", opts.token);
  if (opts.ip) form.set("remoteip", opts.ip);
  const res = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
    method: "POST",
    body: form
  });
  const json = await res.json();
  if (json.success) return { ok: true };
  return { ok: false, error: "Turnstile verification failed", details: json };
}

// src/lib/posthog.ts
import { PostHog } from "posthog-node";
var client = null;
function posthog() {
  if (!env.POSTHOG_API_KEY) return null;
  if (!client) client = new PostHog(env.POSTHOG_API_KEY, { host: env.POSTHOG_HOST });
  return client;
}
async function capture(event, distinctId, properties) {
  const ph = posthog();
  if (!ph) return;
  ph.capture({ distinctId, event, properties });
}
async function shutdownPosthog() {
  if (client) await client.shutdown();
}

// src/routes/auth.ts
import { PosthogEvents } from "@blockd2d/shared";
async function authRoutes(app2) {
  app2.post("/login", async (req, reply) => {
    const body = LoginSchema.parse(req.body ?? {});
    const isMobile = (req.headers["x-block-client"] || "") === "mobile";
    const bypass = isMobile && env.MOBILE_TURNSTILE_BYPASS;
    const ts = await verifyTurnstile({ token: body.turnstileToken, ip: req.ip, bypass });
    if (!ts.ok) return reply.code(400).send({ error: ts.error, details: ts.details });
    if (body.email === DEV_ACCOUNT.email && body.password === DEV_ACCOUNT.password && !isMobile) {
      const devToken = `${DEV_ACCOUNT.sessionPrefix}${DEV_ACCOUNT.userId}`;
      setAuthCookies(reply, { access_token: devToken, refresh_token: devToken });
      const devUser = {
        id: DEV_ACCOUNT.userId,
        org_id: DEV_ACCOUNT.orgId,
        role: "admin",
        name: "Dev User",
        email: DEV_ACCOUNT.email
      };
      return reply.send({ user: devUser, session: void 0 });
    }
    const anon = createAnonClient();
    const { data, error } = await anon.auth.signInWithPassword({ email: body.email, password: body.password });
    if (error || !data.session) return reply.code(401).send({ error: "Invalid credentials" });
    const service = createServiceClient();
    const { data: profile } = await service.from("profiles").select("id, org_id, role, name, email").eq("id", data.user.id).single();
    if (!profile) return reply.code(403).send({ error: "No org profile" });
    if (!isMobile && (profile.role === "rep" || profile.role === "labor")) {
      return reply.code(403).send({ error: "Mobile-only account" });
    }
    if (!isMobile) {
      setAuthCookies(reply, { access_token: data.session.access_token, refresh_token: data.session.refresh_token });
    }
    await capture(PosthogEvents.ORG_LOGIN, profile.id, {
      org_id: profile.org_id,
      user_id: profile.id,
      role: profile.role
    });
    return reply.send({
      user: profile,
      session: isMobile ? { access_token: data.session.access_token, refresh_token: data.session.refresh_token, expires_in: data.session.expires_in } : void 0
    });
  });
  app2.post("/logout", async (req, reply) => {
    clearAuthCookies(reply);
    return reply.send({ ok: true });
  });
  app2.post("/refresh", async (req, reply) => {
    const isMobile = (req.headers["x-block-client"] || "") === "mobile";
    const cookieRefresh = req.cookies?.[env.REFRESH_COOKIE_NAME];
    const body = req.body || {};
    const refresh = body.refresh_token || cookieRefresh;
    if (!refresh) return reply.code(401).send({ error: "Missing refresh token" });
    const session = await refreshSession(refresh);
    if (!isMobile) {
      setAuthCookies(reply, { access_token: session.access_token, refresh_token: session.refresh_token });
      return reply.send({ ok: true });
    }
    return reply.send({ session: { access_token: session.access_token, refresh_token: session.refresh_token, expires_in: session.expires_in } });
  });
  app2.get("/me", async (req, reply) => {
    if (!req.ctx) return reply.code(401).send({ error: "Unauthorized" });
    const service = createServiceClient();
    if (req.ctx.user_id === DEV_ACCOUNT.userId) {
      const { data: org2 } = await service.from("organizations").select("name").eq("id", DEV_ACCOUNT.orgId).single();
      return reply.send({
        user: {
          id: DEV_ACCOUNT.userId,
          org_id: DEV_ACCOUNT.orgId,
          role: "admin",
          name: "Dev User",
          email: DEV_ACCOUNT.email,
          org_name: org2?.name ?? "Dev Org",
          created_at: (/* @__PURE__ */ new Date()).toISOString()
        }
      });
    }
    const { data: profile } = await service.from("profiles").select("id, org_id, role, name, email, created_at").eq("id", req.ctx.user_id).single();
    if (!profile) return reply.code(403).send({ error: "No profile" });
    const { data: org } = await service.from("organizations").select("name").eq("id", profile.org_id).single();
    return reply.send({
      user: { ...profile, org_name: org?.name ?? null }
    });
  });
  app2.post("/me/push-token", async (req, reply) => {
    if (!req.ctx) return reply.code(401).send({ error: "Unauthorized" });
    const body = req.body || {};
    if (typeof body.token !== "string" || body.token.length < 10) {
      return reply.code(400).send({ error: "Invalid token" });
    }
    return reply.send({ ok: true });
  });
}

// src/routes/invites.ts
import { InviteAcceptSchema, InviteCreateSchema, PosthogEvents as PosthogEvents2 } from "@blockd2d/shared";

// src/routes/_helpers.ts
function requireAuth(req) {
  if (!req.ctx) {
    const err = new Error("Unauthorized");
    err.statusCode = 401;
    throw err;
  }
  return req.ctx;
}
function requireRoles(req, roles) {
  const ctx = requireAuth(req);
  requireRole(ctx, roles);
  return ctx;
}
var requireManager = (req) => requireRoles(req, ["admin", "manager"]);
var requireAnyAuthed = (req) => requireAuth(req);

// src/lib/audit.ts
async function audit(org_id, actor_profile_id, action, entity = {}, meta = {}) {
  const service = createServiceClient();
  await service.from("audit_log").insert({
    org_id,
    actor_profile_id,
    action,
    entity_type: entity.type || null,
    entity_id: entity.id || null,
    meta_json: meta || {}
  });
}

// src/routes/invites.ts
function randHex(len = 32) {
  return [...Array(len)].map(() => Math.floor(Math.random() * 16).toString(16)).join("");
}
async function invitesRoutes(app2) {
  app2.get("/", async (req, reply) => {
    const ctx = requireRoles(req, ["admin"]);
    const service = createServiceClient();
    const { data, error } = await service.from("invites").select("id, org_id, email, role, token, expires_at, accepted_at, created_at").eq("org_id", ctx.org_id).order("created_at", { ascending: false }).limit(200);
    if (error) return reply.code(400).send({ error: error.message });
    return reply.send({ invites: data || [] });
  });
  app2.delete("/:id", async (req, reply) => {
    const ctx = requireRoles(req, ["admin"]);
    const { id } = req.params;
    const service = createServiceClient();
    const { data: invite, error: fetchErr } = await service.from("invites").select("id, org_id, accepted_at").eq("id", id).eq("org_id", ctx.org_id).maybeSingle();
    if (fetchErr) return reply.code(400).send({ error: fetchErr.message });
    if (!invite) return reply.code(404).send({ error: "Not found" });
    const { error: delErr } = await service.from("invites").delete().eq("id", id).eq("org_id", ctx.org_id);
    if (delErr) return reply.code(400).send({ error: delErr.message });
    return reply.send({ ok: true });
  });
  app2.post("/", async (req, reply) => {
    const ctx = requireRoles(req, ["admin"]);
    const body = InviteCreateSchema.parse(req.body ?? {});
    const token = randHex(64);
    const expires = new Date(Date.now() + 1e3 * 60 * 60 * 24 * 7).toISOString();
    const service = createServiceClient();
    const { data, error } = await service.from("invites").insert({ org_id: ctx.org_id, email: body.email, role: body.role, token, expires_at: expires }).select("*").single();
    if (error) return reply.code(400).send({ error: error.message });
    const acceptLink = `${env.WEB_BASE_URL}/invite/accept?token=${encodeURIComponent(token)}`;
    await audit(ctx.org_id, ctx.profile_id, "invite.created", { type: "invite", id: data.id }, { email: body.email, role: body.role });
    await capture(PosthogEvents2.INVITE_CREATED, ctx.profile_id, { org_id: ctx.org_id, role: ctx.role, invited_role: body.role });
    return reply.send({ invite: data, acceptLink });
  });
  app2.post("/accept", async (req, reply) => {
    const body = InviteAcceptSchema.parse(req.body ?? {});
    const service = createServiceClient();
    const { data: invite } = await service.from("invites").select("*").eq("token", body.token).is("accepted_at", null).single();
    if (!invite) return reply.code(400).send({ error: "Invalid invite" });
    if (new Date(invite.expires_at).getTime() < Date.now()) return reply.code(400).send({ error: "Invite expired" });
    const { data: created, error: uErr } = await service.auth.admin.createUser({
      email: invite.email,
      password: body.password,
      email_confirm: true,
      user_metadata: { name: body.name }
    });
    if (uErr || !created.user) return reply.code(400).send({ error: uErr?.message || "Unable to create user" });
    await service.from("profiles").insert({
      id: created.user.id,
      org_id: invite.org_id,
      role: invite.role,
      name: body.name,
      email: invite.email
    });
    if (invite.role === "rep") {
      await service.from("reps").insert({
        org_id: invite.org_id,
        profile_id: created.user.id,
        name: body.name,
        home_lat: 0,
        home_lng: 0,
        active: true
      });
    } else if (invite.role === "labor") {
      await service.from("laborers").insert({
        org_id: invite.org_id,
        profile_id: created.user.id,
        name: body.name,
        active: true
      });
    }
    await service.from("invites").update({ accepted_at: (/* @__PURE__ */ new Date()).toISOString() }).eq("id", invite.id);
    const anon = createAnonClient();
    const { data: sessionData, error: sErr } = await anon.auth.signInWithPassword({ email: invite.email, password: body.password });
    if (sErr || !sessionData.session) return reply.code(400).send({ error: "Created user but unable to sign in" });
    setAuthCookies(reply, { access_token: sessionData.session.access_token, refresh_token: sessionData.session.refresh_token });
    await audit(invite.org_id, created.user.id, "invite.accepted", { type: "invite", id: invite.id }, {});
    await capture(PosthogEvents2.INVITE_ACCEPTED, created.user.id, { org_id: invite.org_id, role: invite.role });
    return reply.send({ ok: true });
  });
}

// src/routes/counties.ts
async function countiesRoutes(app2) {
  app2.get("/", async (req, reply) => {
    const ctx = requireManager(req);
    const service = createServiceClient();
    const { data, error } = await service.from("counties").select("*").eq("org_id", ctx.org_id).order("name");
    if (error) return reply.code(400).send({ error: error.message });
    return reply.send({ items: data || [] });
  });
}

// src/routes/properties.ts
async function propertiesRoutes(app2) {
  app2.get("/", async (req, reply) => {
    const ctx = requireManager(req);
    const q = req.query;
    const county_id = q.county_id ? String(q.county_id) : "";
    const bbox2 = q.bbox ? String(q.bbox) : null;
    const cursor = q.cursor ? String(q.cursor) : null;
    const limit = Math.min(5e3, Math.max(50, Number(q.limit || 2e3)));
    const service = createServiceClient();
    if (!county_id && !bbox2) {
      return reply.code(400).send({ error: "Provide county_id and/or bbox" });
    }
    let query = service.from("properties").select("id,lat,lng,address1,city,state,zip,value_estimate").eq("org_id", ctx.org_id).order("id").limit(limit);
    if (county_id) query = query.eq("county_id", county_id);
    if (cursor) query = query.gt("id", cursor);
    if (bbox2) {
      const parts = bbox2.split(",").map((v) => Number(v));
      if (parts.length === 4 && parts.every((n) => Number.isFinite(n))) {
        const [minLng, minLat, maxLng, maxLat] = parts;
        query = query.gte("lng", minLng).lte("lng", maxLng).gte("lat", minLat).lte("lat", maxLat);
      }
    }
    const { data, error } = await query;
    if (error) return reply.code(400).send({ error: error.message });
    const nextCursor = data && data.length === limit ? data[data.length - 1].id : null;
    return reply.send({ items: data || [], properties: data || [], nextCursor });
  });
  app2.get("/by-cluster/:clusterId", async (req, reply) => {
    const ctx = requireAnyAuthed(req);
    const { clusterId } = req.params;
    const service = createServiceClient();
    const { data: cluster } = await service.from("clusters").select("id,assigned_rep_id,cluster_set_id").eq("id", clusterId).eq("org_id", ctx.org_id).single();
    if (!cluster) return reply.code(404).send({ error: "Not found" });
    if (ctx.role === "rep") {
      const { data: rep } = await service.from("reps").select("id").eq("profile_id", ctx.profile_id).eq("org_id", ctx.org_id).single();
      if (!rep || rep.id !== cluster.assigned_rep_id) return reply.code(403).send({ error: "Forbidden" });
    }
    const { data, error } = await service.from("cluster_properties").select("property_id, properties:properties(id,lat,lng,address1,city,state,zip,value_estimate)").eq("org_id", ctx.org_id).eq("cluster_id", clusterId).limit(5e3);
    if (error) return reply.code(400).send({ error: error.message });
    const properties = (data || []).map((r) => r.properties);
    return reply.send({ properties });
  });
}

// src/routes/reps.ts
import { RepUpsertSchema, PosthogEvents as PosthogEvents3 } from "@blockd2d/shared";
import { z as z2 } from "zod";
async function getRepIdForProfile(service, org_id, profile_id) {
  const { data } = await service.from("reps").select("*").eq("org_id", org_id).eq("profile_id", profile_id).single();
  return data || null;
}
var RepLocationSchema = z2.object({
  lat: z2.number(),
  lng: z2.number(),
  speed: z2.number().optional().nullable(),
  heading: z2.number().optional().nullable(),
  clocked_in: z2.boolean().default(false),
  recorded_at: z2.string().datetime().optional()
});
async function repsRoutes(app2) {
  app2.get("/me", async (req, reply) => {
    const ctx = requireAnyAuthed(req);
    const service = createServiceClient();
    const rep = await getRepIdForProfile(service, ctx.org_id, ctx.profile_id);
    return reply.send({ rep });
  });
  app2.get("/me/clusters", async (req, reply) => {
    const ctx = requireRoles(req, ["rep"]);
    const service = createServiceClient();
    const rep = await getRepIdForProfile(service, ctx.org_id, ctx.profile_id);
    if (!rep) return reply.code(404).send({ error: "Rep profile not linked" });
    const { data, error } = await service.from("clusters").select("id,cluster_set_id,center_lat,center_lng,hull_geojson,stats_json,color,assigned_rep_id,created_at").eq("org_id", ctx.org_id).eq("assigned_rep_id", rep.id).order("created_at", { ascending: false }).limit(5e3);
    if (error) return reply.code(400).send({ error: error.message });
    return reply.send({ clusters: data || [] });
  });
  app2.post("/me/location", async (req, reply) => {
    const ctx = requireRoles(req, ["rep"]);
    const service = createServiceClient();
    const rep = await getRepIdForProfile(service, ctx.org_id, ctx.profile_id);
    if (!rep) return reply.code(404).send({ error: "Rep profile not linked" });
    const body = RepLocationSchema.parse(req.body ?? {});
    const at = body.recorded_at || (/* @__PURE__ */ new Date()).toISOString();
    const { data, error } = await service.from("rep_locations").insert({
      org_id: ctx.org_id,
      rep_id: rep.id,
      lat: body.lat,
      lng: body.lng,
      speed: body.speed ?? null,
      heading: body.heading ?? null,
      recorded_at: at,
      clocked_in: body.clocked_in
    }).select("*").single();
    if (error) return reply.code(400).send({ error: error.message });
    return reply.send({ location: data });
  });
  async function getLocationsLatest(req, reply) {
    try {
      const ctx = requireManager(req);
      const service = createServiceClient();
      const { data, error } = await service.from("rep_locations_latest").select("id, org_id, rep_id, lat, lng, speed, heading, clocked_in, recorded_at").eq("org_id", ctx.org_id);
      if (error) {
        return reply.send({ locations: [] });
      }
      const rows = data || [];
      const repIds = [...new Set(rows.map((d) => d.rep_id).filter(Boolean))];
      let nameById = /* @__PURE__ */ new Map();
      if (repIds.length > 0) {
        const { data: reps } = await service.from("reps").select("id,name").eq("org_id", ctx.org_id).in("id", repIds);
        nameById = new Map((reps || []).map((r) => [r.id, r.name]));
      }
      const out = rows.map((d) => ({ ...d, rep_name: nameById.get(d.rep_id) || null }));
      return reply.send({ locations: out });
    } catch {
      return reply.send({ locations: [] });
    }
  }
  app2.get("/locations", getLocationsLatest);
  app2.get("/locations/latest", getLocationsLatest);
  app2.get("/", async (req, reply) => {
    const ctx = requireManager(req);
    const service = createServiceClient();
    const { data, error } = await service.from("reps").select("*").eq("org_id", ctx.org_id).order("name");
    if (error) return reply.code(400).send({ error: error.message });
    const items = (data || []).map((r) => ({
      ...r,
      // web back-compat
      home_base_lat: r.home_lat,
      home_base_lng: r.home_lng
    }));
    return reply.send({ items });
  });
  app2.post("/", async (req, reply) => {
    const ctx = requireManager(req);
    const body = RepUpsertSchema.parse(req.body ?? {});
    const service = createServiceClient();
    const { data, error } = await service.from("reps").insert({ org_id: ctx.org_id, name: body.name, home_lat: body.home_lat, home_lng: body.home_lng, active: body.active }).select("*").single();
    if (error) return reply.code(400).send({ error: error.message });
    await audit(ctx.org_id, ctx.profile_id, "rep.created", { type: "rep", id: data.id }, { name: data.name });
    await capture(PosthogEvents3.CLUSTER_ASSIGNED, ctx.profile_id, { org_id: ctx.org_id, role: ctx.role });
    return reply.send({ rep: data });
  });
  app2.put("/:id", async (req, reply) => {
    const ctx = requireManager(req);
    const { id } = req.params;
    const body = RepUpsertSchema.parse(req.body ?? {});
    const service = createServiceClient();
    const { data, error } = await service.from("reps").update({ name: body.name, home_lat: body.home_lat, home_lng: body.home_lng, active: body.active }).eq("id", id).eq("org_id", ctx.org_id).select("*").single();
    if (error) return reply.code(400).send({ error: error.message });
    await audit(ctx.org_id, ctx.profile_id, "rep.updated", { type: "rep", id }, {});
    return reply.send({ rep: data });
  });
  app2.delete("/:id", async (req, reply) => {
    const ctx = requireManager(req);
    const { id } = req.params;
    const service = createServiceClient();
    const { error } = await service.from("reps").delete().eq("id", id).eq("org_id", ctx.org_id);
    if (error) return reply.code(400).send({ error: error.message });
    await audit(ctx.org_id, ctx.profile_id, "rep.deleted", { type: "rep", id }, {});
    return reply.send({ ok: true });
  });
}

// src/routes/interactions.ts
import { InteractionCreateSchema, PosthogEvents as PosthogEvents4 } from "@blockd2d/shared";
async function getRepIdForProfile2(service, org_id, profile_id) {
  const { data } = await service.from("reps").select("id").eq("org_id", org_id).eq("profile_id", profile_id).single();
  return data?.id || null;
}
async function interactionsRoutes(app2) {
  app2.post("/", async (req, reply) => {
    const ctx = requireAnyAuthed(req);
    if (ctx.role === "labor") return reply.code(403).send({ error: "Forbidden" });
    const body = InteractionCreateSchema.parse(req.body ?? {});
    const service = createServiceClient();
    let rep_id = null;
    if (ctx.role === "rep") rep_id = await getRepIdForProfile2(service, ctx.org_id, ctx.profile_id);
    else rep_id = req.body?.rep_id || null;
    const { data, error } = await service.from("interactions").insert({
      org_id: ctx.org_id,
      rep_id,
      property_id: body.property_id,
      outcome: body.outcome,
      notes: body.notes ?? null,
      followup_at: body.followup_at ?? null
    }).select("*").single();
    if (error) return reply.code(400).send({ error: error.message });
    await audit(ctx.org_id, ctx.profile_id, "interaction.created", { type: "interaction", id: data.id }, { outcome: body.outcome, property_id: body.property_id });
    await capture(PosthogEvents4.INTERACTION_LOGGED, ctx.profile_id, {
      org_id: ctx.org_id,
      role: ctx.role,
      rep_id,
      property_id: body.property_id,
      outcome: body.outcome
    });
    return reply.send({ interaction: data });
  });
  app2.get("/", async (req, reply) => {
    const ctx = requireAnyAuthed(req);
    const service = createServiceClient();
    let query = service.from("interactions").select("*").eq("org_id", ctx.org_id).order("created_at", { ascending: false }).limit(200);
    if (ctx.role === "rep") {
      const repId = await getRepIdForProfile2(service, ctx.org_id, ctx.profile_id);
      query = query.eq("rep_id", repId);
    }
    if (ctx.role === "labor") return reply.code(403).send({ error: "Forbidden" });
    const { data, error } = await query;
    if (error) return reply.code(400).send({ error: error.message });
    return reply.send({ interactions: data });
  });
}

// src/routes/cluster-sets.ts
import { ClusterSetCreateSchema, PosthogEvents as PosthogEvents5 } from "@blockd2d/shared";
async function clusterSetsRoutes(app2) {
  app2.get("/", async (req, reply) => {
    const ctx = requireManager(req);
    const service = createServiceClient();
    const { data, error } = await service.from("cluster_sets").select("*").eq("org_id", ctx.org_id).order("created_at", { ascending: false }).limit(50);
    if (error) return reply.code(400).send({ error: error.message });
    return reply.send({ items: data || [] });
  });
  app2.post("/", async (req, reply) => {
    const ctx = requireManager(req);
    let body;
    try {
      body = ClusterSetCreateSchema.parse(req.body ?? {});
    } catch (err) {
      const msg = err?.message ?? "Validation failed";
      return reply.code(400).send({ error: msg, details: err?.issues ?? void 0 });
    }
    const service = createServiceClient();
    const { data: set, error } = await service.from("cluster_sets").insert({
      org_id: ctx.org_id,
      county_id: body.county_id,
      filters_json: body.filters,
      name: body.name || "Cluster Set",
      radius_m: body.filters.radius_m,
      min_houses: body.filters.min_houses,
      status: "queued",
      progress: 0,
      created_by: ctx.profile_id
    }).select("*").single();
    if (error || !set) return reply.code(400).send({ error: error?.message || "failed" });
    await service.from("jobs_queue").insert({
      org_id: ctx.org_id,
      type: "cluster_generate",
      status: "queued",
      payload: { cluster_set_id: set.id }
    });
    await audit(ctx.org_id, ctx.profile_id, "clusterset.created", { type: "cluster_set", id: set.id }, { county_id: body.county_id, filters: body.filters });
    await capture(PosthogEvents5.CLUSTERSET_CREATED, ctx.profile_id, { org_id: ctx.org_id, role: ctx.role, county_id: body.county_id, cluster_set_id: set.id });
    return reply.send({ cluster_set: set });
  });
  app2.get("/:id", async (req, reply) => {
    const ctx = requireManager(req);
    const { id } = req.params;
    const service = createServiceClient();
    const { data, error } = await service.from("cluster_sets").select("*").eq("id", id).eq("org_id", ctx.org_id).single();
    if (error) return reply.code(404).send({ error: "Not found" });
    return reply.send({ cluster_set: data });
  });
  app2.patch("/:id", async (req, reply) => {
    const ctx = requireManager(req);
    const { id } = req.params;
    const body = req.body;
    const name = typeof body?.name === "string" ? body.name.trim() : void 0;
    if (name === void 0) return reply.code(400).send({ error: "name required" });
    const service = createServiceClient();
    const { data, error } = await service.from("cluster_sets").update({ name }).eq("id", id).eq("org_id", ctx.org_id).select("*").single();
    if (error) return reply.code(400).send({ error: error.message });
    return reply.send({ cluster_set: data });
  });
  app2.delete("/:id", async (req, reply) => {
    const ctx = requireManager(req);
    const { id } = req.params;
    const service = createServiceClient();
    const { error: deleteErr } = await service.from("cluster_sets").delete().eq("id", id).eq("org_id", ctx.org_id);
    if (deleteErr) return reply.code(400).send({ error: deleteErr.message });
    await audit(ctx.org_id, ctx.profile_id, "clusterset.deleted", { type: "cluster_set", id }, {});
    return reply.send({ ok: true });
  });
  app2.get("/:id/clusters", async (req, reply) => {
    const ctx = requireManager(req);
    const { id } = req.params;
    const service = createServiceClient();
    const { data, error } = await service.from("clusters").select("*").eq("org_id", ctx.org_id).eq("cluster_set_id", id);
    if (error) return reply.code(400).send({ error: error.message });
    return reply.send({ items: data || [] });
  });
  app2.get("/:id/suggest-assignments", async (req, reply) => {
    const ctx = requireManager(req);
    const { id } = req.params;
    const service = createServiceClient();
    const { data: set, error: setErr } = await service.from("cluster_sets").select("id, org_id").eq("id", id).eq("org_id", ctx.org_id).single();
    if (setErr || !set) return reply.code(404).send({ error: "Cluster set not found" });
    const { data: reps, error: repErr } = await service.from("reps").select("id,name,home_lat,home_lng,active").eq("org_id", ctx.org_id).eq("active", true).order("name");
    if (repErr) return reply.code(400).send({ error: repErr.message });
    const { data: clusters, error: cErr } = await service.from("clusters").select("id,assigned_rep_id,center_lat,center_lng,stats_json").eq("org_id", ctx.org_id).eq("cluster_set_id", id).limit(2e4);
    if (cErr) return reply.code(400).send({ error: cErr.message });
    const repsArr = reps || [];
    const clustersArr = clusters || [];
    if (repsArr.length === 0 || clustersArr.length === 0) return reply.send({ suggestions: [] });
    function miles(aLat, aLng, bLat, bLng) {
      const R = 3958.8;
      const dLat = (bLat - aLat) * Math.PI / 180;
      const dLng = (bLng - aLng) * Math.PI / 180;
      const s1 = Math.sin(dLat / 2);
      const s2 = Math.sin(dLng / 2);
      const c = 2 * Math.asin(Math.sqrt(s1 * s1 + Math.cos(aLat * Math.PI / 180) * Math.cos(bLat * Math.PI / 180) * s2 * s2));
      return R * c;
    }
    const getVal = (c) => Number(c?.stats_json?.total_potential ?? c?.stats_json?.total_value ?? 0);
    const totalValue = clustersArr.reduce((acc, c) => acc + getVal(c), 0);
    const targetValue = totalValue / Math.max(1, repsArr.length);
    const assignedByRep = {};
    for (const r of repsArr) assignedByRep[r.id] = 0;
    const sorted = clustersArr.slice().sort((a, b) => getVal(b) - getVal(a));
    const suggestions = [];
    for (const c of sorted) {
      let best = null;
      for (const r of repsArr) {
        if (r.home_lat == null || r.home_lng == null) continue;
        const d = miles(r.home_lat, r.home_lng, c.center_lat, c.center_lng);
        const value = getVal(c);
        const load = assignedByRep[r.id] / Math.max(1, targetValue);
        const score = d * 1 + load * 2 - value / 1e6 * 0.25;
        if (!best || score < best.score) best = { rep_id: r.id, distance_miles: d, score };
      }
      if (!best) continue;
      suggestions.push({ cluster_id: c.id, rep_id: best.rep_id, distance_miles: Number(best.distance_miles.toFixed(2)) });
      assignedByRep[best.rep_id] += getVal(c);
    }
    return reply.send({ suggestions });
  });
  app2.post("/:id/assign", async (req, reply) => {
    const ctx = requireManager(req);
    const { id } = req.params;
    const body = req.body || {};
    const assignments = body.assignments || [];
    if (!Array.isArray(assignments) || assignments.length === 0) return reply.code(400).send({ error: "assignments required" });
    const service = createServiceClient();
    for (const a of assignments) {
      await service.from("clusters").update({ assigned_rep_id: a.rep_id }).eq("id", a.cluster_id).eq("org_id", ctx.org_id).eq("cluster_set_id", id);
    }
    await audit(ctx.org_id, ctx.profile_id, "cluster.assign.bulk", { type: "cluster_set", id }, { count: assignments.length });
    await capture(PosthogEvents5.CLUSTER_ASSIGNED, ctx.profile_id, { org_id: ctx.org_id, role: ctx.role, cluster_set_id: id, count: assignments.length });
    return reply.send({ ok: true });
  });
}

// src/routes/clusters.ts
function haversineKm(a, b) {
  const R = 6371;
  const toRad = (d) => d * Math.PI / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const sinDLat = Math.sin(dLat / 2);
  const sinDLng = Math.sin(dLng / 2);
  const h = sinDLat * sinDLat + Math.cos(lat1) * Math.cos(lat2) * sinDLng * sinDLng;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}
async function getRepIdForProfile3(service, org_id, profile_id) {
  const { data } = await service.from("reps").select("id").eq("org_id", org_id).eq("profile_id", profile_id).single();
  return data?.id || null;
}
async function clustersRoutes(app2) {
  app2.get("/", async (req, reply) => {
    const ctx = requireAnyAuthed(req);
    const q = req.query;
    const cluster_set_id = q.cluster_set_id ? String(q.cluster_set_id) : "";
    const limit = Math.min(5e3, Math.max(1, Number(q.limit || 2e3)));
    if (!cluster_set_id) return reply.code(400).send({ error: "cluster_set_id required" });
    const service = createServiceClient();
    let repId = null;
    if (ctx.role === "rep") {
      repId = await getRepIdForProfile3(service, ctx.org_id, ctx.profile_id);
      if (!repId) return reply.code(403).send({ error: "Forbidden" });
    }
    if (ctx.role === "labor") return reply.code(403).send({ error: "Forbidden" });
    let query = service.from("clusters").select("id,cluster_set_id,name,assigned_rep_id,center_lat,center_lng,hull_geojson,stats_json,color,created_at").eq("org_id", ctx.org_id).eq("cluster_set_id", cluster_set_id).order("created_at", { ascending: true }).limit(limit);
    if (repId) query = query.eq("assigned_rep_id", repId);
    const { data, error } = await query;
    if (error) return reply.code(400).send({ error: error.message });
    const rows = (data || []).map((c) => ({ ...c, polygon_geojson: c.hull_geojson }));
    return reply.send({ items: rows, clusters: rows });
  });
  app2.post("/assign", async (req, reply) => {
    const ctx = requireManager(req);
    const body = req.body || {};
    const cluster_id = String(body.cluster_id || "");
    const assigned_rep_id = body.rep_id ? String(body.rep_id) : null;
    if (!cluster_id) return reply.code(400).send({ error: "cluster_id required" });
    const service = createServiceClient();
    const { data, error } = await service.from("clusters").update({ assigned_rep_id }).eq("org_id", ctx.org_id).eq("id", cluster_id).select("id,assigned_rep_id").single();
    if (error) return reply.code(400).send({ error: error.message });
    return reply.send({ cluster: data });
  });
  app2.post("/assign-bulk", async (req, reply) => {
    const ctx = requireManager(req);
    const body = req.body || {};
    const service = createServiceClient();
    const mapping = body.mapping || body.rep_id_by_cluster;
    const rep_id = body.rep_id ? String(body.rep_id) : null;
    const cluster_ids = Array.isArray(body.cluster_ids) ? body.cluster_ids.map(String) : null;
    if (mapping && typeof mapping === "object") {
      const updates = Object.entries(mapping).map(([cluster_id, assigned_rep_id]) => ({ cluster_id, assigned_rep_id }));
      for (const u of updates) {
        await service.from("clusters").update({ assigned_rep_id: u.assigned_rep_id || null }).eq("org_id", ctx.org_id).eq("id", u.cluster_id);
      }
      return reply.send({ ok: true, updated: updates.length });
    }
    if (!rep_id || !cluster_ids || cluster_ids.length === 0) {
      return reply.code(400).send({ error: "Provide either mapping, or rep_id + cluster_ids[]" });
    }
    const { error } = await service.from("clusters").update({ assigned_rep_id: rep_id }).eq("org_id", ctx.org_id).in("id", cluster_ids);
    if (error) return reply.code(400).send({ error: error.message });
    return reply.send({ ok: true, updated: cluster_ids.length });
  });
  app2.get("/:id", async (req, reply) => {
    const ctx = requireAnyAuthed(req);
    const { id } = req.params;
    const service = createServiceClient();
    const { data: cluster, error } = await service.from("clusters").select("*").eq("org_id", ctx.org_id).eq("id", id).single();
    if (error || !cluster) return reply.code(404).send({ error: "Not found" });
    if (ctx.role === "rep") {
      const repId = await getRepIdForProfile3(service, ctx.org_id, ctx.profile_id);
      if (!repId || cluster.assigned_rep_id !== repId) return reply.code(403).send({ error: "Forbidden" });
    }
    if (ctx.role === "labor") {
      return reply.code(403).send({ error: "Forbidden" });
    }
    return reply.send({ cluster });
  });
  app2.patch("/:id", async (req, reply) => {
    const ctx = requireManager(req);
    const { id } = req.params;
    const body = req.body;
    const name = body && "name" in body ? body.name === null || body.name === "" ? null : String(body.name).trim() : void 0;
    if (name === void 0) return reply.code(400).send({ error: "name required (string or null)" });
    const service = createServiceClient();
    const { data, error } = await service.from("clusters").update({ name: name || null }).eq("id", id).eq("org_id", ctx.org_id).select("id,name,assigned_rep_id").single();
    if (error) {
      if (error.code === "PGRST116") return reply.code(404).send({ error: "Not found" });
      return reply.code(400).send({ error: error.message });
    }
    return reply.send({ cluster: data });
  });
  app2.get("/:id/properties", async (req, reply) => {
    const ctx = requireAnyAuthed(req);
    const { id } = req.params;
    const service = createServiceClient();
    const { data: cluster } = await service.from("clusters").select("id, assigned_rep_id").eq("org_id", ctx.org_id).eq("id", id).single();
    if (!cluster) return reply.code(404).send({ error: "Cluster not found" });
    if (ctx.role === "rep") {
      const repId = await getRepIdForProfile3(service, ctx.org_id, ctx.profile_id);
      if (!repId || cluster.assigned_rep_id !== repId) return reply.code(403).send({ error: "Forbidden" });
    }
    if (ctx.role === "labor") return reply.code(403).send({ error: "Forbidden" });
    const { data, error } = await service.from("cluster_properties").select("property_id, properties:property_id(id,lat,lng,address1,city,state,zip,value_estimate,tags,county_id,created_at)").eq("org_id", ctx.org_id).eq("cluster_id", id).limit(5e4);
    if (error) return reply.code(400).send({ error: error.message });
    const properties = (data || []).map((r) => r.properties).filter(Boolean);
    return reply.send({ properties });
  });
  app2.get("/:id/inspector", async (req, reply) => {
    const ctx = requireAnyAuthed(req);
    const { id } = req.params;
    const service = createServiceClient();
    const { data: cluster, error } = await service.from("clusters").select("id,name,org_id,cluster_set_id,center_lat,center_lng,assigned_rep_id,stats_json,color,hull_geojson").eq("org_id", ctx.org_id).eq("id", id).single();
    if (error || !cluster) return reply.code(404).send({ error: "Not found" });
    if (ctx.role === "rep") {
      const repId = await getRepIdForProfile3(service, ctx.org_id, ctx.profile_id);
      if (!repId || cluster.assigned_rep_id !== repId) return reply.code(403).send({ error: "Forbidden" });
    }
    if (ctx.role === "labor") return reply.code(403).send({ error: "Forbidden" });
    const center = { lat: Number(cluster.center_lat), lng: Number(cluster.center_lng) };
    const { data: cp, error: cpErr } = await service.from("cluster_properties").select("property_id, properties:property_id(id,value_estimate)").eq("org_id", ctx.org_id).eq("cluster_id", id).limit(5e4);
    if (cpErr) return reply.code(400).send({ error: cpErr.message });
    const propRows = (cp || []).map((r) => r.properties).filter(Boolean);
    const property_ids = propRows.map((p) => p.id);
    const total_properties = property_ids.length;
    const total_potential = propRows.reduce((acc, p) => acc + (p.value_estimate ? Number(p.value_estimate) : 0), 0);
    const avg_value = total_properties > 0 ? total_potential / total_properties : 0;
    let zip_codes = [];
    let drive_to_destination = null;
    if (property_ids.length > 0) {
      const { data: addrRows, error: addrErr } = await service.from("cluster_properties").select("property_id, properties:property_id(id,address1,city,state,zip,lat,lng)").eq("org_id", ctx.org_id).eq("cluster_id", id).limit(5e4);
      if (!addrErr && addrRows?.length) {
        const props = addrRows.map((r) => r.properties).filter(Boolean);
        const zips = /* @__PURE__ */ new Set();
        for (const p of props) {
          if (p.zip && String(p.zip).trim()) zips.add(String(p.zip).trim());
        }
        zip_codes = Array.from(zips).sort();
        const southernmost = props.filter((p) => p.lat != null && Number.isFinite(Number(p.lat))).sort((a, b) => {
          const latA = Number(a.lat);
          const latB = Number(b.lat);
          if (latA !== latB) return latA - latB;
          const lngA = Number(a.lng ?? 0);
          const lngB = Number(b.lng ?? 0);
          return lngA - lngB;
        })[0];
        if (southernmost) {
          let address1 = southernmost.address1 ?? void 0;
          if (address1 != null && /^Parcel\s+/i.test(String(address1).trim())) {
            address1 = void 0;
          }
          drive_to_destination = {
            address1,
            city: southernmost.city ?? void 0,
            state: southernmost.state ?? void 0,
            zip: southernmost.zip ?? void 0
          };
        }
      }
    }
    const outcome_counts = {};
    let worked = 0;
    let unworked = total_properties;
    let followups_due = 0;
    const now = Date.now();
    if (property_ids.length > 0) {
      const latestByProperty = /* @__PURE__ */ new Map();
      for (let i = 0; i < property_ids.length; i += 1e3) {
        const chunk = property_ids.slice(i, i + 1e3);
        const { data: interactions, error: iErr } = await service.from("interactions").select("property_id,outcome,created_at,followup_at").eq("org_id", ctx.org_id).in("property_id", chunk).order("created_at", { ascending: false }).limit(2e5);
        if (iErr) return reply.code(400).send({ error: iErr.message });
        for (const it of interactions || []) {
          if (!latestByProperty.has(it.property_id)) latestByProperty.set(it.property_id, it);
        }
      }
      worked = latestByProperty.size;
      unworked = Math.max(0, total_properties - worked);
      for (const it of latestByProperty.values()) {
        const k = String(it.outcome || "unknown");
        outcome_counts[k] = (outcome_counts[k] || 0) + 1;
        if (it.followup_at) {
          const t = new Date(it.followup_at).getTime();
          if (Number.isFinite(t) && t <= now) followups_due += 1;
        }
      }
    }
    const { data: reps } = await service.from("reps").select("id,name,home_lat,home_lng").eq("org_id", ctx.org_id).limit(500);
    const repDistances = (reps || []).filter((r) => r.home_lat != null && r.home_lng != null).map((r) => ({
      id: r.id,
      name: r.name,
      distance_km: haversineKm({ lat: Number(r.home_lat), lng: Number(r.home_lng) }, center)
    })).sort((a, b) => a.distance_km - b.distance_km);
    const nearest_rep = repDistances[0] || null;
    const assigned_rep_distance_km = cluster.assigned_rep_id ? repDistances.find((r) => r.id === cluster.assigned_rep_id)?.distance_km ?? null : null;
    const status_rollups = {
      unworked,
      leads: outcome_counts["lead"] || 0,
      quotes: outcome_counts["quote"] || 0,
      sold: outcome_counts["sold"] || 0,
      dnk: outcome_counts["do_not_knock"] || 0
    };
    const nearest_rep_payload = nearest_rep ? {
      rep_id: nearest_rep.id,
      rep_name: nearest_rep.name,
      distance_miles: Number((nearest_rep.distance_km * 0.621371).toFixed(2))
    } : null;
    const assigned_rep_distance_miles = assigned_rep_distance_km != null ? Number((Number(assigned_rep_distance_km) * 0.621371).toFixed(2)) : null;
    return reply.send({
      cluster,
      summary: {
        // New, web-friendly keys
        house_count: total_properties,
        avg_value_estimate: avg_value,
        total_potential,
        center,
        assigned_rep_id: cluster.assigned_rep_id,
        status_rollups,
        followups_due,
        nearest_rep: nearest_rep_payload,
        assigned_rep_distance_miles,
        // Back-compat keys
        total_properties,
        worked,
        unworked,
        outcome_counts,
        avg_value
      },
      zip_codes,
      drive_to_destination
    });
  });
}

// src/routes/sales.ts
import { PosthogEvents as PosthogEvents6, SaleCreateSchema } from "@blockd2d/shared";

// src/routes/_range.ts
var DAY_MS = 1e3 * 60 * 60 * 24;
function toDay(d) {
  return d.toISOString().slice(0, 10);
}
function clampRange(input) {
  const r = String(input || "week");
  if (r === "month" || r === "all") return r;
  return "week";
}
function getRangeWindow(rangeInput) {
  const range = clampRange(rangeInput);
  const today = /* @__PURE__ */ new Date();
  const until = new Date(today);
  const days = range === "month" ? 30 : range === "all" ? 3650 : 7;
  const since = new Date(until.getTime() - (days - 1) * DAY_MS);
  const sinceDay = toDay(since);
  const untilDay = toDay(until);
  let priorSince = null;
  let priorUntil = null;
  let priorSinceDay = null;
  let priorUntilDay = null;
  if (range !== "all") {
    priorUntil = new Date(since.getTime() - DAY_MS);
    priorSince = new Date(priorUntil.getTime() - (days - 1) * DAY_MS);
    priorSinceDay = toDay(priorSince);
    priorUntilDay = toDay(priorUntil);
  }
  return {
    range,
    days,
    since,
    until,
    sinceDay,
    untilDay,
    priorSince,
    priorUntil,
    priorSinceDay,
    priorUntilDay
  };
}
function enumerateDaysISO(startDayISO, endDayISO) {
  const out = [];
  const start = /* @__PURE__ */ new Date(startDayISO + "T00:00:00.000Z");
  const end = /* @__PURE__ */ new Date(endDayISO + "T00:00:00.000Z");
  for (let t = start.getTime(); t <= end.getTime(); t += DAY_MS) {
    out.push(new Date(t).toISOString().slice(0, 10));
  }
  return out;
}

// src/routes/sales.ts
function parseDataUrl(dataUrl) {
  const m = /^data:([^;]+);base64,(.+)$/i.exec(dataUrl || "");
  if (!m) return null;
  return { mime: m[1], b64: m[2] };
}
async function getRepIdForProfile4(service, org_id, profile_id) {
  const { data } = await service.from("reps").select("id").eq("org_id", org_id).eq("profile_id", profile_id).single();
  return data?.id || null;
}
async function assertSaleAccess(service, ctx, saleId) {
  if (ctx.role !== "rep") return { ok: true, repId: null };
  const repId = await getRepIdForProfile4(service, ctx.org_id, ctx.profile_id);
  if (!repId) return { ok: false, repId: null, error: "Rep not provisioned" };
  const { data: sale } = await service.from("sales").select("id, rep_id").eq("id", saleId).eq("org_id", ctx.org_id).single();
  if (!sale || sale.rep_id !== repId) return { ok: false, repId, error: "Forbidden" };
  return { ok: true, repId };
}
function clampInt(v, def, min, max) {
  const n = Number(v);
  if (!Number.isFinite(n)) return def;
  return Math.max(min, Math.min(max, Math.floor(n)));
}
function sanitizeLike(input) {
  return input.replace(/[,%]/g, " ").trim();
}
function parseDateMaybe(input, endOfDay = false) {
  if (!input) return null;
  const s = String(input).trim();
  if (!s) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    return /* @__PURE__ */ new Date(s + (endOfDay ? "T23:59:59.999Z" : "T00:00:00.000Z"));
  }
  const d = new Date(s);
  return Number.isFinite(d.getTime()) ? d : null;
}
async function salesRoutes(app2) {
  app2.get("/", async (req, reply) => {
    const ctx = requireAnyAuthed(req);
    const q = req.query || {};
    const page = clampInt(q.page, 1, 1, 1e5);
    const limit = clampInt(q.limit, 25, 10, 100);
    const offset = (page - 1) * limit;
    const service = createServiceClient();
    let repId = null;
    if (ctx.role === "rep") {
      repId = await getRepIdForProfile4(service, ctx.org_id, ctx.profile_id);
      if (!repId) return reply.code(403).send({ error: "Rep not provisioned" });
    }
    let since = null;
    let until = null;
    const customFrom = parseDateMaybe(q.date_from || q.since, false);
    const customTo = parseDateMaybe(q.date_to || q.until, true);
    if (customFrom || customTo) {
      since = customFrom;
      until = customTo;
    } else {
      const { since: sinceDt, until: untilDt } = getRangeWindow(q.range).range === "all" ? { since: /* @__PURE__ */ new Date(0), until: /* @__PURE__ */ new Date() } : getRangeWindow(q.range);
      since = sinceDt;
      until = untilDt;
    }
    const statusesRaw = q.statuses || q.status || "";
    const statuses = String(statusesRaw).split(",").map((s) => s.trim()).filter(Boolean);
    const search = q.q ? sanitizeLike(String(q.q)).slice(0, 120) : "";
    const repFilter = ctx.role !== "rep" && q.rep_id ? String(q.rep_id) : null;
    let query = service.from("sales_view").select("*", { count: "exact" }).eq("org_id", ctx.org_id).order("created_at", { ascending: false }).range(offset, offset + limit - 1);
    if (since) query = query.gte("created_at", since.toISOString());
    if (until) query = query.lte("created_at", until.toISOString());
    if (ctx.role === "rep") query = query.eq("rep_id", repId);
    else if (repFilter) query = query.eq("rep_id", repFilter);
    if (statuses.length === 1) query = query.eq("pipeline_status", statuses[0]);
    if (statuses.length > 1) query = query.in("pipeline_status", statuses);
    if (search) {
      query = query.or(
        `customer_name.ilike.%${search}%,customer_phone.ilike.%${search}%,customer_email.ilike.%${search}%,address1.ilike.%${search}%`
      );
    }
    let { data, error, count } = await query;
    const useSalesFallback = error && /sales_view|schema cache/i.test(String(error.message));
    if (useSalesFallback) {
      let fallback = service.from("sales").select("*", { count: "exact" }).eq("org_id", ctx.org_id).order("created_at", { ascending: false }).range(offset, offset + limit - 1);
      if (since) fallback = fallback.gte("created_at", since.toISOString());
      if (until) fallback = fallback.lte("created_at", until.toISOString());
      if (ctx.role === "rep") fallback = fallback.eq("rep_id", repId);
      else if (repFilter) fallback = fallback.eq("rep_id", repFilter);
      if (statuses.length === 1) fallback = fallback.eq("status", statuses[0]);
      if (statuses.length > 1) fallback = fallback.in("status", statuses);
      if (search) {
        fallback = fallback.or(
          `customer_name.ilike.%${search}%,customer_phone.ilike.%${search}%,customer_email.ilike.%${search}%`
        );
      }
      const result = await fallback;
      if (result.error) {
        data = [];
        count = 0;
        error = null;
      } else {
        data = (result.data || []).map((row) => ({ ...row, pipeline_status: row.status ?? row.pipeline_status }));
        count = result.count ?? 0;
        error = null;
      }
    }
    if (error) return reply.code(400).send({ error: error.message });
    return reply.send({
      items: data || [],
      sales: data || [],
      page,
      limit,
      total: count || 0
    });
  });
  app2.get("/:id", async (req, reply) => {
    const ctx = requireAnyAuthed(req);
    const { id } = req.params;
    const service = createServiceClient();
    let { data: sale, error } = await service.from("sales_view").select("*").eq("org_id", ctx.org_id).eq("id", id).single();
    if (error && /sales_view|schema cache/i.test(String(error.message))) {
      const fallback = await service.from("sales").select("*").eq("org_id", ctx.org_id).eq("id", id).single();
      sale = fallback.data ? { ...fallback.data, pipeline_status: fallback.data.status ?? fallback.data.pipeline_status } : null;
      error = fallback.error;
    }
    if (error || !sale) return reply.code(404).send({ error: "Not found" });
    if (ctx.role === "rep") {
      const repId = await getRepIdForProfile4(service, ctx.org_id, ctx.profile_id);
      if (!repId) return reply.code(403).send({ error: "Rep not provisioned" });
      if (sale.rep_id !== repId) return reply.code(403).send({ error: "Forbidden" });
    }
    if (ctx.role === "labor") return reply.code(403).send({ error: "Forbidden" });
    const { data: attRows } = await service.from("sale_attachments").select("id,type,storage_path,created_at").eq("org_id", ctx.org_id).eq("sale_id", id).order("created_at", { ascending: false }).limit(200);
    const attachments = [];
    for (const a of attRows || []) {
      const { data: signed, error: sErr } = await service.storage.from("attachments").createSignedUrl(a.storage_path, 60 * 10);
      attachments.push({
        id: a.id,
        type: a.type,
        storage_path: a.storage_path,
        created_at: a.created_at,
        url: sErr ? null : signed.signedUrl
      });
    }
    const { data: contractRow } = await service.from("contracts").select("id,storage_path,created_at").eq("org_id", ctx.org_id).eq("sale_id", id).order("created_at", { ascending: false }).limit(1).maybeSingle();
    let contract = null;
    if (contractRow?.storage_path) {
      const { data: signed, error: cErr } = await service.storage.from("contracts").createSignedUrl(contractRow.storage_path, 60 * 10);
      contract = {
        id: contractRow.id,
        storage_path: contractRow.storage_path,
        created_at: contractRow.created_at,
        url: cErr ? null : signed.signedUrl
      };
    }
    const { data: auditRows } = await service.from("audit_log").select("id,action,actor_profile_id,entity_type,entity_id,meta,created_at").eq("org_id", ctx.org_id).eq("entity_type", "sale").eq("entity_id", id).order("created_at", { ascending: false }).limit(200);
    return reply.send({
      sale,
      customer: {
        name: sale.customer_name || null,
        phone: sale.customer_phone || null,
        email: sale.customer_email || null,
        address: [sale.address1, sale.city, sale.state, sale.zip].filter(Boolean).join(", ") || null
      },
      attachments,
      contract,
      audit: auditRows || []
    });
  });
  app2.get("/:id/attachments", async (req, reply) => {
    const ctx = requireAnyAuthed(req);
    const { id } = req.params;
    const service = createServiceClient();
    const access = await assertSaleAccess(service, ctx, id);
    if (!access.ok) return reply.code(access.error === "Rep not provisioned" ? 403 : 403).send({ error: access.error });
    if (ctx.role === "labor") return reply.code(403).send({ error: "Forbidden" });
    const { data: rows, error } = await service.from("sale_attachments").select("id,type,storage_path,created_at").eq("org_id", ctx.org_id).eq("sale_id", id).order("created_at", { ascending: false }).limit(200);
    if (error) return reply.code(400).send({ error: error.message });
    const attachments = [];
    for (const a of rows || []) {
      const { data: signed, error: sErr } = await service.storage.from("attachments").createSignedUrl(a.storage_path, 60 * 10);
      attachments.push({
        id: a.id,
        type: a.type,
        storage_path: a.storage_path,
        created_at: a.created_at,
        url: sErr ? null : signed.signedUrl
      });
    }
    return reply.send({ attachments });
  });
  app2.post("/", async (req, reply) => {
    const ctx = requireAnyAuthed(req);
    const body = SaleCreateSchema.parse(req.body ?? {});
    const service = createServiceClient();
    let rep_id = null;
    if (ctx.role === "rep") rep_id = await getRepIdForProfile4(service, ctx.org_id, ctx.profile_id);
    else rep_id = req.body?.rep_id || null;
    if (!rep_id) return reply.code(400).send({ error: "rep_id required" });
    const { data, error } = await service.from("sales").insert({
      org_id: ctx.org_id,
      rep_id,
      property_id: body.property_id,
      status: body.status,
      price: body.price ?? null,
      service_type: body.service_type ?? null,
      notes: body.notes ?? null,
      customer_name: body.customer_name ?? null,
      customer_phone: body.customer_phone ?? null,
      customer_email: body.customer_email ?? null
    }).select("*").single();
    if (error) return reply.code(400).send({ error: error.message });
    await audit(ctx.org_id, ctx.profile_id, "sale.created", { type: "sale", id: data.id }, { status: data.status, rep_id });
    await capture(PosthogEvents6.SALE_CREATED, ctx.profile_id, { org_id: ctx.org_id, role: ctx.role, sale_id: data.id, rep_id });
    return reply.send({ sale: data });
  });
  app2.put("/:id", async (req, reply) => {
    const ctx = requireAnyAuthed(req);
    const { id } = req.params;
    const body = SaleCreateSchema.partial().parse(req.body ?? {});
    const service = createServiceClient();
    if (ctx.role === "rep") {
      const access = await assertSaleAccess(service, ctx, id);
      if (!access.ok) return reply.code(403).send({ error: access.error });
    }
    if (ctx.role === "labor") return reply.code(403).send({ error: "Forbidden" });
    const { data: before } = await service.from("sales").select("id,status,price,service_type,notes,customer_name,customer_phone,customer_email").eq("id", id).eq("org_id", ctx.org_id).maybeSingle();
    if (!before) return reply.code(404).send({ error: "Not found" });
    const updates = {};
    for (const k of ["status", "price", "service_type", "notes", "customer_name", "customer_phone", "customer_email"]) {
      if (body[k] !== void 0) updates[k] = body[k];
    }
    const { data, error } = await service.from("sales").update(updates).eq("id", id).eq("org_id", ctx.org_id).select("*").single();
    if (error) return reply.code(400).send({ error: error.message });
    const changed = {};
    for (const [k, v] of Object.entries(updates)) {
      const prev = before[k];
      if (prev !== v) changed[k] = { from: prev ?? null, to: v ?? null };
    }
    if (changed.status) {
      await audit(ctx.org_id, ctx.profile_id, "sale.status.changed", { type: "sale", id }, { from: changed.status.from, to: changed.status.to });
    }
    await audit(ctx.org_id, ctx.profile_id, "sale.updated", { type: "sale", id }, { changed });
    return reply.send({ sale: data });
  });
  app2.delete("/:id", async (req, reply) => {
    const ctx = requireAnyAuthed(req);
    const { id } = req.params;
    const service = createServiceClient();
    if (ctx.role === "rep") {
      const access = await assertSaleAccess(service, ctx, id);
      if (!access.ok) return reply.code(403).send({ error: access.error });
    }
    if (ctx.role === "labor") return reply.code(403).send({ error: "Forbidden" });
    const { data: sale } = await service.from("sales").select("id").eq("id", id).eq("org_id", ctx.org_id).maybeSingle();
    if (!sale) return reply.code(404).send({ error: "Not found" });
    await service.from("sale_attachments").delete().eq("org_id", ctx.org_id).eq("sale_id", id);
    await service.from("contracts").delete().eq("org_id", ctx.org_id).eq("sale_id", id);
    await service.from("jobs").delete().eq("org_id", ctx.org_id).eq("sale_id", id);
    const { error } = await service.from("sales").delete().eq("id", id).eq("org_id", ctx.org_id);
    if (error) return reply.code(400).send({ error: error.message });
    await audit(ctx.org_id, ctx.profile_id, "sale.deleted", { type: "sale", id }, {});
    return reply.send({ ok: true });
  });
  app2.post("/:id/attachments", async (req, reply) => {
    const ctx = requireAnyAuthed(req);
    const { id } = req.params;
    const body = req.body || {};
    const type = String(body.type || "photo");
    const filename = String(body.filename || "file.jpg");
    const service = createServiceClient();
    const access = await assertSaleAccess(service, ctx, id);
    if (!access.ok) return reply.code(403).send({ error: access.error });
    if (ctx.role === "labor") return reply.code(403).send({ error: "Forbidden" });
    const path = `${ctx.org_id}/sales/${id}/${Date.now()}_${filename}`;
    const { data, error } = await service.storage.from("attachments").createSignedUploadUrl(path);
    if (error) return reply.code(400).send({ error: error.message });
    const { data: row, error: iErr } = await service.from("sale_attachments").insert({
      org_id: ctx.org_id,
      sale_id: id,
      type,
      storage_path: path
    }).select("id,type,storage_path,created_at").single();
    if (iErr) return reply.code(400).send({ error: iErr.message });
    await audit(ctx.org_id, ctx.profile_id, "sale.attachment.created", { type: "sale", id }, { attachment_id: row.id, type });
    return reply.send({ upload: data, attachment: row });
  });
  app2.post("/:id/signature", async (req, reply) => {
    const ctx = requireAnyAuthed(req);
    const { id } = req.params;
    const body = req.body || {};
    const dataUrl = String(body.data_url || body.dataUrl || "");
    const signer_name = body.signer_name ? String(body.signer_name) : null;
    if (!dataUrl) return reply.code(400).send({ error: "data_url required" });
    const parsed = parseDataUrl(dataUrl);
    if (!parsed) return reply.code(400).send({ error: "Invalid data URL" });
    const service = createServiceClient();
    if (ctx.role === "rep") {
      const access = await assertSaleAccess(service, ctx, id);
      if (!access.ok) return reply.code(403).send({ error: access.error });
    } else {
      requireManager(req);
    }
    const buf = Buffer.from(parsed.b64, "base64");
    const ext = parsed.mime.includes("png") ? "png" : parsed.mime.includes("jpeg") ? "jpg" : "bin";
    const path = `${ctx.org_id}/sales/${id}/signature_${Date.now()}.${ext}`;
    const { error: upErr } = await service.storage.from("attachments").upload(path, buf, {
      contentType: parsed.mime,
      upsert: true
    });
    if (upErr) return reply.code(400).send({ error: upErr.message });
    await service.from("sale_attachments").insert({
      org_id: ctx.org_id,
      sale_id: id,
      type: "signature",
      storage_path: path
    });
    await audit(ctx.org_id, ctx.profile_id, "sale.signature.uploaded", { type: "sale", id }, { signer_name });
    await capture(PosthogEvents6.CONTRACT_SIGNED, ctx.profile_id, {
      org_id: ctx.org_id,
      role: ctx.role,
      sale_id: id
    });
    return reply.send({ ok: true, storage_path: path });
  });
}

// src/routes/contracts.ts
import { PosthogEvents as PosthogEvents7 } from "@blockd2d/shared";
async function getRepIdForProfile5(service, org_id, profile_id) {
  const { data } = await service.from("reps").select("id").eq("org_id", org_id).eq("profile_id", profile_id).single();
  return data?.id;
}
async function contractsRoutes(app2) {
  app2.post("/generate", async (req, reply) => {
    const ctx = requireAnyAuthed(req);
    const body = req.body || {};
    const sale_id = String(body.sale_id || "");
    if (!sale_id) return reply.code(400).send({ error: "sale_id required" });
    const service = createServiceClient();
    const { data: sale } = await service.from("sales").select("id,rep_id").eq("id", sale_id).eq("org_id", ctx.org_id).single();
    if (!sale) return reply.code(404).send({ error: "Sale not found" });
    if (ctx.role === "rep") {
      const repId = await getRepIdForProfile5(service, ctx.org_id, ctx.profile_id);
      if (!repId || sale.rep_id !== repId) return reply.code(403).send({ error: "Forbidden" });
    } else {
      requireManager(req);
    }
    await service.from("jobs_queue").insert({ org_id: ctx.org_id, type: "contract_generate", status: "queued", payload: { sale_id } });
    await audit(ctx.org_id, ctx.profile_id, "contract.generate.queued", { type: "sale", id: sale_id }, {});
    await capture(PosthogEvents7.CONTRACT_GENERATED, ctx.profile_id, { org_id: ctx.org_id, role: ctx.role, sale_id });
    return reply.send({ ok: true });
  });
  app2.get("/by-sale/:saleId", async (req, reply) => {
    const ctx = requireAnyAuthed(req);
    const { saleId } = req.params;
    const service = createServiceClient();
    const { data: contract } = await service.from("contracts").select("*").eq("sale_id", saleId).eq("org_id", ctx.org_id).single();
    if (!contract) return reply.code(404).send({ error: "Not found" });
    if (ctx.role === "rep") {
      const repId = await getRepIdForProfile5(service, ctx.org_id, ctx.profile_id);
      const { data: sale } = await service.from("sales").select("rep_id").eq("id", saleId).eq("org_id", ctx.org_id).single();
      if (!sale || sale.rep_id !== repId) return reply.code(403).send({ error: "Forbidden" });
    }
    const { data, error } = await service.storage.from("contracts").createSignedUrl(contract.pdf_path, 60 * 10);
    if (error) return reply.code(400).send({ error: error.message });
    return reply.send({ url: data.signedUrl, contract });
  });
}

// src/routes/followups.ts
import { FollowupCreateSchema } from "@blockd2d/shared";
async function getRepIdForProfile6(service, org_id, profile_id) {
  const { data } = await service.from("reps").select("id").eq("org_id", org_id).eq("profile_id", profile_id).single();
  return data?.id;
}
async function followupsRoutes(app2) {
  app2.get("/", async (req, reply) => {
    const ctx = requireAnyAuthed(req);
    const q = req.query;
    const status = q.status ? String(q.status) : "open";
    const limit = Math.min(200, Math.max(10, Number(q.limit || 100)));
    const service = createServiceClient();
    let query = service.from("followups").select("*").eq("org_id", ctx.org_id).eq("status", status).order("due_at", { ascending: true }).limit(limit);
    if (ctx.role === "rep") {
      const repId = await getRepIdForProfile6(service, ctx.org_id, ctx.profile_id);
      if (!repId) return reply.code(403).send({ error: "Rep not provisioned" });
      query = query.eq("rep_id", repId);
    }
    const { data, error } = await query;
    if (error) return reply.code(400).send({ error: error.message });
    return reply.send({ followups: data });
  });
  app2.post("/", async (req, reply) => {
    const ctx = requireAnyAuthed(req);
    const body = FollowupCreateSchema.parse(req.body ?? {});
    const service = createServiceClient();
    let rep_id = null;
    if (ctx.role === "rep") rep_id = await getRepIdForProfile6(service, ctx.org_id, ctx.profile_id);
    else rep_id = req.body?.rep_id || null;
    if (!rep_id) return reply.code(400).send({ error: "rep_id required" });
    const { data, error } = await service.from("followups").insert({ org_id: ctx.org_id, rep_id, property_id: body.property_id, due_at: body.due_at, notes: body.notes ?? null }).select("*").single();
    if (error) return reply.code(400).send({ error: error.message });
    await audit(ctx.org_id, ctx.profile_id, "followup.created", { type: "followup", id: data.id }, {});
    return reply.send({ followup: data });
  });
  app2.put("/:id", async (req, reply) => {
    const ctx = requireAnyAuthed(req);
    const { id } = req.params;
    const body = req.body || {};
    const service = createServiceClient();
    if (ctx.role === "rep") {
      const repId = await getRepIdForProfile6(service, ctx.org_id, ctx.profile_id);
      const { data: f } = await service.from("followups").select("id, rep_id").eq("id", id).eq("org_id", ctx.org_id).single();
      if (!f || f.rep_id !== repId) return reply.code(403).send({ error: "Forbidden" });
    }
    const { data, error } = await service.from("followups").update({ due_at: body.due_at, status: body.status, notes: body.notes }).eq("id", id).eq("org_id", ctx.org_id).select("*").single();
    if (error) return reply.code(400).send({ error: error.message });
    await audit(ctx.org_id, ctx.profile_id, "followup.updated", { type: "followup", id }, {});
    return reply.send({ followup: data });
  });
}

// src/routes/messages.ts
import { z as z3 } from "zod";
var SendSchema = z3.object({
  thread_id: z3.string().uuid().optional(),
  to: z3.string().min(5).optional(),
  // E.164 preferred
  body: z3.string().min(1).max(2e3),
  rep_id: z3.string().uuid().optional(),
  property_id: z3.string().uuid().optional(),
  intervene: z3.boolean().optional()
});
var ThreadQuerySchema = z3.object({
  q: z3.string().optional(),
  status: z3.string().optional(),
  rep_id: z3.string().uuid().optional(),
  county_id: z3.string().uuid().optional(),
  property_id: z3.string().uuid().optional(),
  limit: z3.coerce.number().min(1).max(200).default(50)
});
async function repForProfile(service, org_id, profile_id) {
  const { data } = await service.from("reps").select("id,name").eq("org_id", org_id).eq("profile_id", profile_id).single();
  return data || null;
}
function sanitizePreview(body) {
  return (body || "").replace(/\s+/g, " ").trim().slice(0, 160);
}
function featureInterveneEnabled() {
  return String(process.env.FEATURE_MESSAGES_INTERVENE || "false") === "true";
}
function twimlOk() {
  return '<?xml version="1.0" encoding="UTF-8"?><Response></Response>';
}
async function messagesRoutes(app2) {
  app2.get("/threads", async (req, reply) => {
    const ctx = requireAnyAuthed(req);
    const service = createServiceClient();
    const q = ThreadQuerySchema.parse(req.query || {});
    let query = service.from("message_threads").select("id,org_id,customer_phone,rep_id,property_id,status,last_message_at,last_message_preview,created_at").eq("org_id", ctx.org_id).order("last_message_at", { ascending: false }).limit(q.limit);
    if (q.status) query = query.eq("status", q.status);
    if (q.property_id) query = query.eq("property_id", q.property_id);
    if (ctx.role === "rep") {
      const rep = await repForProfile(service, ctx.org_id, ctx.profile_id);
      if (!rep) return reply.send({ items: [], threads: [] });
      query = query.eq("rep_id", rep.id);
    } else {
      if (q.rep_id) query = query.eq("rep_id", q.rep_id);
    }
    const { data: threads, error } = await query;
    if (error) return reply.code(400).send({ error: error.message });
    const threadRows = threads || [];
    const repIds = Array.from(new Set(threadRows.map((t) => t.rep_id).filter(Boolean)));
    const propIds = Array.from(new Set(threadRows.map((t) => t.property_id).filter(Boolean)));
    const repsPromise = repIds.length ? service.from("reps").select("id,name").eq("org_id", ctx.org_id).in("id", repIds) : Promise.resolve({ data: [] });
    const propsPromise = propIds.length ? service.from("properties").select("id,address1,city,state,zip,county_id").eq("org_id", ctx.org_id).in("id", propIds) : Promise.resolve({ data: [] });
    const [{ data: repsData }, { data: propsData }] = await Promise.all([repsPromise, propsPromise]);
    const reps = repsData || [];
    const props = propsData || [];
    const repById = new Map(reps.map((r) => [r.id, r.name]));
    const propById = new Map(props.map((p) => [p.id, p]));
    const countyIds = Array.from(new Set(props.map((p) => p.county_id).filter(Boolean)));
    const { data: countiesData } = countyIds.length ? await service.from("counties").select("id,name,state").eq("org_id", ctx.org_id).in("id", countyIds) : { data: [] };
    const counties = countiesData || [];
    const countyById = new Map(counties.map((c) => [c.id, `${c.name}, ${c.state}`]));
    let items = threadRows.map((t) => {
      const prop = t.property_id ? propById.get(t.property_id) : void 0;
      const countyName = prop?.county_id ? countyById.get(prop.county_id) : null;
      const propAddr = prop ? `${prop.address1 ?? ""}${prop.city ? `, ${prop.city}` : ""}${prop.state ? `, ${prop.state}` : ""}${prop.zip ? ` ${prop.zip}` : ""}` : null;
      return {
        id: t.id,
        customer_phone: t.customer_phone,
        status: t.status,
        rep_id: t.rep_id,
        rep_name: t.rep_id ? repById.get(t.rep_id) ?? null : null,
        property_id: t.property_id,
        property_address: propAddr,
        county_id: prop?.county_id ?? null,
        county_name: countyName ?? null,
        last_message_at: t.last_message_at,
        last_message_preview: t.last_message_preview,
        created_at: t.created_at
      };
    });
    if (q.county_id) items = items.filter((i) => i.county_id === q.county_id);
    if (q.q) {
      const needle = q.q.toLowerCase();
      items = items.filter(
        (i) => (i.customer_phone || "").toLowerCase().includes(needle) || (i.property_address || "").toLowerCase().includes(needle) || (i.last_message_preview || "").toLowerCase().includes(needle) || (i.rep_name || "").toLowerCase().includes(needle)
      );
    }
    return reply.send({ items, threads: items });
  });
  app2.get("/threads/:id/messages", async (req, reply) => {
    const ctx = requireAnyAuthed(req);
    const { id } = req.params;
    const limit = Math.min(200, Math.max(1, Number(req.query?.limit || 200)));
    const service = createServiceClient();
    if (ctx.role === "rep") {
      const rep = await repForProfile(service, ctx.org_id, ctx.profile_id);
      if (!rep) return reply.code(404).send({ error: "Thread not found" });
      const { data: thread } = await service.from("message_threads").select("id,rep_id").eq("org_id", ctx.org_id).eq("id", id).single();
      const threadRow = thread;
      if (!threadRow || threadRow.rep_id !== rep.id) return reply.code(404).send({ error: "Thread not found" });
    }
    const { data, error } = await service.from("messages").select("id,thread_id,direction,body,sent_at,from_phone,to_phone,sent_by_rep_id,sent_by_profile_id,twilio_sid,status,created_at").eq("org_id", ctx.org_id).eq("thread_id", id).order("sent_at", { ascending: true }).order("created_at", { ascending: true }).limit(limit);
    if (error) return reply.code(400).send({ error: error.message });
    return reply.send({ items: data || [], messages: data || [] });
  });
  app2.get("/threads/:id", async (req, reply) => {
    const ctx = requireAnyAuthed(req);
    const { id } = req.params;
    const service = createServiceClient();
    const { data: thread } = await service.from("message_threads").select("*").eq("org_id", ctx.org_id).eq("id", id).single();
    if (!thread) return reply.code(404).send({ error: "Thread not found" });
    if (ctx.role === "rep") {
      const rep = await repForProfile(service, ctx.org_id, ctx.profile_id);
      if (!rep || thread.rep_id !== rep.id) return reply.code(404).send({ error: "Thread not found" });
    }
    const { data: messages } = await service.from("messages").select("id,thread_id,direction,body,sent_at,from_phone,to_phone,sent_by_rep_id,sent_by_profile_id,twilio_sid,status,created_at").eq("org_id", ctx.org_id).eq("thread_id", id).order("sent_at", { ascending: true }).order("created_at", { ascending: true }).limit(200);
    return reply.send({ thread, messages: messages || [] });
  });
  app2.post("/send", async (req, reply) => {
    const ctx = requireAnyAuthed(req);
    if (ctx.role !== "rep") {
      if (!featureInterveneEnabled()) {
        return reply.code(403).send({ error: "Manager sending disabled (FEATURE_MESSAGES_INTERVENE=false)" });
      }
      if (ctx.role !== "admin" && ctx.role !== "manager") return reply.code(403).send({ error: "Forbidden" });
    }
    const body = SendSchema.parse(req.body ?? {});
    const service = createServiceClient();
    const senderRep = ctx.role === "rep" ? await repForProfile(service, ctx.org_id, ctx.profile_id) : null;
    let thread = null;
    if (body.thread_id) {
      const { data } = await service.from("message_threads").select("id,customer_phone,rep_id,property_id,status").eq("org_id", ctx.org_id).eq("id", body.thread_id).single();
      thread = data;
      if (!thread) return reply.code(404).send({ error: "Thread not found" });
      if (ctx.role === "rep") {
        if (!senderRep || thread.rep_id !== senderRep.id) return reply.code(403).send({ error: "Not allowed" });
      }
    } else {
      if (!body.to) return reply.code(400).send({ error: "to or thread_id is required" });
      let repId = body.rep_id || null;
      if (ctx.role === "rep") repId = senderRep?.id || null;
      const now = (/* @__PURE__ */ new Date()).toISOString();
      const { data, error } = await service.from("message_threads").upsert(
        {
          org_id: ctx.org_id,
          customer_phone: body.to,
          rep_id: repId,
          property_id: body.property_id || null,
          status: "open",
          last_message_at: now,
          last_message_preview: sanitizePreview(body.body)
        },
        { onConflict: "org_id,customer_phone" }
      ).select("*").single();
      if (error) return reply.code(400).send({ error: error.message });
      thread = data;
    }
    const { data: settings } = await service.from("org_settings").select("twilio_number").eq("org_id", ctx.org_id).maybeSingle();
    const fromNumber = settings?.twilio_number || env.TWILIO_NUMBER || null;
    const sentAt = (/* @__PURE__ */ new Date()).toISOString();
    const { data: msg, error: msgErr } = await service.from("messages").insert({
      org_id: ctx.org_id,
      thread_id: thread.id,
      direction: "outbound",
      body: body.body,
      sent_at: sentAt,
      status: "queued",
      from_phone: fromNumber,
      to_phone: thread.customer_phone,
      sent_by_profile_id: ctx.profile_id,
      sent_by_rep_id: senderRep?.id || null
    }).select("*").single();
    if (msgErr) return reply.code(400).send({ error: msgErr.message });
    await service.from("message_threads").update({ last_message_at: sentAt, last_message_preview: sanitizePreview(body.body) }).eq("org_id", ctx.org_id).eq("id", thread.id);
    await audit(ctx.org_id, ctx.profile_id, "message.sent", { type: "message_thread", id: thread.id }, { direction: "outbound" });
    await service.from("jobs_queue").insert({
      org_id: ctx.org_id,
      type: "twilio_send_sms",
      status: "queued",
      payload: { thread_id: thread.id, message_id: msg.id }
    });
    return reply.send({ ok: true, thread_id: thread.id, message: msg });
  });
  app2.post("/threads/:id/reassign", async (req, reply) => {
    const ctx = requireManager(req);
    const { id } = req.params;
    const body = z3.object({ rep_id: z3.string().uuid().nullable() }).parse(req.body ?? {});
    const service = createServiceClient();
    const { data, error } = await service.from("message_threads").update({ rep_id: body.rep_id }).eq("org_id", ctx.org_id).eq("id", id).select("*").single();
    if (error) return reply.code(400).send({ error: error.message });
    await audit(ctx.org_id, ctx.profile_id, "thread.reassigned", { type: "message_thread", id }, { rep_id: body.rep_id });
    return reply.send({ thread: data });
  });
  app2.post("/threads/:id/status", async (req, reply) => {
    const ctx = requireManager(req);
    const { id } = req.params;
    const body = z3.object({ status: z3.string().min(1) }).parse(req.body ?? {});
    const service = createServiceClient();
    const { data, error } = await service.from("message_threads").update({ status: body.status }).eq("org_id", ctx.org_id).eq("id", id).select("*").single();
    if (error) return reply.code(400).send({ error: error.message });
    await audit(ctx.org_id, ctx.profile_id, "thread.status", { type: "message_thread", id }, { status: body.status });
    return reply.send({ thread: data });
  });
  app2.post("/threads/:id/resolve", async (req, reply) => {
    const ctx = requireManager(req);
    const { id } = req.params;
    const service = createServiceClient();
    const { data, error } = await service.from("message_threads").update({ status: "resolved" }).eq("org_id", ctx.org_id).eq("id", id).select("*").single();
    if (error) return reply.code(400).send({ error: error.message });
    await audit(ctx.org_id, ctx.profile_id, "thread.resolved", { type: "message_thread", id }, {});
    return reply.send({ thread: data });
  });
  app2.post("/threads/:id/dnk", async (req, reply) => {
    const ctx = requireManager(req);
    const { id } = req.params;
    const service = createServiceClient();
    const { data: thread, error: tErr } = await service.from("message_threads").select("id, property_id").eq("org_id", ctx.org_id).eq("id", id).single();
    const threadRow = thread;
    if (tErr || !threadRow) return reply.code(404).send({ error: "Thread not found" });
    const { data, error } = await service.from("message_threads").update({ status: "dnk" }).eq("org_id", ctx.org_id).eq("id", id).select("*").single();
    if (error) return reply.code(400).send({ error: error.message });
    if (threadRow.property_id) {
      const { data: prop } = await service.from("properties").select("id,tags").eq("org_id", ctx.org_id).eq("id", threadRow.property_id).maybeSingle();
      const propRow = prop;
      if (propRow) {
        const tags = { ...propRow.tags || {}, dnk: true };
        await service.from("properties").update({ tags }).eq("org_id", ctx.org_id).eq("id", threadRow.property_id);
      }
    }
    await audit(ctx.org_id, ctx.profile_id, "thread.dnk", { type: "message_thread", id }, {});
    return reply.send({ thread: data });
  });
  app2.post("/twilio/inbound", async (req, reply) => {
    const From = String(req.body?.From || "").trim();
    const To = String(req.body?.To || "").trim();
    const Body = String(req.body?.Body || "").trim();
    const MessageSid = String(req.body?.MessageSid || "").trim();
    if (!From || !To || !Body) {
      return reply.type("text/xml").send(twimlOk());
    }
    const service = createServiceClient();
    const { data: orgRow } = await service.from("org_settings").select("org_id,twilio_number").eq("twilio_number", To).maybeSingle();
    const org_id = orgRow?.org_id;
    if (!org_id) {
      return reply.type("text/xml").send(twimlOk());
    }
    const now = (/* @__PURE__ */ new Date()).toISOString();
    const { data: thread, error: tErr } = await service.from("message_threads").upsert(
      {
        org_id,
        customer_phone: From,
        status: "open",
        last_message_at: now,
        last_message_preview: sanitizePreview(Body)
      },
      { onConflict: "org_id,customer_phone" }
    ).select("*").single();
    if (tErr || !thread) return reply.type("text/xml").send(twimlOk());
    await service.from("messages").insert({
      org_id,
      thread_id: thread.id,
      direction: "inbound",
      body: Body,
      twilio_sid: MessageSid || null,
      sent_at: now,
      status: "received",
      from_phone: From,
      to_phone: To
    });
    await service.from("message_threads").update({ last_message_at: now, last_message_preview: sanitizePreview(Body) }).eq("org_id", org_id).eq("id", thread.id);
    return reply.type("text/xml").send(twimlOk());
  });
}

// src/routes/labor.ts
import { PosthogEvents as PosthogEvents8 } from "@blockd2d/shared";
async function getLaborerIdForProfile(service, org_id, profile_id) {
  const { data } = await service.from("laborers").select("id").eq("org_id", org_id).eq("profile_id", profile_id).single();
  return data?.id;
}
async function laborRoutes(app2) {
  app2.get("/me", async (req, reply) => {
    const ctx = requireAnyAuthed(req);
    if (ctx.role !== "labor" && ctx.role !== "admin" && ctx.role !== "manager") return reply.code(403).send({ error: "Forbidden" });
    const service = createServiceClient();
    const laborer_id = await getLaborerIdForProfile(service, ctx.org_id, ctx.profile_id);
    if (!laborer_id) return reply.send({ laborer: null });
    const { data } = await service.from("laborers").select("*").eq("id", laborer_id).eq("org_id", ctx.org_id).single();
    return reply.send({ laborer: data });
  });
  app2.get("/jobs", async (req, reply) => {
    const ctx = requireAnyAuthed(req);
    const service = createServiceClient();
    if (ctx.role === "labor") {
      const laborer_id = await getLaborerIdForProfile(service, ctx.org_id, ctx.profile_id);
      if (!laborer_id) return reply.code(403).send({ error: "Laborer not provisioned" });
      const { data: data2, error: error2 } = await service.from("jobs").select("*").eq("org_id", ctx.org_id).eq("laborer_id", laborer_id).order("scheduled_start", { ascending: true }).limit(50);
      if (error2) return reply.code(400).send({ error: error2.message });
      return reply.send({ jobs: data2 });
    }
    requireManager(req);
    const { data, error } = await service.from("jobs").select("*").eq("org_id", ctx.org_id).order("created_at", { ascending: false }).limit(200);
    if (error) return reply.code(400).send({ error: error.message });
    return reply.send({ jobs: data });
  });
  app2.get("/availability", async (req, reply) => {
    const ctx = requireAnyAuthed(req);
    const service = createServiceClient();
    let laborer_id = null;
    if (ctx.role === "labor") {
      laborer_id = await getLaborerIdForProfile(service, ctx.org_id, ctx.profile_id);
      if (!laborer_id) return reply.code(403).send({ error: "Laborer not provisioned" });
    } else {
      requireManager(req);
      laborer_id = String(req.query?.laborer_id || "");
      if (!laborer_id) return reply.code(400).send({ error: "laborer_id required" });
    }
    const { data, error } = await service.from("labor_availability").select("*").eq("org_id", ctx.org_id).eq("laborer_id", laborer_id).order("day_of_week");
    if (error) return reply.code(400).send({ error: error.message });
    return reply.send({ laborer_id, availability: data || [] });
  });
  app2.put("/availability", async (req, reply) => {
    const ctx = requireAnyAuthed(req);
    const service = createServiceClient();
    if (ctx.role !== "labor") return reply.code(403).send({ error: "Forbidden" });
    const laborer_id = await getLaborerIdForProfile(service, ctx.org_id, ctx.profile_id);
    if (!laborer_id) return reply.code(403).send({ error: "Laborer not provisioned" });
    const blocks = Array.isArray(req.body?.blocks) ? req.body.blocks : [];
    await service.from("labor_availability").delete().eq("org_id", ctx.org_id).eq("laborer_id", laborer_id);
    if (blocks.length > 0) {
      const rows = blocks.map((b) => ({
        org_id: ctx.org_id,
        laborer_id,
        day_of_week: Number(b.day_of_week),
        start_time: String(b.start_time),
        end_time: String(b.end_time),
        timezone: String(b.timezone || "America/Indiana/Indianapolis")
      }));
      const { error } = await service.from("labor_availability").insert(rows);
      if (error) return reply.code(400).send({ error: error.message });
    }
    await audit(ctx.org_id, ctx.profile_id, "labor.availability_updated", { type: "laborer", id: laborer_id }, { count: blocks.length });
    return reply.send({ ok: true });
  });
  app2.get("/time-off", async (req, reply) => {
    const ctx = requireAnyAuthed(req);
    const service = createServiceClient();
    let laborer_id = null;
    if (ctx.role === "labor") {
      laborer_id = await getLaborerIdForProfile(service, ctx.org_id, ctx.profile_id);
      if (!laborer_id) return reply.code(403).send({ error: "Laborer not provisioned" });
    } else {
      requireManager(req);
      laborer_id = String(req.query?.laborer_id || "");
      if (!laborer_id) return reply.code(400).send({ error: "laborer_id required" });
    }
    const { data, error } = await service.from("labor_time_off").select("*").eq("org_id", ctx.org_id).eq("laborer_id", laborer_id).order("start_at", { ascending: false }).limit(200);
    if (error) return reply.code(400).send({ error: error.message });
    return reply.send({ laborer_id, time_off: data || [] });
  });
  app2.post("/time-off", async (req, reply) => {
    const ctx = requireAnyAuthed(req);
    const service = createServiceClient();
    if (ctx.role !== "labor") return reply.code(403).send({ error: "Forbidden" });
    const laborer_id = await getLaborerIdForProfile(service, ctx.org_id, ctx.profile_id);
    if (!laborer_id) return reply.code(403).send({ error: "Laborer not provisioned" });
    const body = req.body || {};
    const start_at = String(body.start_at || "");
    const end_at = String(body.end_at || "");
    const reason = body.reason ? String(body.reason) : null;
    if (!start_at || !end_at) return reply.code(400).send({ error: "start_at and end_at required" });
    const { data, error } = await service.from("labor_time_off").insert({ org_id: ctx.org_id, laborer_id, start_at, end_at, reason }).select("*").single();
    if (error) return reply.code(400).send({ error: error.message });
    await audit(ctx.org_id, ctx.profile_id, "labor.timeoff_created", { type: "time_off", id: data.id }, {});
    return reply.send({ time_off: data });
  });
  app2.delete("/time-off/:id", async (req, reply) => {
    const ctx = requireAnyAuthed(req);
    const service = createServiceClient();
    if (ctx.role !== "labor") return reply.code(403).send({ error: "Forbidden" });
    const laborer_id = await getLaborerIdForProfile(service, ctx.org_id, ctx.profile_id);
    if (!laborer_id) return reply.code(403).send({ error: "Laborer not provisioned" });
    const { id } = req.params;
    const { error } = await service.from("labor_time_off").delete().eq("org_id", ctx.org_id).eq("laborer_id", laborer_id).eq("id", id);
    if (error) return reply.code(400).send({ error: error.message });
    await audit(ctx.org_id, ctx.profile_id, "labor.timeoff_deleted", { type: "time_off", id }, {});
    return reply.send({ ok: true });
  });
  app2.post("/jobs/:id/start", async (req, reply) => {
    const ctx = requireAnyAuthed(req);
    const { id } = req.params;
    const service = createServiceClient();
    if (ctx.role === "labor") {
      const laborer_id = await getLaborerIdForProfile(service, ctx.org_id, ctx.profile_id);
      const { data: job } = await service.from("jobs").select("*").eq("id", id).eq("org_id", ctx.org_id).single();
      if (!job || job.laborer_id !== laborer_id) return reply.code(403).send({ error: "Forbidden" });
    } else requireManager(req);
    const { data, error } = await service.from("jobs").update({ status: "in_progress", started_at: (/* @__PURE__ */ new Date()).toISOString() }).eq("id", id).eq("org_id", ctx.org_id).select("*").single();
    if (error) return reply.code(400).send({ error: error.message });
    await audit(ctx.org_id, ctx.profile_id, "job.started", { type: "job", id }, {});
    await capture(PosthogEvents8.JOB_STARTED, ctx.profile_id, { org_id: ctx.org_id, role: ctx.role, job_id: id });
    return reply.send({ job: data });
  });
  app2.post("/jobs/:id/complete", async (req, reply) => {
    const ctx = requireAnyAuthed(req);
    const { id } = req.params;
    const service = createServiceClient();
    if (ctx.role === "labor") {
      const laborer_id = await getLaborerIdForProfile(service, ctx.org_id, ctx.profile_id);
      const { data: job } = await service.from("jobs").select("*").eq("id", id).eq("org_id", ctx.org_id).single();
      if (!job || job.laborer_id !== laborer_id) return reply.code(403).send({ error: "Forbidden" });
    } else requireManager(req);
    const { data, error } = await service.from("jobs").update({ status: "complete", completed_at: (/* @__PURE__ */ new Date()).toISOString() }).eq("id", id).eq("org_id", ctx.org_id).select("*").single();
    if (error) return reply.code(400).send({ error: error.message });
    await audit(ctx.org_id, ctx.profile_id, "job.completed", { type: "job", id }, {});
    await capture(PosthogEvents8.JOB_COMPLETED, ctx.profile_id, { org_id: ctx.org_id, role: ctx.role, job_id: id });
    return reply.send({ job: data });
  });
  app2.post("/jobs/:id/photo", async (req, reply) => {
    const ctx = requireAnyAuthed(req);
    const { id } = req.params;
    const body = req.body || {};
    const filename = String(body.filename || "photo.jpg");
    const kind = String(body.kind || "before");
    const service = createServiceClient();
    if (ctx.role === "labor") {
      const laborer_id = await getLaborerIdForProfile(service, ctx.org_id, ctx.profile_id);
      const { data: job } = await service.from("jobs").select("id,laborer_id").eq("id", id).eq("org_id", ctx.org_id).single();
      if (!job || job.laborer_id !== laborer_id) return reply.code(403).send({ error: "Forbidden" });
    } else requireManager(req);
    const path = `${ctx.org_id}/jobs/${id}/${kind}/${Date.now()}_${filename}`;
    const { data, error } = await service.storage.from("job-photos").createSignedUploadUrl(path);
    if (error) return reply.code(400).send({ error: error.message });
    return reply.send({ upload: data, storage_path: path });
  });
  app2.get("/laborers", async (req, reply) => {
    const ctx = requireManager(req);
    const service = createServiceClient();
    const { data, error } = await service.from("laborers").select("*").eq("org_id", ctx.org_id).order("name");
    if (error) return reply.code(400).send({ error: error.message });
    return reply.send({ laborers: data });
  });
  app2.post("/laborers", async (req, reply) => {
    const ctx = requireManager(req);
    const body = req.body || {};
    const name = typeof body.name === "string" ? body.name.trim() : "";
    if (!name) return reply.code(400).send({ error: "name required" });
    const service = createServiceClient();
    const { data, error } = await service.from("laborers").insert({
      org_id: ctx.org_id,
      name,
      active: body.active !== false,
      profile_id: null
    }).select("*").single();
    if (error) return reply.code(400).send({ error: error.message });
    await audit(ctx.org_id, ctx.profile_id, "laborer.created", { type: "laborer", id: data.id }, { name: data.name });
    return reply.send({ laborer: data });
  });
  app2.delete("/laborers/:id", async (req, reply) => {
    const ctx = requireManager(req);
    const { id } = req.params;
    const service = createServiceClient();
    const { error } = await service.from("laborers").delete().eq("id", id).eq("org_id", ctx.org_id);
    if (error) return reply.code(400).send({ error: error.message });
    await audit(ctx.org_id, ctx.profile_id, "laborer.deleted", { type: "laborer", id }, {});
    return reply.send({ ok: true });
  });
  app2.post("/jobs", async (req, reply) => {
    const ctx = requireManager(req);
    const body = req.body || {};
    const sale_id = String(body.sale_id || "");
    if (!sale_id) return reply.code(400).send({ error: "sale_id required" });
    const service = createServiceClient();
    const { data, error } = await service.from("jobs").insert({
      org_id: ctx.org_id,
      sale_id,
      laborer_id: body.laborer_id ?? null,
      scheduled_start: body.scheduled_start ?? null,
      scheduled_end: body.scheduled_end ?? null,
      status: "scheduled"
    }).select("*").single();
    if (error) return reply.code(400).send({ error: error.message });
    await audit(ctx.org_id, ctx.profile_id, "job.created", { type: "job", id: data.id }, { sale_id });
    return reply.send({ job: data });
  });
}

// src/routes/jobs.ts
import { PosthogEvents as PosthogEvents9 } from "@blockd2d/shared";
function parseDataUrl2(dataUrl) {
  const m = /^data:([^;]+);base64,(.+)$/i.exec(dataUrl || "");
  if (!m) return null;
  return { mime: m[1], b64: m[2] };
}
async function getLaborerIdForProfile2(service, org_id, profile_id) {
  const { data } = await service.from("laborers").select("id").eq("org_id", org_id).eq("profile_id", profile_id).single();
  return data?.id;
}
async function jobsRoutes(app2) {
  app2.get("/", async (req, reply) => {
    const ctx = requireAnyAuthed(req);
    const service = createServiceClient();
    if (ctx.role === "labor") {
      const laborer_id = await getLaborerIdForProfile2(service, ctx.org_id, ctx.profile_id);
      if (!laborer_id) return reply.code(403).send({ error: "Laborer not provisioned" });
      const { data: data2, error: error2 } = await service.from("jobs").select("*").eq("org_id", ctx.org_id).eq("laborer_id", laborer_id).order("scheduled_start", { ascending: true }).limit(50);
      if (error2) return reply.code(400).send({ error: error2.message });
      return reply.send({ jobs: data2 });
    }
    requireManager(req);
    const { data, error } = await service.from("jobs").select("*").eq("org_id", ctx.org_id).order("created_at", { ascending: false }).limit(200);
    if (error) return reply.code(400).send({ error: error.message });
    return reply.send({ jobs: data });
  });
  app2.get("/:id", async (req, reply) => {
    const ctx = requireAnyAuthed(req);
    const { id } = req.params;
    const service = createServiceClient();
    const { data: job, error } = await service.from("jobs").select("*").eq("id", id).eq("org_id", ctx.org_id).single();
    if (error) return reply.code(400).send({ error: error.message });
    if (!job) return reply.code(404).send({ error: "Not found" });
    if (ctx.role === "labor") {
      const laborer_id = await getLaborerIdForProfile2(service, ctx.org_id, ctx.profile_id);
      if (!laborer_id || job.laborer_id !== laborer_id) return reply.code(403).send({ error: "Forbidden" });
    } else {
      requireManager(req);
    }
    const { data: sale } = await service.from("sales").select("id, rep_id, property_id, status, value, customer_phone, notes, created_at").eq("id", job.sale_id).eq("org_id", ctx.org_id).single();
    let property = null;
    if (sale?.property_id) {
      const { data: p } = await service.from("properties").select("id, county_id, address1, city, state, zip, lat, lng, value_estimate").eq("id", sale.property_id).eq("org_id", ctx.org_id).single();
      property = p || null;
    }
    let rep = null;
    if (sale?.rep_id) {
      const { data: r } = await service.from("reps").select("id, name").eq("id", sale.rep_id).eq("org_id", ctx.org_id).single();
      rep = r || null;
    }
    const attachments = [];
    if (sale?.id) {
      const { data: rows } = await service.from("sale_attachments").select("id, type, storage_path, created_at").eq("org_id", ctx.org_id).eq("sale_id", sale.id).order("created_at", { ascending: false }).limit(200);
      for (const a of rows || []) {
        let signed_url = null;
        try {
          const { data: s } = await service.storage.from("attachments").createSignedUrl(a.storage_path, 60 * 30);
          signed_url = s?.signedUrl || null;
        } catch {
          signed_url = null;
        }
        attachments.push({ ...a, signed_url });
      }
    }
    const { data: jobPhotoRows } = await service.from("job_photos").select("id, kind, storage_path, created_at").eq("org_id", ctx.org_id).eq("job_id", id).order("created_at", { ascending: false }).limit(200);
    const job_photos = [];
    for (const p of jobPhotoRows || []) {
      let signed_url = null;
      try {
        const { data: s } = await service.storage.from("job-photos").createSignedUrl(p.storage_path, 60 * 30);
        signed_url = s?.signedUrl || null;
      } catch {
        signed_url = null;
      }
      job_photos.push({ ...p, signed_url });
    }
    const { data: payments } = await service.from("payments").select("id, amount, currency, status, checkout_url, stripe_checkout_session_id, created_at").eq("org_id", ctx.org_id).eq("job_id", id).order("created_at", { ascending: false }).limit(50);
    let contract = null;
    if (sale?.id) {
      const { data: c } = await service.from("contracts").select("id, pdf_path, status, created_at").eq("org_id", ctx.org_id).eq("sale_id", sale.id).single();
      if (c?.pdf_path) {
        try {
          const { data: s } = await service.storage.from("contracts").createSignedUrl(c.pdf_path, 60 * 10);
          contract = { ...c, signed_url: s?.signedUrl || null };
        } catch {
          contract = { ...c, signed_url: null };
        }
      }
    }
    return reply.send({ job, sale, property, rep, contract, attachments, job_photos, payments: payments || [] });
  });
  app2.post("/", async (req, reply) => {
    const ctx = requireManager(req);
    const body = req.body || {};
    const sale_id = String(body.sale_id || "");
    if (!sale_id) return reply.code(400).send({ error: "sale_id required" });
    const service = createServiceClient();
    const { data, error } = await service.from("jobs").insert({
      org_id: ctx.org_id,
      sale_id,
      laborer_id: body.laborer_id ?? null,
      scheduled_start: body.scheduled_start ?? null,
      scheduled_end: body.scheduled_end ?? null,
      status: "scheduled"
    }).select("*").single();
    if (error) return reply.code(400).send({ error: error.message });
    await audit(ctx.org_id, ctx.profile_id, "job.created", { type: "job", id: data.id }, { sale_id });
    return reply.send({ job: data });
  });
  app2.post("/:id/start", async (req, reply) => {
    const ctx = requireAnyAuthed(req);
    const { id } = req.params;
    const service = createServiceClient();
    if (ctx.role === "labor") {
      const laborer_id = await getLaborerIdForProfile2(service, ctx.org_id, ctx.profile_id);
      const { data: job } = await service.from("jobs").select("*").eq("id", id).eq("org_id", ctx.org_id).single();
      if (!job || job.laborer_id !== laborer_id) return reply.code(403).send({ error: "Forbidden" });
    } else requireManager(req);
    const { data, error } = await service.from("jobs").update({ status: "in_progress", started_at: (/* @__PURE__ */ new Date()).toISOString() }).eq("id", id).eq("org_id", ctx.org_id).select("*").single();
    if (error) return reply.code(400).send({ error: error.message });
    await audit(ctx.org_id, ctx.profile_id, "job.started", { type: "job", id }, {});
    await capture(PosthogEvents9.JOB_STARTED, ctx.profile_id, { org_id: ctx.org_id, role: ctx.role, job_id: id });
    return reply.send({ job: data });
  });
  app2.post("/:id/complete", async (req, reply) => {
    const ctx = requireAnyAuthed(req);
    const { id } = req.params;
    const service = createServiceClient();
    if (ctx.role === "labor") {
      const laborer_id = await getLaborerIdForProfile2(service, ctx.org_id, ctx.profile_id);
      const { data: job } = await service.from("jobs").select("*").eq("id", id).eq("org_id", ctx.org_id).single();
      if (!job || job.laborer_id !== laborer_id) return reply.code(403).send({ error: "Forbidden" });
    } else requireManager(req);
    const body = req.body || {};
    const completion_notes = body.completion_notes ? String(body.completion_notes) : null;
    const upcharge_notes = body.upcharge_notes ? String(body.upcharge_notes) : null;
    const combinedNotes = completion_notes || upcharge_notes ? [completion_notes ? `Completion: ${completion_notes}` : null, upcharge_notes ? `Upcharge: ${upcharge_notes}` : null].filter(Boolean).join("\n") : null;
    const { data, error } = await service.from("jobs").update({ status: "complete", completed_at: (/* @__PURE__ */ new Date()).toISOString(), completion_notes: combinedNotes }).eq("id", id).eq("org_id", ctx.org_id).select("*").single();
    if (error) return reply.code(400).send({ error: error.message });
    await audit(ctx.org_id, ctx.profile_id, "job.completed", { type: "job", id }, {});
    await capture(PosthogEvents9.JOB_COMPLETED, ctx.profile_id, { org_id: ctx.org_id, role: ctx.role, job_id: id });
    return reply.send({ job: data });
  });
  app2.post("/:id/photos", async (req, reply) => {
    const ctx = requireAnyAuthed(req);
    const { id } = req.params;
    const body = req.body || {};
    const filename = String(body.filename || "photo.jpg");
    const kind = String(body.kind || "after");
    const dataUrl = body.data_url ? String(body.data_url) : body.dataUrl ? String(body.dataUrl) : "";
    const service = createServiceClient();
    if (ctx.role === "labor") {
      const laborer_id = await getLaborerIdForProfile2(service, ctx.org_id, ctx.profile_id);
      const { data: job } = await service.from("jobs").select("id,laborer_id").eq("id", id).eq("org_id", ctx.org_id).single();
      if (!job || job.laborer_id !== laborer_id) return reply.code(403).send({ error: "Forbidden" });
    } else requireManager(req);
    if (dataUrl) {
      const parsed = parseDataUrl2(dataUrl);
      if (!parsed) return reply.code(400).send({ error: "Invalid data URL" });
      const buf = Buffer.from(parsed.b64, "base64");
      const ext = parsed.mime.includes("png") ? "png" : parsed.mime.includes("jpeg") ? "jpg" : "bin";
      const path2 = `${ctx.org_id}/jobs/${id}/${kind}/${Date.now()}.${ext}`;
      const { error: upErr } = await service.storage.from("job-photos").upload(path2, buf, {
        contentType: parsed.mime,
        upsert: true
      });
      if (upErr) return reply.code(400).send({ error: upErr.message });
      await service.from("job_photos").insert({ org_id: ctx.org_id, job_id: id, kind, storage_path: path2 });
      await audit(ctx.org_id, ctx.profile_id, "job.photo.uploaded", { type: "job", id }, { kind });
      return reply.send({ ok: true, storage_path: path2 });
    }
    const path = `${ctx.org_id}/jobs/${id}/${kind}/${Date.now()}_${filename}`;
    const { data, error } = await service.storage.from("job-photos").createSignedUploadUrl(path);
    if (error) return reply.code(400).send({ error: error.message });
    await service.from("job_photos").insert({ org_id: ctx.org_id, job_id: id, kind, storage_path: path });
    await audit(ctx.org_id, ctx.profile_id, "job.photo.signed_url.created", { type: "job", id }, { kind });
    return reply.send({ upload: data, storage_path: path });
  });
  app2.get("/:id/photos", async (req, reply) => {
    const ctx = requireAnyAuthed(req);
    const { id } = req.params;
    const service = createServiceClient();
    if (ctx.role === "labor") {
      const laborer_id = await getLaborerIdForProfile2(service, ctx.org_id, ctx.profile_id);
      const { data: job } = await service.from("jobs").select("id,laborer_id").eq("id", id).eq("org_id", ctx.org_id).single();
      if (!job || job.laborer_id !== laborer_id) return reply.code(403).send({ error: "Forbidden" });
    } else requireManager(req);
    const { data, error } = await service.from("job_photos").select("id,kind,storage_path,created_at").eq("org_id", ctx.org_id).eq("job_id", id).order("created_at", { ascending: false }).limit(100);
    if (error) return reply.code(400).send({ error: error.message });
    const photos = [];
    for (const p of data || []) {
      let signed_url = null;
      try {
        const { data: s } = await service.storage.from("job-photos").createSignedUrl(p.storage_path, 60 * 30);
        signed_url = s?.signedUrl || null;
      } catch {
        signed_url = null;
      }
      photos.push({ ...p, signed_url });
    }
    return reply.send({ photos });
  });
}

// src/routes/payments.ts
import Stripe from "stripe";
import { PaymentCreateIntentSchema, PosthogEvents as PosthogEvents10 } from "@blockd2d/shared";
function stripeClient() {
  if (!env.STRIPE_SECRET_KEY) return null;
  return new Stripe(env.STRIPE_SECRET_KEY, { apiVersion: "2024-06-20" });
}
async function paymentsRoutes(app2) {
  const createCheckoutHandler = async (req, reply) => {
    const ctx = requireAnyAuthed(req);
    const body = PaymentCreateIntentSchema.parse(req.body ?? {});
    const service = createServiceClient();
    const { data: job } = await service.from("jobs").select("*").eq("id", body.job_id).eq("org_id", ctx.org_id).single();
    if (!job) return reply.code(404).send({ error: "Job not found" });
    if (ctx.role === "labor") {
      const { data: laborer } = await service.from("laborers").select("id").eq("profile_id", ctx.profile_id).eq("org_id", ctx.org_id).single();
      if (!laborer || job.laborer_id !== laborer.id) return reply.code(403).send({ error: "Forbidden" });
    } else {
      requireManager(req);
    }
    if (!stripeClient()) return reply.code(400).send({ error: "Stripe not configured" });
    const session = await stripeClient().checkout.sessions.create({
      mode: "payment",
      line_items: [
        {
          price_data: {
            currency: body.currency,
            unit_amount: body.amount,
            product_data: { name: "Service Payment" }
          },
          quantity: 1
        }
      ],
      success_url: `${env.PUBLIC_WEB_URL}/pay/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${env.PUBLIC_WEB_URL}/pay/cancel`,
      metadata: { org_id: ctx.org_id, job_id: body.job_id }
    });
    const { data: payment } = await service.from("payments").insert({
      org_id: ctx.org_id,
      job_id: body.job_id,
      amount: body.amount,
      currency: body.currency,
      status: "pending",
      stripe_checkout_session_id: session.id,
      checkout_url: session.url
    }).select("*").single();
    await audit(ctx.org_id, ctx.profile_id, "payment.link_created", { type: "payment", id: payment.id }, { job_id: body.job_id });
    await capture(PosthogEvents10.PAYMENT_LINK_CREATED, ctx.profile_id, { org_id: ctx.org_id, role: ctx.role, job_id: body.job_id, amount: body.amount });
    return reply.send({ payment, url: session.url });
  };
  app2.post("/create-checkout", createCheckoutHandler);
  app2.post("/create-intent", createCheckoutHandler);
  app2.post("/stripe/webhook", async (req, reply) => {
    if (!stripeClient() || !env.STRIPE_WEBHOOK_SECRET) return reply.code(400).send("stripe not configured");
    const sig = req.headers["stripe-signature"];
    if (!sig || typeof sig !== "string") return reply.code(400).send("missing signature");
    const raw = req.rawBody;
    const payload = raw ? raw : Buffer.from(JSON.stringify(req.body || {}));
    let event;
    try {
      event = stripeClient().webhooks.constructEvent(payload, sig, env.STRIPE_WEBHOOK_SECRET);
    } catch (err) {
      return reply.code(400).send(`Webhook Error: ${err.message}`);
    }
    const service = createServiceClient();
    if (event.type === "checkout.session.completed") {
      const session = event.data.object;
      const sessionId = session.id;
      await service.from("payments").update({ status: "paid" }).eq("stripe_checkout_session_id", sessionId);
    }
    return reply.send({ received: true });
  });
}

// src/routes/exports.ts
import { z as z4 } from "zod";
var CreateExportSchema = z4.object({
  type: z4.enum(["assignments", "sales"]).default("assignments"),
  // Optional scoping
  cluster_set_id: z4.string().uuid().optional(),
  format: z4.enum(["csv", "json"]).default("csv")
});
async function exportsRoutes(app2) {
  app2.get("/", async (req, reply) => {
    const ctx = requireManager(req);
    const service = createServiceClient();
    const { data, error } = await service.from("exports").select("*").eq("org_id", ctx.org_id).order("created_at", { ascending: false }).limit(50);
    if (error) return reply.code(400).send({ error: error.message });
    return reply.send({ items: data || [] });
  });
  app2.post("/", async (req, reply) => {
    const ctx = requireManager(req);
    const body = CreateExportSchema.parse(req.body ?? {});
    const service = createServiceClient();
    const { data: exp, error } = await service.from("exports").insert({
      org_id: ctx.org_id,
      type: body.type,
      status: "queued"
    }).select("*").single();
    if (error || !exp) return reply.code(400).send({ error: error?.message || "Failed" });
    const workerType = body.type === "assignments" ? "export_assignments" : "export_sales";
    await service.from("jobs_queue").insert({
      org_id: ctx.org_id,
      type: workerType,
      status: "queued",
      payload: {
        export_id: exp.id,
        cluster_set_id: body.cluster_set_id || null,
        format: body.format
      }
    });
    return reply.send({ export: exp });
  });
  app2.get("/:id/download", async (req, reply) => {
    const ctx = requireManager(req);
    const { id } = req.params;
    const service = createServiceClient();
    const { data: exp, error } = await service.from("exports").select("*").eq("id", id).eq("org_id", ctx.org_id).single();
    if (error || !exp) return reply.code(404).send({ error: "Not found" });
    if (exp.status !== "complete" || !exp.storage_path) return reply.code(400).send({ error: "Export not ready" });
    const { data: signed, error: sErr } = await service.storage.from("exports").createSignedUrl(exp.storage_path, 60 * 10);
    if (sErr) return reply.code(400).send({ error: sErr.message });
    return reply.send({ url: signed.signedUrl });
  });
}

// src/routes/analytics.ts
async function getRepIdForProfile7(service, org_id, profile_id) {
  const { data } = await service.from("reps").select("id").eq("org_id", org_id).eq("profile_id", profile_id).single();
  return data?.id || null;
}
function derive(totals) {
  const doors_per_hour = totals.hours > 0 ? totals.doors / Number(totals.hours) : 0;
  const close_rate = totals.leads > 0 ? totals.sold / totals.leads : 0;
  return { doors_per_hour, close_rate };
}
async function fetchDailyStats(service, org_id, sinceDay, untilDay, rep_id) {
  let q = service.from("daily_stats").select("day, rep_id, doors_knocked, leads, quotes, sold, revenue, hours_worked").eq("org_id", org_id).gte("day", sinceDay).lte("day", untilDay);
  if (rep_id) q = q.eq("rep_id", rep_id);
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return data || [];
}
async function fetchFollowupsDue(service, org_id, sinceISO, rep_id) {
  let q = service.from("followups").select("id", { count: "exact", head: true }).eq("org_id", org_id).eq("status", "open").lte("due_at", (/* @__PURE__ */ new Date()).toISOString()).gte("due_at", sinceISO);
  if (rep_id) q = q.eq("rep_id", rep_id);
  const { count, error } = await q;
  if (error) throw new Error(error.message);
  return count || 0;
}
async function fetchJobsCompleted(service, org_id, sinceISO, rep_id) {
  let q = service.from("jobs").select("id, sale_id, completed_at").eq("org_id", org_id).eq("status", "complete").gte("completed_at", sinceISO);
  const { data: jobs, error } = await q;
  if (error) throw new Error(error.message);
  if (!rep_id) return (jobs || []).length;
  if (!jobs?.length) return 0;
  const saleIds = jobs.map((j) => j.sale_id).filter(Boolean);
  if (!saleIds.length) return 0;
  const { data: sales, error: sErr } = await service.from("sales").select("id, rep_id").eq("org_id", org_id).in("id", saleIds);
  if (sErr) throw new Error(sErr.message);
  const saleRep = new Map((sales || []).map((s) => [s.id, s.rep_id]));
  return jobs.filter((j) => saleRep.get(j.sale_id) === rep_id).length;
}
async function fetchPaymentsCollected(service, org_id, sinceISO, rep_id) {
  const { data: payments, error } = await service.from("payments").select("id, amount, job_id, status, created_at").eq("org_id", org_id).eq("status", "paid").gte("created_at", sinceISO);
  if (error) throw new Error(error.message);
  if (!rep_id) return (payments || []).reduce((acc, p) => acc + (p.amount || 0), 0) / 100;
  if (!payments?.length) return 0;
  const jobIds = payments.map((p) => p.job_id).filter(Boolean);
  if (!jobIds.length) return 0;
  const { data: jobs, error: jErr } = await service.from("jobs").select("id, sale_id").eq("org_id", org_id).in("id", jobIds);
  if (jErr) throw new Error(jErr.message);
  const saleIds = (jobs || []).map((j) => j.sale_id).filter(Boolean);
  if (!saleIds.length) return 0;
  const { data: sales, error: sErr } = await service.from("sales").select("id, rep_id").eq("org_id", org_id).in("id", saleIds);
  if (sErr) throw new Error(sErr.message);
  const saleRep = new Map((sales || []).map((s) => [s.id, s.rep_id]));
  const jobSale = new Map((jobs || []).map((j) => [j.id, j.sale_id]));
  const totalCents = (payments || []).reduce((acc, p) => {
    const saleId = jobSale.get(p.job_id);
    if (saleId && saleRep.get(saleId) === rep_id) return acc + (p.amount || 0);
    return acc;
  }, 0);
  return totalCents / 100;
}
function scoreRow(r) {
  return r.sold * 200 + r.revenue / 50 + r.quotes * 25 + r.leads * 10 + r.doors * 0.5;
}
async function analyticsRoutes(app2) {
  app2.get("/summary", async (req, reply) => {
    const ctx = requireAnyAuthed(req);
    const service = createServiceClient();
    const { range, since, until, sinceDay, untilDay } = getRangeWindow(req.query?.range);
    let repId = null;
    if (ctx.role === "rep") {
      repId = await getRepIdForProfile7(service, ctx.org_id, ctx.profile_id);
    } else {
      repId = req.query?.rep_id ? String(req.query.rep_id) : null;
    }
    const rows = await fetchDailyStats(service, ctx.org_id, sinceDay, untilDay, repId);
    const totalsBase = {
      doors: 0,
      leads: 0,
      quotes: 0,
      sold: 0,
      revenue: 0,
      hours: 0,
      followups_due: 0,
      jobs_completed: 0,
      payments_collected: 0
    };
    for (const r of rows) {
      totalsBase.doors += Number(r.doors_knocked || 0);
      totalsBase.leads += Number(r.leads || 0);
      totalsBase.quotes += Number(r.quotes || 0);
      totalsBase.sold += Number(r.sold || 0);
      totalsBase.revenue += Number(r.revenue || 0);
      totalsBase.hours += Number(r.hours_worked || 0);
    }
    const sinceISO = since.toISOString();
    const [followups_due, jobs_completed, payments_collected] = await Promise.all([
      fetchFollowupsDue(service, ctx.org_id, sinceISO, repId),
      fetchJobsCompleted(service, ctx.org_id, sinceISO, repId),
      fetchPaymentsCollected(service, ctx.org_id, sinceISO, repId)
    ]);
    totalsBase.followups_due = followups_due;
    totalsBase.jobs_completed = jobs_completed;
    totalsBase.payments_collected = payments_collected;
    const derived = derive(totalsBase);
    return reply.send({
      range,
      since: sinceDay,
      until: untilDay,
      rep_id: repId,
      totals: totalsBase,
      derived,
      // Backward-compatible "rep summary" shape used by /app/reps
      summary: {
        doors: totalsBase.doors,
        leads: totalsBase.leads,
        quotes: totalsBase.quotes,
        sold: totalsBase.sold,
        revenue: totalsBase.revenue,
        doors_per_hour: derived.doors_per_hour,
        close_rate: derived.close_rate
      }
    });
  });
  app2.get("/timeseries", async (req, reply) => {
    const ctx = requireAnyAuthed(req);
    const service = createServiceClient();
    const { range, sinceDay, untilDay } = getRangeWindow(req.query?.range);
    let repId = null;
    if (ctx.role === "rep") {
      repId = await getRepIdForProfile7(service, ctx.org_id, ctx.profile_id);
    } else {
      repId = req.query?.rep_id ? String(req.query.rep_id) : null;
    }
    const rows = await fetchDailyStats(service, ctx.org_id, sinceDay, untilDay, repId);
    const byDay = /* @__PURE__ */ new Map();
    for (const d of enumerateDaysISO(sinceDay, untilDay)) {
      byDay.set(d, { date: d, doors: 0, leads: 0, quotes: 0, sold: 0, revenue: 0 });
    }
    for (const r of rows) {
      const day = String(r.day);
      const bucket = byDay.get(day) || { date: day, doors: 0, leads: 0, quotes: 0, sold: 0, revenue: 0 };
      bucket.doors += Number(r.doors_knocked || 0);
      bucket.leads += Number(r.leads || 0);
      bucket.quotes += Number(r.quotes || 0);
      bucket.sold += Number(r.sold || 0);
      bucket.revenue += Number(r.revenue || 0);
      byDay.set(day, bucket);
    }
    const items = Array.from(byDay.values()).sort((a, b) => a.date < b.date ? -1 : 1);
    return reply.send({ range, since: sinceDay, until: untilDay, rep_id: repId, items });
  });
  app2.get("/leaderboard", async (req, reply) => {
    const ctx = requireAnyAuthed(req);
    const service = createServiceClient();
    const { range, sinceDay, untilDay, priorSinceDay, priorUntilDay } = getRangeWindow(req.query?.range);
    const { data: reps, error: repsErr } = await service.from("reps").select("id, name").eq("org_id", ctx.org_id).order("name", { ascending: true });
    if (repsErr) return reply.code(400).send({ error: repsErr.message });
    const repMap = new Map((reps || []).map((r) => [r.id, r.name]));
    const current = await fetchDailyStats(service, ctx.org_id, sinceDay, untilDay, null);
    const agg = /* @__PURE__ */ new Map();
    for (const r of reps || []) {
      agg.set(r.id, {
        rep_id: r.id,
        rep_name: r.name,
        doors: 0,
        leads: 0,
        quotes: 0,
        sold: 0,
        revenue: 0,
        hours: 0
      });
    }
    for (const row of current) {
      const rep_id = row.rep_id;
      if (!rep_id) continue;
      if (!agg.has(rep_id)) {
        agg.set(rep_id, {
          rep_id,
          rep_name: repMap.get(rep_id) || "Rep",
          doors: 0,
          leads: 0,
          quotes: 0,
          sold: 0,
          revenue: 0,
          hours: 0
        });
      }
      const a = agg.get(rep_id);
      a.doors += Number(row.doors_knocked || 0);
      a.leads += Number(row.leads || 0);
      a.quotes += Number(row.quotes || 0);
      a.sold += Number(row.sold || 0);
      a.revenue += Number(row.revenue || 0);
      a.hours += Number(row.hours_worked || 0);
    }
    const priorAgg = /* @__PURE__ */ new Map();
    if (priorSinceDay && priorUntilDay) {
      const priorRows = await fetchDailyStats(service, ctx.org_id, priorSinceDay, priorUntilDay, null);
      const tmp = /* @__PURE__ */ new Map();
      for (const row of priorRows) {
        const rep_id = row.rep_id;
        if (!rep_id) continue;
        const a = tmp.get(rep_id) || { doors: 0, leads: 0, quotes: 0, sold: 0, revenue: 0 };
        a.doors += Number(row.doors_knocked || 0);
        a.leads += Number(row.leads || 0);
        a.quotes += Number(row.quotes || 0);
        a.sold += Number(row.sold || 0);
        a.revenue += Number(row.revenue || 0);
        tmp.set(rep_id, a);
      }
      for (const [rep_id, a] of tmp.entries()) {
        priorAgg.set(rep_id, scoreRow(a));
      }
    }
    const items = Array.from(agg.values()).map((r) => {
      const score = scoreRow(r);
      const priorScore = priorAgg.get(r.rep_id) || 0;
      const delta_score = score - priorScore;
      const doors_per_hour = r.hours > 0 ? r.doors / Number(r.hours) : 0;
      const close_rate = r.leads > 0 ? r.sold / r.leads : 0;
      return {
        rep_id: r.rep_id,
        rep_name: r.rep_name,
        doors: r.doors,
        leads: r.leads,
        quotes: r.quotes,
        sold: r.sold,
        revenue: r.revenue,
        score,
        delta_score,
        doors_per_hour,
        close_rate
      };
    });
    items.sort((a, b) => b.score - a.score);
    return reply.send({ range, since: sinceDay, until: untilDay, items });
  });
}

// src/routes/dashboard.ts
async function getRepIdForProfile8(service, org_id, profile_id) {
  const { data } = await service.from("reps").select("id").eq("org_id", org_id).eq("profile_id", profile_id).single();
  return data?.id || null;
}
function scoreRow2(r) {
  return r.sold * 200 + r.revenue / 50 + r.quotes * 25 + r.leads * 10 + r.doors * 0.5;
}
function derive2(totals) {
  const doors_per_hour = totals.hours > 0 ? totals.doors / Number(totals.hours) : 0;
  const close_rate = totals.leads > 0 ? totals.sold / totals.leads : 0;
  return { doors_per_hour, close_rate };
}
async function fetchDailyStats2(service, org_id, sinceDay, untilDay, rep_id) {
  let q = service.from("daily_stats").select("day, rep_id, doors_knocked, leads, quotes, sold, revenue, hours_worked").eq("org_id", org_id).gte("day", sinceDay).lte("day", untilDay);
  if (rep_id) q = q.eq("rep_id", rep_id);
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return data || [];
}
async function countFollowupsDue(service, org_id, sinceISO, rep_id) {
  let q = service.from("followups").select("id", { count: "exact", head: true }).eq("org_id", org_id).eq("status", "open").lte("due_at", (/* @__PURE__ */ new Date()).toISOString()).gte("due_at", sinceISO);
  if (rep_id) q = q.eq("rep_id", rep_id);
  const { count, error } = await q;
  if (error) throw new Error(error.message);
  return count || 0;
}
async function countJobsCompleted(service, org_id, sinceISO, rep_id) {
  const { data: jobs, error } = await service.from("jobs").select("id, sale_id, completed_at").eq("org_id", org_id).eq("status", "complete").gte("completed_at", sinceISO);
  if (error) throw new Error(error.message);
  if (!rep_id) return (jobs || []).length;
  if (!jobs?.length) return 0;
  const saleIds = jobs.map((j) => j.sale_id).filter(Boolean);
  if (!saleIds.length) return 0;
  const { data: sales, error: sErr } = await service.from("sales").select("id, rep_id").eq("org_id", org_id).in("id", saleIds);
  if (sErr) throw new Error(sErr.message);
  const saleRep = new Map((sales || []).map((s) => [s.id, s.rep_id]));
  return (jobs || []).filter((j) => saleRep.get(j.sale_id) === rep_id).length;
}
async function sumPaymentsCollected(service, org_id, sinceISO, rep_id) {
  const { data: payments, error } = await service.from("payments").select("id, amount, job_id, status, created_at").eq("org_id", org_id).eq("status", "paid").gte("created_at", sinceISO);
  if (error) throw new Error(error.message);
  if (!rep_id) return (payments || []).reduce((acc, p) => acc + (p.amount || 0), 0) / 100;
  if (!payments?.length) return 0;
  const jobIds = payments.map((p) => p.job_id).filter(Boolean);
  if (!jobIds.length) return 0;
  const { data: jobs, error: jErr } = await service.from("jobs").select("id, sale_id").eq("org_id", org_id).in("id", jobIds);
  if (jErr) throw new Error(jErr.message);
  const saleIds = (jobs || []).map((j) => j.sale_id).filter(Boolean);
  if (!saleIds.length) return 0;
  const { data: sales, error: sErr } = await service.from("sales").select("id, rep_id").eq("org_id", org_id).in("id", saleIds);
  if (sErr) throw new Error(sErr.message);
  const saleRep = new Map((sales || []).map((s) => [s.id, s.rep_id]));
  const jobSale = new Map((jobs || []).map((j) => [j.id, j.sale_id]));
  const totalCents = (payments || []).reduce((acc, p) => {
    const saleId = jobSale.get(p.job_id);
    if (saleId && saleRep.get(saleId) === rep_id) return acc + (p.amount || 0);
    return acc;
  }, 0);
  return totalCents / 100;
}
async function dashboardRoutes(app2) {
  app2.get("/overview", async (req, reply) => {
    const ctx = requireAnyAuthed(req);
    const service = createServiceClient();
    const { range, since, sinceDay, untilDay, priorSinceDay, priorUntilDay } = getRangeWindow(req.query?.range);
    let repId = null;
    if (ctx.role === "rep") {
      repId = await getRepIdForProfile8(service, ctx.org_id, ctx.profile_id);
    }
    const rows = await fetchDailyStats2(service, ctx.org_id, sinceDay, untilDay, repId);
    const totals = {
      doors: 0,
      leads: 0,
      quotes: 0,
      sold: 0,
      revenue: 0,
      hours: 0,
      followups_due: 0,
      jobs_completed: 0,
      payments_collected: 0
    };
    for (const r of rows) {
      totals.doors += Number(r.doors_knocked || 0);
      totals.leads += Number(r.leads || 0);
      totals.quotes += Number(r.quotes || 0);
      totals.sold += Number(r.sold || 0);
      totals.revenue += Number(r.revenue || 0);
      totals.hours += Number(r.hours_worked || 0);
    }
    const sinceISO = since.toISOString();
    const [followups_due, jobs_completed, payments_collected] = await Promise.all([
      countFollowupsDue(service, ctx.org_id, sinceISO, repId),
      countJobsCompleted(service, ctx.org_id, sinceISO, repId),
      sumPaymentsCollected(service, ctx.org_id, sinceISO, repId)
    ]);
    totals.followups_due = followups_due;
    totals.jobs_completed = jobs_completed;
    totals.payments_collected = payments_collected;
    const derived = derive2(totals);
    const { data: reps, error: repsErr } = await service.from("reps").select("id, name").eq("org_id", ctx.org_id).order("name", { ascending: true });
    if (repsErr) return reply.code(400).send({ error: repsErr.message });
    const repName = new Map((reps || []).map((r) => [r.id, r.name]));
    const currentAll = await fetchDailyStats2(service, ctx.org_id, sinceDay, untilDay, null);
    const agg = /* @__PURE__ */ new Map();
    for (const r of reps || []) {
      agg.set(r.id, { rep_id: r.id, rep_name: r.name, doors: 0, leads: 0, quotes: 0, sold: 0, revenue: 0, hours: 0 });
    }
    for (const row of currentAll) {
      const id = row.rep_id;
      if (!id) continue;
      const a = agg.get(id) || { rep_id: id, rep_name: repName.get(id) || "Rep", doors: 0, leads: 0, quotes: 0, sold: 0, revenue: 0, hours: 0 };
      a.doors += Number(row.doors_knocked || 0);
      a.leads += Number(row.leads || 0);
      a.quotes += Number(row.quotes || 0);
      a.sold += Number(row.sold || 0);
      a.revenue += Number(row.revenue || 0);
      a.hours += Number(row.hours_worked || 0);
      agg.set(id, a);
    }
    const priorScore = /* @__PURE__ */ new Map();
    if (priorSinceDay && priorUntilDay) {
      const priorRows = await fetchDailyStats2(service, ctx.org_id, priorSinceDay, priorUntilDay, null);
      const tmp = /* @__PURE__ */ new Map();
      for (const row of priorRows) {
        const id = row.rep_id;
        if (!id) continue;
        const a = tmp.get(id) || { doors: 0, leads: 0, quotes: 0, sold: 0, revenue: 0 };
        a.doors += Number(row.doors_knocked || 0);
        a.leads += Number(row.leads || 0);
        a.quotes += Number(row.quotes || 0);
        a.sold += Number(row.sold || 0);
        a.revenue += Number(row.revenue || 0);
        tmp.set(id, a);
      }
      for (const [id, a] of tmp.entries()) priorScore.set(id, scoreRow2(a));
    }
    const repLeaderboard = Array.from(agg.values()).map((r) => {
      const score = scoreRow2(r);
      const delta_score = score - (priorScore.get(r.rep_id) || 0);
      return {
        rep_id: r.rep_id,
        rep_name: r.rep_name,
        doors: r.doors,
        sold: r.sold,
        revenue: r.revenue,
        score,
        delta_score
      };
    });
    repLeaderboard.sort((a, b) => b.score - a.score);
    return reply.send({ range, since: sinceDay, until: untilDay, totals, derived, repLeaderboard });
  });
}

// src/routes/audit.ts
async function auditRoutes(app2) {
  app2.get("/", async (req, reply) => {
    const ctx = requireManager(req);
    const service = createServiceClient();
    const q = req.query;
    const limit = Math.min(200, Math.max(10, Number(q.limit || 100)));
    const { data, error } = await service.from("audit_log").select("*").eq("org_id", ctx.org_id).order("created_at", { ascending: false }).limit(limit);
    if (error) return reply.code(400).send({ error: error.message });
    return reply.send({ audit: data });
  });
}

// src/routes/aliases.ts
import Stripe2 from "stripe";
import twilio from "twilio";
function stripeClient2() {
  if (!env.STRIPE_SECRET_KEY) return null;
  return new Stripe2(env.STRIPE_SECRET_KEY, { apiVersion: "2024-06-20" });
}
function fullWebhookUrl(req) {
  const proto = req.headers["x-forwarded-proto"] || "https";
  const host = req.headers["x-forwarded-host"] || req.headers["host"];
  const url = req.raw?.url || req.url;
  return `${proto}://${host}${url}`;
}
async function getOrgIdForTwilioNumber(service, toNumber) {
  if (!toNumber) return null;
  const { data } = await service.from("org_settings").select("org_id, twilio_number").eq("twilio_number", toNumber).limit(1).maybeSingle();
  return data?.org_id || null;
}
async function aliasRoutes(app2) {
  app2.get("/me", async (req, reply) => {
    if (!req.ctx) return reply.code(401).send({ error: "Unauthorized" });
    const service = createServiceClient();
    const { data: profile, error } = await service.from("profiles").select("id, org_id, role, name, email, created_at").eq("id", req.ctx.user_id).single();
    if (error) return reply.code(400).send({ error: error.message });
    return reply.send({ user: profile });
  });
  app2.post("/twilio/inbound", async (req, reply) => {
    const service = createServiceClient();
    if (env.TWILIO_AUTH_TOKEN) {
      const signature = req.headers["x-twilio-signature"];
      if (!signature || typeof signature !== "string") return reply.code(400).send("missing signature");
      const ok = twilio.validateRequest(
        env.TWILIO_AUTH_TOKEN,
        signature,
        fullWebhookUrl(req),
        req.body || {}
      );
      if (!ok) return reply.code(403).send("invalid signature");
    }
    const body = req.body || {};
    const from = body.From || body.from;
    const to = body.To || body.to;
    const text = body.Body || body.body;
    const sid = body.MessageSid || body.SmsMessageSid;
    if (!from || !to || !text) return reply.code(400).send("missing");
    const org_id = await getOrgIdForTwilioNumber(service, to);
    if (!org_id) return reply.code(404).send("unknown org");
    const { data: existing } = await service.from("message_threads").select("*").eq("org_id", org_id).eq("customer_phone", from).single();
    let threadId = existing?.id;
    if (!threadId) {
      const { data: thread } = await service.from("message_threads").insert({ org_id, rep_id: null, customer_phone: from, last_message_at: (/* @__PURE__ */ new Date()).toISOString() }).select("*").single();
      threadId = thread.id;
    } else {
      await service.from("message_threads").update({ last_message_at: (/* @__PURE__ */ new Date()).toISOString() }).eq("id", threadId);
    }
    await service.from("messages").insert({
      org_id,
      thread_id: threadId,
      direction: "inbound",
      body: text,
      twilio_sid: sid || null,
      status: "received",
      sent_at: (/* @__PURE__ */ new Date()).toISOString()
    });
    reply.header("Content-Type", "text/plain");
    return reply.send("ok");
  });
  app2.post("/stripe/webhook", async (req, reply) => {
    if (!stripeClient2() || !env.STRIPE_WEBHOOK_SECRET) return reply.code(400).send("stripe not configured");
    const sig = req.headers["stripe-signature"];
    if (!sig || typeof sig !== "string") return reply.code(400).send("missing signature");
    const raw = req.rawBody;
    const payload = raw ? raw : Buffer.from(JSON.stringify(req.body || {}));
    let event;
    try {
      event = stripeClient2().webhooks.constructEvent(payload, sig, env.STRIPE_WEBHOOK_SECRET);
    } catch (err) {
      return reply.code(400).send(`Webhook Error: ${err.message}`);
    }
    const service = createServiceClient();
    if (event.type === "checkout.session.completed") {
      const session = event.data.object;
      const sessionId = session.id;
      await service.from("payments").update({ status: "paid" }).eq("stripe_checkout_session_id", sessionId);
    }
    return reply.send({ received: true });
  });
}

// src/routes/org.ts
async function orgRoutes(app2) {
  app2.get("/members", async (req, reply) => {
    const ctx = requireRoles(req, ["admin"]);
    const service = createServiceClient();
    const { data, error } = await service.from("profiles").select("id, org_id, role, name, email, created_at").eq("org_id", ctx.org_id).order("created_at", { ascending: false }).limit(500);
    if (error) return reply.code(400).send({ error: error.message });
    return reply.send({ members: data || [] });
  });
}

// src/routes/zones.ts
import { centroid } from "@blockd2d/shared";
import bbox from "@turf/bbox";
import booleanPointInPolygon from "@turf/boolean-point-in-polygon";

// src/lib/colors.ts
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
function pickClusterColor(index) {
  return PALETTE[index % PALETTE.length];
}

// src/routes/zones.ts
var PROPERTIES_BBOX_LIMIT = 5e4;
function polygonCentroid(geojson) {
  const ring = geojson.coordinates?.[0];
  if (!ring || !Array.isArray(ring) || ring.length === 0) return { lat: 0, lng: 0 };
  const points = ring.map((c) => ({ lat: c[1], lng: c[0] }));
  const closed = points.length > 1 && points[0].lat === points[points.length - 1].lat && points[0].lng === points[points.length - 1].lng;
  const pts = closed ? points.slice(0, -1) : points;
  return centroid(pts);
}
function polygonBbox(geojson) {
  return bbox({ type: "Feature", properties: {}, geometry: geojson });
}
async function findPropertiesInPolygon(service, org_id, geojson) {
  const [minLng, minLat, maxLng, maxLat] = polygonBbox(geojson);
  const { data, error } = await service.from("properties").select("id, lat, lng, value_estimate").eq("org_id", org_id).gte("lat", minLat).lte("lat", maxLat).gte("lng", minLng).lte("lng", maxLng).limit(PROPERTIES_BBOX_LIMIT);
  if (error) throw error;
  const rows = data ?? [];
  const inside = [];
  const poly = { type: "Feature", properties: {}, geometry: geojson };
  for (const row of rows) {
    const lat = row.lat != null ? Number(row.lat) : NaN;
    const lng = row.lng != null ? Number(row.lng) : NaN;
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;
    if (booleanPointInPolygon([lng, lat], poly)) {
      inside.push({ id: row.id, value_estimate: Number(row.value_estimate) || 0 });
    }
  }
  return inside;
}
async function zonesRoutes(app2) {
  app2.get("/", async (req, reply) => {
    const ctx = requireManager(req);
    const service = createServiceClient();
    const { data, error } = await service.from("zones").select("id, name, geojson, created_at").eq("org_id", ctx.org_id).order("created_at", { ascending: false }).limit(100);
    if (error) {
      const msg = zonesTableMissing(error) ? "Zones table not set up. Run the database migration (see apps/api/prisma/migrations/20260307000000_add_zones)." : error.message;
      return reply.code(zonesTableMissing(error) ? 503 : 400).send({ error: msg });
    }
    return reply.send({ items: data ?? [] });
  });
  app2.post("/", async (req, reply) => {
    const ctx = requireManager(req);
    const body = req.body;
    const name = typeof body?.name === "string" ? body.name.trim() || "Drawn zones" : "Drawn zones";
    let zones;
    if (Array.isArray(body?.zones) && body.zones.length > 0) {
      zones = body.zones.filter((z5) => z5 != null && typeof z5 === "object" && z5.type === "Polygon" && Array.isArray(z5.coordinates));
      if (zones.length === 0) return reply.code(400).send({ error: "zones must be a non-empty array of GeoJSON Polygons" });
    } else if (body?.geojson && typeof body.geojson === "object" && body.geojson.type === "Polygon" && Array.isArray(body.geojson.coordinates)) {
      zones = [body.geojson];
    } else {
      return reply.code(400).send({ error: "geojson (Polygon) or zones (Polygon[]) required" });
    }
    const service = createServiceClient();
    const { data: clusterSet, error: setErr } = await service.from("cluster_sets").insert({
      org_id: ctx.org_id,
      county_id: null,
      name,
      filters_json: { source: "zone" },
      status: "complete",
      progress: 100,
      created_by: ctx.profile_id,
      radius_m: null,
      min_houses: null
    }).select("id").single();
    if (setErr) return reply.code(400).send({ error: setErr.message });
    const clusterSetId = clusterSet.id;
    for (let i = 0; i < zones.length; i++) {
      const geojson = zones[i];
      const center = polygonCentroid(geojson);
      let props;
      try {
        props = await findPropertiesInPolygon(service, ctx.org_id, geojson);
      } catch (e) {
        return reply.code(503).send({ error: e?.message ?? "Failed to find properties in zone" });
      }
      const size = props.length;
      const total_value = props.reduce((s, p) => s + p.value_estimate, 0);
      const avg_value = size ? total_value / size : 0;
      const stats = {
        size,
        total_value,
        avg_value,
        total_potential: total_value,
        avg_value_estimate: avg_value
      };
      const { data: inserted, error: clusterErr } = await service.from("clusters").insert({
        org_id: ctx.org_id,
        cluster_set_id: clusterSetId,
        center_lat: center.lat,
        center_lng: center.lng,
        hull_geojson: geojson,
        stats_json: stats,
        color: pickClusterColor(i)
      }).select("id").single();
      if (clusterErr) return reply.code(400).send({ error: clusterErr.message });
      const clusterId = inserted.id;
      for (let j = 0; j < props.length; j += 1e3) {
        const batch = props.slice(j, j + 1e3).map((p) => ({
          org_id: ctx.org_id,
          cluster_id: clusterId,
          property_id: p.id
        }));
        const { error: cpErr } = await service.from("cluster_properties").insert(batch);
        if (cpErr) return reply.code(503).send({ error: cpErr.message });
      }
    }
    return reply.send({ cluster_set_id: clusterSetId });
  });
}
function zonesTableMissing(err) {
  const m = (err?.message ?? "").toLowerCase();
  const code = err?.code ?? "";
  return code === "PGRST116" || m === "not found" || /relation\s+["']?zones["']?\s+does not exist/i.test(m) || /table\s+["']?zones["']?\s+does not exist/i.test(m);
}

// src/server.ts
function buildServer() {
  const app2 = Fastify({
    logger: {
      level: env.NODE_ENV === "production" ? "info" : "debug"
    }
  });
  app2.register(cookie);
  app2.register(formbody);
  app2.register(cors, {
    origin: true,
    credentials: true
  });
  app2.register(rateLimit, {
    max: 300,
    timeWindow: "1 minute"
  });
  app2.addContentTypeParser("application/json", { parseAs: "buffer" }, function(req, body, done) {
    req.rawBody = body;
    try {
      const json = JSON.parse(body.toString("utf8") || "{}");
      done(null, json);
    } catch (e) {
      done(e, void 0);
    }
  });
  app2.addHook("preHandler", async (req) => {
    req.ctx = await buildAuthContext(req);
  });
  app2.addHook("preHandler", async (req) => {
    const method = req.method.toUpperCase();
    const isWrite = ["POST", "PUT", "PATCH", "DELETE"].includes(method);
    if (!isWrite) return;
    const url = req.url || "";
    if (url.startsWith("/v1/messages/twilio/inbound") || url.startsWith("/v1/payments/stripe/webhook") || url.startsWith("/v1/twilio/inbound") || url.startsWith("/v1/stripe/webhook"))
      return;
    if (url.startsWith("/v1/auth/login") || url.startsWith("/v1/auth/refresh") || url.startsWith("/v1/invites/accept"))
      return;
    try {
      requireCsrf(req);
    } catch (e) {
      throw e;
    }
  });
  app2.get("/health", async () => ({ ok: true, name: "block-v7-api", env: env.NODE_ENV }));
  app2.register(aliasRoutes, { prefix: "/v1" });
  app2.register(authRoutes, { prefix: "/v1/auth" });
  app2.register(invitesRoutes, { prefix: "/v1/invites" });
  app2.register(orgRoutes, { prefix: "/v1/org" });
  app2.register(zonesRoutes, { prefix: "/v1/zones" });
  app2.register(countiesRoutes, { prefix: "/v1/counties" });
  app2.register(propertiesRoutes, { prefix: "/v1/properties" });
  app2.register(repsRoutes, { prefix: "/v1/reps" });
  app2.register(interactionsRoutes, { prefix: "/v1/interactions" });
  app2.register(clusterSetsRoutes, { prefix: "/v1/cluster-sets" });
  app2.register(clusterSetsRoutes, { prefix: "/v1/territories" });
  app2.register(clustersRoutes, { prefix: "/v1/clusters" });
  app2.register(salesRoutes, { prefix: "/v1/sales" });
  app2.register(contractsRoutes, { prefix: "/v1/contracts" });
  app2.register(followupsRoutes, { prefix: "/v1/followups" });
  app2.register(messagesRoutes, { prefix: "/v1/messages" });
  app2.register(laborRoutes, { prefix: "/v1/labor" });
  app2.register(jobsRoutes, { prefix: "/v1/jobs" });
  app2.register(paymentsRoutes, { prefix: "/v1/payments" });
  app2.register(exportsRoutes, { prefix: "/v1/exports" });
  app2.register(analyticsRoutes, { prefix: "/v1/analytics" });
  app2.register(dashboardRoutes, { prefix: "/v1/dashboard" });
  app2.register(auditRoutes, { prefix: "/v1/audit" });
  return app2;
}

// src/index.ts
var app = buildServer();
var port = Number(env.PORT || 4e3);
app.listen({ port, host: "0.0.0.0" }).then(() => {
  app.log.info({ port }, "API listening");
});
process.on("SIGINT", async () => {
  await shutdownPosthog();
  process.exit(0);
});
process.on("SIGTERM", async () => {
  await shutdownPosthog();
  process.exit(0);
});
//# sourceMappingURL=index.js.map