import type { FastifyInstance } from 'fastify';
import { createServiceClient } from '../lib/supabase.js';
import { requireManager } from './_helpers.js';

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
    const { data: zone, error } = await service
      .from('zones')
      .insert({
        org_id: ctx.org_id,
        name,
        geojson,
        created_by: ctx.profile_id
      })
      .select('id, name, geojson, created_at')
      .single();
    if (error) {
      const msg = zonesTableMissing(error) ? 'Zones table not set up. Run the database migration (see apps/api/prisma/migrations/20260307000000_add_zones).' : error.message;
      return reply.code(zonesTableMissing(error) ? 503 : 400).send({ error: msg });
    }
    return reply.send({ zone });
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
