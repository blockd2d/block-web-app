import type { FastifyInstance } from 'fastify';
import { centroid } from '@blockd2d/shared';
import { createServiceClient } from '../lib/supabase.js';
import { pickClusterColor } from '../lib/colors.js';
import { requireManager } from './_helpers.js';

function polygonCentroid(geojson: GeoJSON.Polygon): { lat: number; lng: number } {
  const ring = geojson.coordinates?.[0];
  if (!ring || !Array.isArray(ring) || ring.length === 0) return { lat: 0, lng: 0 };
  const points = ring.map((c) => ({ lat: c[1], lng: c[0] }));
  const closed = points.length > 1 && points[0].lat === points[points.length - 1].lat && points[0].lng === points[points.length - 1].lng;
  const pts = closed ? points.slice(0, -1) : points;
  return centroid(pts);
}

export async function zonesRoutes(app: FastifyInstance) {
  app.get('/', async (req, reply) => {
    const ctx = requireManager(req);
    const service = createServiceClient();
    const { data, error } = await service
      .from('zones')
      .select('id, name, geojson, created_at')
      .eq('org_id', ctx.org_id)
      .order('created_at', { ascending: false })
      .limit(100);
    if (error) {
      const msg = zonesTableMissing(error) ? 'Zones table not set up. Run the database migration (see apps/api/prisma/migrations/20260307000000_add_zones).' : error.message;
      return reply.code(zonesTableMissing(error) ? 503 : 400).send({ error: msg });
    }
    return reply.send({ items: data ?? [] });
  });

  app.post('/', async (req, reply) => {
    const ctx = requireManager(req);
    const body = req.body as { name?: string; geojson?: GeoJSON.Polygon };
    const name = typeof body?.name === 'string' ? body.name.trim() || 'Drawn zone' : 'Drawn zone';
    const geojson = body?.geojson;
    if (!geojson || typeof geojson !== 'object' || geojson.type !== 'Polygon' || !Array.isArray(geojson.coordinates)) {
      return reply.code(400).send({ error: 'geojson (Polygon) required' });
    }
    const service = createServiceClient();

    const { data: zone, error: zoneErr } = await service
      .from('zones')
      .insert({
        org_id: ctx.org_id,
        name,
        geojson,
        created_by: ctx.profile_id
      })
      .select('id, name, geojson, created_at')
      .single();
    if (zoneErr) {
      const msg = zonesTableMissing(zoneErr) ? 'Zones table not set up. Run the database migration (see apps/api/prisma/migrations/20260307000000_add_zones).' : zoneErr.message;
      return reply.code(zonesTableMissing(zoneErr) ? 503 : 400).send({ error: msg });
    }

    const center = polygonCentroid(geojson);
    const { data: clusterSet, error: setErr } = await service
      .from('cluster_sets')
      .insert({
        org_id: ctx.org_id,
        county_id: null,
        name,
        filters_json: { source: 'zone' },
        status: 'complete',
        progress: 100,
        created_by: ctx.profile_id,
        radius_m: null,
        min_houses: null
      })
      .select('id')
      .single();
    if (setErr) return reply.code(400).send({ error: setErr.message });

    const stats = { size: 0, total_value: 0, avg_value: 0, total_potential: 0, avg_value_estimate: 0 };
    const { error: clusterErr } = await service
      .from('clusters')
      .insert({
        org_id: ctx.org_id,
        cluster_set_id: clusterSet.id,
        center_lat: center.lat,
        center_lng: center.lng,
        hull_geojson: geojson,
        stats_json: stats,
        color: pickClusterColor(0)
      });
    if (clusterErr) return reply.code(400).send({ error: clusterErr.message });

    return reply.send({ zone, cluster_set_id: clusterSet.id });
  });
}

function zonesTableMissing(err: { message?: string; code?: string }): boolean {
  const m = (err?.message ?? '').toLowerCase();
  const code = err?.code ?? '';
  return (
    code === 'PGRST116' ||
    m === 'not found' ||
    /relation\s+["']?zones["']?\s+does not exist/i.test(m) ||
    /table\s+["']?zones["']?\s+does not exist/i.test(m)
  );
}
