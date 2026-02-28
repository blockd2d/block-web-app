import type { FastifyInstance } from 'fastify';
import { ClusterSetCreateSchema, PosthogEvents } from '@blockd2d/shared';
import { createServiceClient } from '../lib/supabase.js';
import { requireManager } from './_helpers.js';
import { audit } from '../lib/audit.js';
import { capture } from '../lib/posthog.js';

export async function clusterSetsRoutes(app: FastifyInstance) {
  app.get('/', async (req, reply) => {
    const ctx = requireManager(req);
    const service = createServiceClient();
    const { data, error } = await service
      .from('cluster_sets')
      .select('*')
      .eq('org_id', ctx.org_id)
      .order('created_at', { ascending: false })
      .limit(50);
    if (error) return reply.code(400).send({ error: error.message });
    return reply.send({ items: data || [] });
  });

  app.post('/', async (req, reply) => {
    const ctx = requireManager(req);
    const body = ClusterSetCreateSchema.parse(req.body ?? {});
    const service = createServiceClient();
    const { data: set, error } = await service
      .from('cluster_sets')
      .insert({
        org_id: ctx.org_id,
        county_id: body.county_id,
        filters_json: body.filters,
        name: body.name || 'Cluster Set',
        radius_m: body.filters.radius_m,
        min_houses: body.filters.min_houses,
        status: 'queued',
        progress: 0,
        created_by: ctx.profile_id
      })
      .select('*')
      .single();

    if (error || !set) return reply.code(400).send({ error: error?.message || 'failed' });

    await service.from('jobs_queue').insert({
      org_id: ctx.org_id,
      type: 'cluster_generate',
      status: 'queued',
      payload: { cluster_set_id: set.id }
    });

    await audit(ctx.org_id, ctx.profile_id, 'clusterset.created', { type: 'cluster_set', id: set.id }, { county_id: body.county_id, filters: body.filters });
    await capture(PosthogEvents.CLUSTERSET_CREATED, ctx.profile_id, { org_id: ctx.org_id, role: ctx.role, county_id: body.county_id, cluster_set_id: set.id });

    return reply.send({ cluster_set: set });
  });

  app.get('/:id', async (req, reply) => {
    const ctx = requireManager(req);
    const { id } = req.params as any;
    const service = createServiceClient();
    const { data, error } = await service.from('cluster_sets').select('*').eq('id', id).eq('org_id', ctx.org_id).single();
    if (error) return reply.code(404).send({ error: 'Not found' });
    return reply.send({ cluster_set: data });
  });

  app.patch('/:id', async (req, reply) => {
    const ctx = requireManager(req);
    const { id } = req.params as any;
    const body = req.body as { name?: string };
    const name = typeof body?.name === 'string' ? body.name.trim() : undefined;
    if (name === undefined) return reply.code(400).send({ error: 'name required' });
    const service = createServiceClient();
    const { data, error } = await service
      .from('cluster_sets')
      .update({ name })
      .eq('id', id)
      .eq('org_id', ctx.org_id)
      .select('*')
      .single();
    if (error) return reply.code(400).send({ error: error.message });
    return reply.send({ cluster_set: data });
  });

  app.delete('/:id', async (req, reply) => {
    const ctx = requireManager(req);
    const { id } = req.params as any;
    const service = createServiceClient();
    const { error: deleteErr } = await service
      .from('cluster_sets')
      .delete()
      .eq('id', id)
      .eq('org_id', ctx.org_id);
    if (deleteErr) return reply.code(400).send({ error: deleteErr.message });
    await audit(ctx.org_id, ctx.profile_id, 'clusterset.deleted', { type: 'cluster_set', id }, {});
    return reply.send({ ok: true });
  });

  app.get('/:id/clusters', async (req, reply) => {
    const ctx = requireManager(req);
    const { id } = req.params as any;
    const service = createServiceClient();
    const { data, error } = await service
      .from('clusters')
      .select('*')
      .eq('org_id', ctx.org_id)
      .eq('cluster_set_id', id);
    if (error) return reply.code(400).send({ error: error.message });
    return reply.send({ items: data || [] });
  });

  app.get('/:id/suggest-assignments', async (req, reply) => {
    const ctx = requireManager(req);
    const { id } = req.params as any;
    const service = createServiceClient();

    const { data: set, error: setErr } = await service.from('cluster_sets').select('id, org_id').eq('id', id).eq('org_id', ctx.org_id).single();
    if (setErr || !set) return reply.code(404).send({ error: 'Cluster set not found' });

    // Fetch active reps
    const { data: reps, error: repErr } = await service.from('reps').select('id,name,home_lat,home_lng,active').eq('org_id', ctx.org_id).eq('active', true).order('name');
    if (repErr) return reply.code(400).send({ error: repErr.message });

    const { data: clusters, error: cErr } = await service
      .from('clusters')
      .select('id,assigned_rep_id,center_lat,center_lng,stats_json')
      .eq('org_id', ctx.org_id)
      .eq('cluster_set_id', id)
      .limit(20000);
    if (cErr) return reply.code(400).send({ error: cErr.message });

    const repsArr = reps || [];
    const clustersArr = clusters || [];
    if (repsArr.length === 0 || clustersArr.length === 0) return reply.send({ suggestions: [] });

    // Distance helper (Haversine)
    function miles(aLat: number, aLng: number, bLat: number, bLng: number) {
      const R = 3958.8; // mi
      const dLat = (bLat - aLat) * Math.PI / 180;
      const dLng = (bLng - aLng) * Math.PI / 180;
      const s1 = Math.sin(dLat / 2);
      const s2 = Math.sin(dLng / 2);
      const c = 2 * Math.asin(Math.sqrt(s1 * s1 + Math.cos(aLat * Math.PI / 180) * Math.cos(bLat * Math.PI / 180) * s2 * s2));
      return R * c;
    }

    const getVal = (c: any) => Number(c?.stats_json?.total_potential ?? c?.stats_json?.total_value ?? 0);

    const totalValue = clustersArr.reduce((acc: number, c: any) => acc + getVal(c), 0);
    const targetValue = totalValue / Math.max(1, repsArr.length);

    const assignedByRep: Record<string, number> = {};
    for (const r of repsArr) assignedByRep[r.id] = 0;

    // Greedy: assign high-value clusters first
    const sorted = clustersArr
      .slice()
      .sort((a: any, b: any) => (getVal(b) - getVal(a)));

    const suggestions: Array<{ cluster_id: string; rep_id: string; distance_miles: number }> = [];

    for (const c of sorted) {
      let best: any = null;
      for (const r of repsArr) {
        if (r.home_lat == null || r.home_lng == null) continue;
        const d = miles(r.home_lat, r.home_lng, c.center_lat, c.center_lng);
        const value = getVal(c);
        const load = assignedByRep[r.id] / Math.max(1, targetValue);
        const score = d * 1.0 + load * 2.0 - (value / 1000000) * 0.25; // tune weights
        if (!best || score < best.score) best = { rep_id: r.id, distance_miles: d, score };
      }
      if (!best) continue;
      suggestions.push({ cluster_id: c.id, rep_id: best.rep_id, distance_miles: Number(best.distance_miles.toFixed(2)) });
      assignedByRep[best.rep_id] += getVal(c);
    }

    return reply.send({ suggestions });
  });

  app.post('/:id/assign', async (req, reply) => {
    const ctx = requireManager(req);
    const { id } = req.params as any;
    const body: any = req.body || {};
    const assignments: Array<{ cluster_id: string; rep_id: string | null }> = body.assignments || [];
    if (!Array.isArray(assignments) || assignments.length === 0) return reply.code(400).send({ error: 'assignments required' });

    const service = createServiceClient();
    for (const a of assignments) {
      await service
        .from('clusters')
        .update({ assigned_rep_id: a.rep_id })
        .eq('id', a.cluster_id)
        .eq('org_id', ctx.org_id)
        .eq('cluster_set_id', id);
    }

    await audit(ctx.org_id, ctx.profile_id, 'cluster.assign.bulk', { type: 'cluster_set', id }, { count: assignments.length });
    await capture(PosthogEvents.CLUSTER_ASSIGNED, ctx.profile_id, { org_id: ctx.org_id, role: ctx.role, cluster_set_id: id, count: assignments.length });

    return reply.send({ ok: true });
  });
}