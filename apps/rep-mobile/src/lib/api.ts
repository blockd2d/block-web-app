import type {
  Cluster,
  Me,
  Stop,
  KnockLog,
  Quote,
  ClusterMapData,
  LatLng,
  KnockOutcome
} from "../types";
import { config, hasApiConfig } from "./runtimeConfig";
import { mockServer } from "./mockServer";
import { blockApi, setSession, clearSession } from "./blockApi";

type SalesCtx = {
  userId: string;
  orgId: string;
  orgName: string;
  role: string;
  profileName: string | null;
  repId: string | null;
  repName: string | null;
};

// Backend contract notes live in apps/rep-mobile/docs/backend-alignment.md

let onUnauthorized: null | (() => void | Promise<void>) = null;

export function setUnauthorizedHandler(fn: () => void | Promise<void>) {
  onUnauthorized = fn;
}

function errMessage(e: unknown): string {
  const msg = (e as any)?.message;
  return typeof msg === "string" && msg.trim() ? msg : "Unknown error";
}

function isUnauthorized(msg: string) {
  return msg.includes("401") || msg.toLowerCase().includes("jwt") || msg.toLowerCase().includes("unauthorized");
}

async function guard<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (e) {
    const msg = errMessage(e);
    if (isUnauthorized(msg)) {
      await onUnauthorized?.();
    }
    throw e;
  }
}

// Cache the current user/org/rep mapping to avoid repeated lookups on every call.
let cachedCtx: { value: SalesCtx; at: number } | null = null;

function mapKnockOutcomeToApi(outcome: KnockOutcome): string {
  const map: Record<KnockOutcome, string> = {
    no_answer: "not_home",
    not_interested: "talked_not_interested",
    interested: "lead",
    estimated: "quote",
    booked: "sold"
  };
  return map[outcome] ?? "lead";
}

async function getSalesCtx(): Promise<SalesCtx> {
  if (config.mockMode) {
    return {
      userId: "mock_user",
      orgId: "mock_org",
      orgName: "Nova Services",
      role: "rep",
      profileName: "Mock Rep",
      repId: "mock_rep",
      repName: "Mock Rep"
    };
  }

  const now = Date.now();
  if (cachedCtx && now - cachedCtx.at < 60_000) return cachedCtx.value;

  const authRes = await blockApi.get<{ user: { id: string; org_id: string; role: string; name?: string | null } }>("/v1/auth/me");
  const user = authRes?.user;
  if (!user) throw new Error("401 Unauthorized");

  const repsRes = await blockApi.get<{ rep: { id: string; name?: string | null } | null }>("/v1/reps/me");
  const rep = repsRes?.rep ?? null;

  const value: SalesCtx = {
    userId: user.id,
    orgId: user.org_id ?? "unknown",
    orgName: "Organization",
    role: user.role ?? "unknown",
    profileName: user.name ?? null,
    repId: rep?.id ?? null,
    repName: rep?.name ?? null
  };

  cachedCtx = { value, at: now };
  return value;
}

function shortId(id: string) {
  if (!id) return "";
  const s = String(id);
  return s.length > 8 ? s.slice(0, 8) : s;
}

function normalizeGeoJsonPolygonToLatLngs(geo: any): LatLng[] | null {
  // Supports GeoJSON Polygon or MultiPolygon.
  // GeoJSON coordinates are [lng, lat]
  const coords = geo?.coordinates;
  const type = geo?.type;
  const ring: any[] | null = (() => {
    if (!coords) return null;
    if (type === "Polygon" && Array.isArray(coords) && Array.isArray(coords[0])) return coords[0];
    if (type === "MultiPolygon" && Array.isArray(coords) && Array.isArray(coords[0]) && Array.isArray(coords[0][0])) return coords[0][0];
    return null;
  })();
  if (!ring || !Array.isArray(ring)) return null;
  const out: LatLng[] = [];
  for (const p of ring) {
    if (!Array.isArray(p) || p.length < 2) continue;
    const lng = p[0];
    const lat = p[1];
    if (typeof lat === "number" && typeof lng === "number") out.push({ latitude: lat, longitude: lng });
  }
  return out.length ? out : null;
}

function safeJsonParse<T>(s: unknown): T | null {
  if (typeof s !== "string") return null;
  try {
    return JSON.parse(s) as T;
  } catch {
    return null;
  }
}

function encodeMobileMeta(meta: any) {
  // Keep it human-safe and easy to grep.
  return `\n\n---\nNOVASALES_META:${JSON.stringify(meta)}`;
}

function extractMobileMeta<T>(notes: unknown): T | null {
  if (typeof notes !== "string") return null;
  const idx = notes.lastIndexOf("NOVASALES_META:");
  if (idx < 0) return null;
  const raw = notes.slice(idx + "NOVASALES_META:".length).trim();
  return safeJsonParse<T>(raw);
}

function firstNonEmptyString(...values: unknown[]) {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value;
  }
  return null;
}

export type StoredSession = {
  access_token: string;
  refresh_token: string;
  expires_at?: number;
  token_type?: string;
  user?: { id: string; email?: string };
};

export const api = {
  async signIn(email: string, password: string): Promise<{ session: StoredSession; me: Me }> {
    if (config.mockMode) {
      const res = await mockServer.signIn(email, password);
      return { session: { access_token: res.token, refresh_token: "mock_refresh" }, me: res.me };
    }

    if (!hasApiConfig()) {
      throw new Error("Block API URL missing. Set EXPO_PUBLIC_API_URL.");
    }

    const res = await blockApi.post<{
      user: { id: string; org_id: string; role: string; name?: string | null; email?: string };
      session: { access_token: string; refresh_token: string; expires_in?: number };
    }>("/v1/auth/login", { email, password, turnstileToken: null });

    if (!res?.session?.access_token) throw new Error("Missing session");
    setSession({
      access_token: res.session.access_token,
      refresh_token: res.session.refresh_token,
      expires_in: res.session.expires_in
    });

    const user = res.user;
    const me: Me = {
      user: { id: user.id, email: user.email ?? "" },
      org: { id: user.org_id ?? "unknown", name: "Organization" },
      role: (user.role as any) ?? "unknown",
      fullName: user.name ?? null
    };

    return {
      session: {
        access_token: res.session.access_token,
        refresh_token: res.session.refresh_token,
        user: { id: user.id, email: user.email }
      },
      me
    };
  },

  async restoreSession(s: StoredSession): Promise<void> {
    if (config.mockMode) return;
    setSession({
      access_token: s.access_token,
      refresh_token: s.refresh_token
    });
  },

  async signOut(): Promise<void> {
    if (config.mockMode) return;
    try {
      await blockApi.post("/v1/auth/logout");
    } catch {
      // ignore
    }
    clearSession();
  },

  async me(_session?: { access_token: string; refresh_token?: string }): Promise<Me> {
    return guard(async () => {
      if (config.mockMode) {
        return await mockServer.me(null);
      }

      const res = await blockApi.get<{
        user: { id: string; org_id: string; role: string; name?: string | null; email?: string };
      }>("/v1/auth/me");

      const u = res?.user;
      if (!u) throw new Error("401 Unauthorized");

      if (cachedCtx?.value.userId && cachedCtx.value.userId !== u.id) cachedCtx = null;

      return {
        user: { id: u.id, email: u.email ?? "" },
        org: { id: u.org_id ?? "unknown", name: "Organization" },
        role: (u.role as any) ?? "unknown",
        fullName: u.name ?? null
      };
    });
  },

  async listAssignedClusters(userId: string): Promise<Cluster[]> {
    return guard(async () => {
      if (config.mockMode) return await mockServer.listAssignedClusters(userId);

      const ctx = await getSalesCtx();
      if (!ctx.repId) throw new Error("No rep record found for this user");

      const res = await blockApi.get<{ clusters: any[] }>("/v1/reps/me/clusters");
      const rows = res?.clusters ?? [];

      return rows.map((r: any) => {
        const stats = r.stats_json ?? {};
        const stopCount = typeof stats.stop_count === "number" ? stats.stop_count : 0;
        const completedCount = typeof stats.completed_count === "number" ? stats.completed_count : 0;
        const walkingDistanceMiles =
          typeof stats.walking_distance_miles === "number"
            ? stats.walking_distance_miles
            : typeof stats.walkingDistanceMiles === "number"
              ? stats.walkingDistanceMiles
              : null;
        const estDurationMins =
          typeof stats.est_duration_mins === "number"
            ? stats.est_duration_mins
            : typeof stats.estDurationMins === "number"
              ? stats.estDurationMins
              : null;
        const scheduledStart = firstNonEmptyString(r?.scheduled_start, stats?.scheduled_start);
        const scheduledEnd = firstNonEmptyString(r?.scheduled_end, stats?.scheduled_end);

        const name = firstNonEmptyString(r?.name, r?.title, stats?.name) ?? `Cluster • ${shortId(r.id)}`;
        const status = completedCount && stopCount && completedCount >= stopCount ? ("completed" as any) : ("assigned" as any);

        return {
          id: r.id,
          name,
          status,
          stopCount: stopCount ?? 0,
          completedCount,
          walkingDistanceMiles,
          estDurationMins,
          scheduledStart,
          scheduledEnd,
          startLat: r.center_lat ?? null,
          startLng: r.center_lng ?? null
        } as Cluster;
      });
    });
  },

  async getClusterStops(clusterId: string): Promise<Stop[]> {
    return guard(async () => {
      if (config.mockMode) return await mockServer.getClusterStops(clusterId);

      const ctx = await getSalesCtx();
      if (!ctx.repId) throw new Error("No rep record found for this user");

      const [clusterRes, propsRes, intRes] = await Promise.all([
        blockApi.get<{ cluster: any }>(`/v1/clusters/${encodeURIComponent(clusterId)}`),
        blockApi.get<{ properties: any[] }>(`/v1/clusters/${encodeURIComponent(clusterId)}/properties`),
        blockApi.get<{ interactions: any[] }>("/v1/interactions")
      ]);

      const cluster = clusterRes?.cluster;
      const properties = propsRes?.properties ?? [];
      const interactions = intRes?.interactions ?? [];

      const stats = cluster?.stats_json ?? {};
      const hintedOrder: string[] | null =
        Array.isArray(stats.ordered_property_ids) ? stats.ordered_property_ids
          : Array.isArray(stats.stop_order) ? stats.stop_order
            : null;

      const propertyIds = properties.map((p: any) => p.id);
      const completedSet = new Set(
        interactions.filter((i: any) => propertyIds.includes(i.property_id)).map((i: any) => i.property_id)
      );

      const centerLat = typeof cluster?.center_lat === "number" ? cluster.center_lat : 0;
      const centerLng = typeof cluster?.center_lng === "number" ? cluster.center_lng : 0;

      let ordered: any[];
      if (hintedOrder && hintedOrder.length) {
        const byId = new Map(properties.map((p: any) => [p.id, p]));
        ordered = [];
        for (const pid of hintedOrder) {
          const found = byId.get(pid);
          if (found) ordered.push(found);
        }
        for (const p of properties) if (!hintedOrder.includes(p.id)) ordered.push(p);
      } else {
        ordered = [...properties].sort((a, b) => {
          const alat = a?.lat;
          const alng = a?.lng;
          const blat = b?.lat;
          const blng = b?.lng;
          const ad = typeof alat === "number" && typeof alng === "number" ? (alat - centerLat) ** 2 + (alng - centerLng) ** 2 : Number.POSITIVE_INFINITY;
          const bd = typeof blat === "number" && typeof blng === "number" ? (blat - centerLat) ** 2 + (blng - centerLng) ** 2 : Number.POSITIVE_INFINITY;
          if (ad !== bd) return ad - bd;
          return String(a?.id ?? "").localeCompare(String(b?.id ?? ""));
        });
      }

      return ordered.map((p: any, i: number) => ({
        id: p.id,
        clusterId,
        sequence: i + 1,
        address1: p?.address1 ?? "",
        city: p?.city ?? null,
        state: p?.state ?? null,
        zip: p?.zip ?? null,
        lat: typeof p?.lat === "number" ? p.lat : null,
        lng: typeof p?.lng === "number" ? p.lng : null,
        leadName: null,
        propertyNotes: null,
        completed: completedSet.has(p.id)
      })) as Stop[];
    });
  },

  async getClusterMapData(clusterId: string): Promise<ClusterMapData> {
    return guard(async () => {
      if (config.mockMode) return await mockServer.getClusterMapData(clusterId);

      const clusterRes = await blockApi.get<{ cluster: any }>(`/v1/clusters/${encodeURIComponent(clusterId)}`);
      const cluster = clusterRes?.cluster;
      const boundary = normalizeGeoJsonPolygonToLatLngs(cluster?.hull_geojson);

      const stops = await api.getClusterStops(clusterId);
      const route = stops
        .map((s) => (typeof s.lat === "number" && typeof s.lng === "number" ? { latitude: s.lat, longitude: s.lng } : null))
        .filter(Boolean) as LatLng[];

      return { boundary: boundary ?? undefined, route: route.length ? route : null };
    });
  },

  async createKnockLog(payload: Omit<KnockLog, "id" | "createdAt">): Promise<KnockLog> {
    return guard(async () => {
      if (config.mockMode) return await mockServer.createKnockLog(payload);

      const ctx = await getSalesCtx();
      if (!ctx.repId) throw new Error("No rep record found for this user");

      const apiOutcome = mapKnockOutcomeToApi(payload.outcome);
      const notes = (payload.notes ?? "").trim() + encodeMobileMeta({ clientEventId: payload.clientEventId, clusterId: payload.clusterId });

      const res = await blockApi.post<{ interaction: any }>("/v1/interactions", {
        property_id: payload.stopId,
        outcome: apiOutcome,
        notes: notes || undefined
      });

      const d = res?.interaction;
      return {
        id: d?.id,
        clientEventId: payload.clientEventId,
        clusterId: payload.clusterId,
        stopId: payload.stopId,
        outcome: payload.outcome,
        notes: payload.notes ?? null,
        createdAt: d?.created_at ?? new Date().toISOString()
      } as KnockLog;
    });
  },

  async upsertQuote(payload: Omit<Quote, "id" | "updatedAt" | "totalCents"> & { totalCents?: number }): Promise<Quote> {
    return guard(async () => {
      if (config.mockMode) return await mockServer.upsertQuote(payload);

      const ctx = await getSalesCtx();
      if (!ctx.repId) throw new Error("No rep record found for this user");

      const totalCents = payload.totalCents ?? payload.basePriceCents + payload.lineItems.reduce((a, it) => a + it.amountCents, 0);
      const dollars = totalCents / 100;
      const statusMap: Record<string, string> = { draft: "lead", estimated: "quote", booked: "sold" };
      const status = statusMap[payload.status] ?? "lead";

      const meta = { clientWriteId: payload.clientWriteId, clusterId: payload.clusterId, basePriceCents: payload.basePriceCents, lineItems: payload.lineItems };
      const userNotes = (payload.notes ?? "").trim();
      const notes = (userNotes ? userNotes : "") + encodeMobileMeta(meta);

      let existingId: string | null = null;
      const salesRes = await blockApi.get<{ items?: any[]; sales?: any[] }>(
        `/v1/sales?property_id=${encodeURIComponent(payload.stopId)}&limit=25`
      );
      const items = salesRes?.items ?? salesRes?.sales ?? [];
      for (const r of items) {
        const m = extractMobileMeta<any>(r.notes);
        if (m?.clientWriteId === payload.clientWriteId) {
          existingId = r.id;
          break;
        }
      }

      let sale: any;
      if (existingId) {
        const res = await blockApi.put<{ sale: any }>(`/v1/sales/${encodeURIComponent(existingId)}`, { price: dollars, status, notes });
        sale = res?.sale;
      } else {
        const res = await blockApi.post<{ sale: any }>("/v1/sales", {
          property_id: payload.stopId,
          status,
          price: dollars,
          notes
        });
        sale = res?.sale;
      }

      return {
        id: sale?.id,
        clientWriteId: payload.clientWriteId,
        clusterId: payload.clusterId,
        stopId: payload.stopId,
        status: payload.status,
        basePriceCents: payload.basePriceCents,
        lineItems: payload.lineItems,
        notes: payload.notes ?? null,
        totalCents,
        updatedAt: sale?.updated_at ?? new Date().toISOString()
      } as Quote;
    });
  },

  async listQuotesForStop(stopId: string): Promise<Quote[]> {
    return guard(async () => {
      if (config.mockMode) return await mockServer.listQuotesForStop(stopId);

      const ctx = await getSalesCtx();
      if (!ctx.repId) throw new Error("No rep record found for this user");

      const res = await blockApi.get<{ items?: any[]; sales?: any[] }>(
        `/v1/sales?property_id=${encodeURIComponent(stopId)}&limit=50`
      );
      const items = res?.items ?? res?.sales ?? [];

      return items.map((r: any) => {
        const meta = extractMobileMeta<any>(r.notes);
        const basePriceCents = typeof meta?.basePriceCents === "number" ? meta.basePriceCents : 0;
        const lineItems = Array.isArray(meta?.lineItems) ? meta.lineItems : [];
        const totalCents =
          typeof r.price === "number"
            ? Math.round(r.price * 100)
            : typeof r.price === "string"
              ? Math.round(Number(r.price) * 100)
              : basePriceCents + (lineItems ?? []).reduce((a: number, it: any) => a + (it?.amountCents ?? 0), 0);

        const status = r.status === "sold" ? "booked" : r.status === "quote" ? "estimated" : "draft";
        const notesOnly = typeof r.notes === "string" ? r.notes.split("\n\n---\nNOVASALES_META:")[0] : null;

        return {
          id: r.id,
          clientWriteId: meta?.clientWriteId ?? r.id,
          clusterId: meta?.clusterId ?? "unknown",
          stopId,
          status,
          basePriceCents,
          lineItems,
          notes: notesOnly,
          totalCents,
          updatedAt: r.updated_at
        } as Quote;
      });
    });
  }
};
