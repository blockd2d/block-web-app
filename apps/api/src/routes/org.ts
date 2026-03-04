import type { FastifyInstance } from 'fastify';
import { createServiceClient } from '../lib/supabase.js';
import { requireRoles } from './_helpers.js';

export async function orgRoutes(app: FastifyInstance) {
  /**
   * GET /v1/org/members
   * List all profiles (accounts) in the current user's organization.
   * Admin only.
   */
  app.get('/members', async (req, reply) => {
    const ctx = requireRoles(req, ['admin']);
    const service = createServiceClient();
    const { data, error } = await service
      .from('profiles')
      .select('id, org_id, role, name, email, created_at')
      .eq('org_id', ctx.org_id)
      .order('created_at', { ascending: false })
      .limit(500);
    if (error) return reply.code(400).send({ error: error.message });
    return reply.send({ members: data || [] });
  });
}
