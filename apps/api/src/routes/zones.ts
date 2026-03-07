import type { FastifyInstance } from 'fastify';
import { centroid } from '@blockd2d/shared';
import bbox from '@turf/bbox';
import booleanPointInPolygon from '@turf/boolean-point-in-polygon';
import { createServiceClient } from '../lib/supabase.js';
import { pickClusterColor } from '../lib/colors.js';
import { requireManager } from './_helpers.js';
import type { SupabaseClient } from '@supabase/supabase-js';

const PROPERTIES_BBOX_LIMIT = 50_000;

function polygonCentroid(geojson: GeoJSON.Polygon): { lat: number; lng: number } {
  const ring = geojson.coordinates?.[0];
  if (!ring || !Array.isArray(ring) || ring.length === 0) return { lat: 0, lng: 0 };
  const points = ring.map((c) => ({ lat: c[1], lng: c[0] }));
  const closed = points.length > 1 && points[0].lat === points[points.length - 1].lat && points[0].lng === points[points.length - 1].lng;
  const pts = closed ? points.slice(0, -1) : points;
  return centroid(pts);
}

function polygonBbox(geojson: GeoJSON.Polygon): [number, number, number, number] {
  return bbox({ type: 'Feature', properties: {}, geometry: geojson }) as [number, number, number, number];
}

interface PropRow {
  id: string;
  lat: number | null;
  lng: number | null;
  value_estimate: number | null;
}

async function findPropertiesInPolygon(
  service: SupabaseClient,
  org_id: string,
  geojson: GeoJSON.Polygon
): Promise<{ id: string; value_estimate: number }[]> {
  const [minLng, minLat, maxLng, maxLat] = polygonBbox(geojson);
  const { data, error } = await service
    .from('properties')
    .select('id, lat, lng, value_estimate')
    .eq('org_id', org_id)
    .gte('lat', minLat)
    .lte('lat', maxLat)
    .gte('lng', minLng)
    .lte('lng', maxLng)
    .limit(PROPERTIES_BBOX_LIMIT);
  if (error) throw error;
  const rows = (data as PropRow[]) ?? [];
  const inside: { id: string; value_estimate: number }[] = [];
  const poly = { type: 'Feature' as const, properties: {}, geometry: geojson };
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
    const body = req.body as { name?: string; geojson?: GeoJSON.Polygon; zones?: GeoJSON.Polygon[] };
    const name = typeof body?.name === 'string' ? body.name.trim() || 'Drawn zones' : 'Drawn zones';

    let zones: GeoJSON.Polygon[];
    if (Array.isArray(body?.zones) && body.zones.length > 0) {
      zones = body.zones.filter((z): z is GeoJSON.Polygon => z != null && typeof z === 'object' && z.type === 'Polygon' && Array.isArray(z.coordinates));
      if (zones.length === 0) return reply.code(400).send({ error: 'zones must be a non-empty array of GeoJSON Polygons' });
    } else if (body?.geojson && typeof body.geojson === 'object' && body.geojson.type === 'Polygon' && Array.isArray(body.geojson.coordinates)) {
      zones = [body.geojson];
    } else {
      return reply.code(400).send({ error: 'geojson (Polygon) or zones (Polygon[]) required' });
    }

    const service = createServiceClient();

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

    const clusterSetId = clusterSet!.id;

    for (let i = 0; i < zones.length; i++) {
      const geojson = zones[i];
      const center = polygonCentroid(geojson);
      let props: { id: string; value_estimate: number }[];
      try {
        props = await findPropertiesInPolygon(service, ctx.org_id, geojson);
      } catch (e: any) {
        return reply.code(503).send({ error: e?.message ?? 'Failed to find properties in zone' });
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

      const { data: inserted, error: clusterErr } = await service
        .from('clusters')
        .insert({
          org_id: ctx.org_id,
          cluster_set_id: clusterSetId,
          center_lat: center.lat,
          center_lng: center.lng,
          hull_geojson: geojson,
          stats_json: stats,
          color: pickClusterColor(i)
        })
        .select('id')
        .single();
      if (clusterErr) return reply.code(400).send({ error: clusterErr.message });

      const clusterId = inserted!.id;
      for (let j = 0; j < props.length; j += 1000) {
        const batch = props.slice(j, j + 1000).map((p) => ({
          org_id: ctx.org_id,
          cluster_id: clusterId,
          property_id: p.id
        }));
        const { error: cpErr } = await service.from('cluster_properties').insert(batch);
        if (cpErr) return reply.code(503).send({ error: cpErr.message });
      }
    }

    return reply.send({ cluster_set_id: clusterSetId });
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
