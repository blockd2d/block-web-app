import type { FastifyInstance } from 'fastify';
import { createServiceClient } from '../lib/supabase.js';
import { requireManager } from './_helpers.js';

export async function countiesRoutes(app: FastifyInstance) {
  app.get('/', async (req, reply) => {
    const ctx = requireManager(req);
    const service = createServiceClient();
    const { data, error } = await service.from('counties').select('*').eq('org_id', ctx.org_id).order('name');
    if (error) return reply.code(400).send({ error: error.message });
    return reply.send({ items: data || [] });
  });
}
