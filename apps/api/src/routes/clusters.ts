import type { FastifyInstance } from 'fastify';
import { createServiceClient } from '../lib/supabase';
import { requireAnyAuthed, requireManager } from './_helpers';

function haversineKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const sinDLat = Math.sin(dLat / 2);
  const sinDLng = Math.sin(dLng / 2);
  const h = sinDLat * sinDLat + Math.cos(lat1) * Math.cos(lat2) * sinDLng * sinDLng;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

async function getRepIdForProfile(service: any, org_id: string, profile_id: string) {
  const { data } = await service.from('reps').select('id').eq('org_id', org_id).eq('profile_id', profile_id).single();
  return (data?.id as string) || null;
}

export async function clustersRoutes(app: FastifyInstance) {
  // List clusters for a cluster set (used by ops map + territories)
  app.get('/', async (req, reply) => {
    const ctx = requireAnyAuthed(req);
    const q = req.query as any;
    const cluster_set_id = q.cluster_set_id ? String(q.cluster_set_id) : '';
    const limit = Math.min(5000, Math.max(1, Number(q.limit || 2000)));
    if (!cluster_set_id) return reply.code(400).send({ error: 'cluster_set_id required' });

    const service = createServiceClient();
    let repId: string | null = null;
    if (ctx.role === 'rep') {
      repId = await getRepIdForProfile(service, ctx.org_id, ctx.profile_id);
      if (!repId) return reply.code(403).send({ error: 'Forbidden' });
    }
    if (ctx.role === 'labor') return reply.code(403).send({ error: 'Forbidden' });

    let query = service
      .from('clusters')
      .select('id,cluster_set_id,assigned_rep_id,center_lat,center_lng,hull_geojson,stats_json,color,created_at')
      .eq('org_id', ctx.org_id)
      .eq('cluster_set_id', cluster_set_id)
      .order('created_at', { ascending: true })
      .limit(limit);
    if (repId) query = query.eq('assigned_rep_id', repId);

    const { data, error } = await query;
    if (error) return reply.code(400).send({ error: error.message });
    const rows = (data || []).map((c: any) => ({ ...c, polygon_geojson: (c as any).hull_geojson }));
    return reply.send({ items: rows, clusters: rows });
  });

  // Assign a single cluster
  app.post('/assign', async (req, reply) => {
    const ctx = requireManager(req);
    const body: any = req.body || {};
    const cluster_id = String(body.cluster_id || '');
    const assigned_rep_id = body.rep_id ? String(body.rep_id) : null;
    if (!cluster_id) return reply.code(400).send({ error: 'cluster_id required' });

    const service = createServiceClient();
    const { data, error } = await service
      .from('clusters')
      .update({ assigned_rep_id })
      .eq('org_id', ctx.org_id)
      .eq('id', cluster_id)
      .select('id,assigned_rep_id')
      .single();
    if (error) return reply.code(400).send({ error: error.message });
    return reply.send({ cluster: data });
  });

  // Bulk assign clusters (accepts either rep_id with cluster_ids, or mapping)
  app.post('/assign-bulk', async (req, reply) => {
    const ctx = requireManager(req);
    const body: any = req.body || {};
    const service = createServiceClient();

    const mapping = (body.mapping || body.rep_id_by_cluster) as Record<string, string> | undefined;
    const rep_id = body.rep_id ? String(body.rep_id) : null;
    const cluster_ids = Array.isArray(body.cluster_ids) ? body.cluster_ids.map(String) : null;

    if (mapping && typeof mapping === 'object') {
      const updates = Object.entries(mapping).map(([cluster_id, assigned_rep_id]) => ({ cluster_id, assigned_rep_id }));
      for (const u of updates) {
        await service.from('clusters').update({ assigned_rep_id: u.assigned_rep_id || null }).eq('org_id', ctx.org_id).eq('id', u.cluster_id);
      }
      return reply.send({ ok: true, updated: updates.length });
    }

    if (!rep_id || !cluster_ids || cluster_ids.length === 0) {
      return reply.code(400).send({ error: 'Provide either mapping, or rep_id + cluster_ids[]' });
    }

    const { error } = await service
      .from('clusters')
      .update({ assigned_rep_id: rep_id })
      .eq('org_id', ctx.org_id)
      .in('id', cluster_ids);
    if (error) return reply.code(400).send({ error: error.message });
    return reply.send({ ok: true, updated: cluster_ids.length });
  });

  app.get('/:id', async (req, reply) => {
    const ctx = requireAnyAuthed(req);
    const { id } = req.params as any;
    const service = createServiceClient();

    const { data: cluster, error } = await service
      .from('clusters')
      .select('*')
      .eq('org_id', ctx.org_id)
      .eq('id', id)
      .single();

    if (error || !cluster) return reply.code(404).send({ error: 'Not found' });

    if (ctx.role === 'rep') {
      const repId = await getRepIdForProfile(service, ctx.org_id, ctx.profile_id);
      if (!repId || cluster.assigned_rep_id !== repId) return reply.code(403).send({ error: 'Forbidden' });
    }

    if (ctx.role === 'labor') {
      // Labor should not see clusters (MVP)
      return reply.code(403).send({ error: 'Forbidden' });
    }

    return reply.send({ cluster });
  });

  // Properties in a cluster
  app.get('/:id/properties', async (req, reply) => {
    const ctx = requireAnyAuthed(req);
    const { id } = req.params as any;
    const service = createServiceClient();

    const { data: cluster } = await service
      .from('clusters')
      .select('id, assigned_rep_id')
      .eq('org_id', ctx.org_id)
      .eq('id', id)
      .single();

    if (!cluster) return reply.code(404).send({ error: 'Cluster not found' });

    if (ctx.role === 'rep') {
      const repId = await getRepIdForProfile(service, ctx.org_id, ctx.profile_id);
      if (!repId || cluster.assigned_rep_id !== repId) return reply.code(403).send({ error: 'Forbidden' });
    }

    if (ctx.role === 'labor') return reply.code(403).send({ error: 'Forbidden' });

    // Join via cluster_properties
    const { data, error } = await service
      .from('cluster_properties')
      .select('property_id, properties:property_id(id,lat,lng,address1,city,state,zip,value_estimate,tags,county_id,created_at)')
      .eq('org_id', ctx.org_id)
      .eq('cluster_id', id)
      .limit(50000);

    if (error) return reply.code(400).send({ error: error.message });

    const properties = (data || []).map((r: any) => r.properties).filter(Boolean);

    return reply.send({ properties });
  });

  // Cluster inspector payload (summary stats + outcome counts + rep distance)
  app.get('/:id/inspector', async (req, reply) => {
    const ctx = requireAnyAuthed(req);
    const { id } = req.params as any;
    const service = createServiceClient();

    const { data: cluster, error } = await service
      .from('clusters')
      .select('id,org_id,cluster_set_id,center_lat,center_lng,assigned_rep_id,stats_json,color')
      .eq('org_id', ctx.org_id)
      .eq('id', id)
      .single();
    if (error || !cluster) return reply.code(404).send({ error: 'Not found' });

    if (ctx.role === 'rep') {
      const repId = await getRepIdForProfile(service, ctx.org_id, ctx.profile_id);
      if (!repId || cluster.assigned_rep_id !== repId) return reply.code(403).send({ error: 'Forbidden' });
    }
    if (ctx.role === 'labor') return reply.code(403).send({ error: 'Forbidden' });

    const center = { lat: Number(cluster.center_lat), lng: Number(cluster.center_lng) };

    // Properties and value rollups
    const { data: cp, error: cpErr } = await service
      .from('cluster_properties')
      .select('property_id, properties:property_id(id,value_estimate)')
      .eq('org_id', ctx.org_id)
      .eq('cluster_id', id)
      .limit(50000);
    if (cpErr) return reply.code(400).send({ error: cpErr.message });

    const propRows = (cp || []).map((r: any) => r.properties).filter(Boolean);
    const property_ids = propRows.map((p: any) => p.id);
    const total_properties = property_ids.length;
    const total_potential = propRows.reduce((acc: number, p: any) => acc + (p.value_estimate ? Number(p.value_estimate) : 0), 0);
    const avg_value = total_properties > 0 ? total_potential / total_properties : 0;

    // Latest interaction per property for outcome breakdown
    const outcome_counts: Record<string, number> = {};
    let worked = 0;
    let unworked = total_properties;
    let followups_due = 0;
    const now = Date.now();

    if (property_ids.length > 0) {
      const latestByProperty = new Map<string, any>();
      // query interactions in chunks to avoid very large IN lists
      for (let i = 0; i < property_ids.length; i += 1000) {
        const chunk = property_ids.slice(i, i + 1000);
        const { data: interactions, error: iErr } = await service
          .from('interactions')
          .select('property_id,outcome,created_at,followup_at')
          .eq('org_id', ctx.org_id)
          .in('property_id', chunk)
          .order('created_at', { ascending: false })
          .limit(200000);
        if (iErr) return reply.code(400).send({ error: iErr.message });
        for (const it of interactions || []) {
          if (!latestByProperty.has(it.property_id)) latestByProperty.set(it.property_id, it);
        }
      }

      worked = latestByProperty.size;
      unworked = Math.max(0, total_properties - worked);
      for (const it of latestByProperty.values()) {
        const k = String(it.outcome || 'unknown');
        outcome_counts[k] = (outcome_counts[k] || 0) + 1;
        if (it.followup_at) {
          const t = new Date(it.followup_at).getTime();
          if (Number.isFinite(t) && t <= now) followups_due += 1;
        }
      }
    }

    // Rep distances (home base → cluster center)
    const { data: reps } = await service
      .from('reps')
      .select('id,name,home_lat,home_lng')
      .eq('org_id', ctx.org_id)
      .limit(500);
    const repDistances = (reps || [])
      .filter((r: any) => r.home_lat != null && r.home_lng != null)
      .map((r: any) => ({
        id: r.id,
        name: r.name,
        distance_km: haversineKm({ lat: Number(r.home_lat), lng: Number(r.home_lng) }, center)
      }))
      .sort((a: any, b: any) => a.distance_km - b.distance_km);

    const nearest_rep = repDistances[0] || null;
    const assigned_rep_distance_km = cluster.assigned_rep_id
      ? repDistances.find((r: any) => r.id === cluster.assigned_rep_id)?.distance_km ?? null
      : null;

    const status_rollups = {
      unworked,
      leads: outcome_counts['lead'] || 0,
      quotes: outcome_counts['quote'] || 0,
      sold: outcome_counts['sold'] || 0,
      dnk: outcome_counts['do_not_knock'] || 0
    };

    const nearest_rep_payload = nearest_rep ? {
      rep_id: nearest_rep.id,
      rep_name: nearest_rep.name,
      distance_miles: Number((nearest_rep.distance_km * 0.621371).toFixed(2))
    } : null;

    const assigned_rep_distance_miles = assigned_rep_distance_km != null
      ? Number((Number(assigned_rep_distance_km) * 0.621371).toFixed(2))
      : null;

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
      }
    });

  });
}
