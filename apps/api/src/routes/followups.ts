import type { FastifyInstance } from 'fastify';
import { FollowupCreateSchema } from '@blockd2d/shared';
import { createServiceClient } from '../lib/supabase.js';
import { requireAnyAuthed, requireManager } from './_helpers.js';
import { audit } from '../lib/audit.js';

async function getRepIdForProfile(service: any, org_id: string, profile_id: string) {
  const { data } = await service.from('reps').select('id').eq('org_id', org_id).eq('profile_id', profile_id).single();
  return data?.id as string | null;
}

export async function followupsRoutes(app: FastifyInstance) {
  app.get('/', async (req, reply) => {
    const ctx = requireAnyAuthed(req);
    const q = req.query as any;
    const status = q.status ? String(q.status) : 'open';
    const limit = Math.min(200, Math.max(10, Number(q.limit || 100)));
    const service = createServiceClient();

    let query = service
      .from('followups')
      .select('*')
      .eq('org_id', ctx.org_id)
      .eq('status', status)
      .order('due_at', { ascending: true })
      .limit(limit);

    if (ctx.role === 'rep') {
      const repId = await getRepIdForProfile(service, ctx.org_id, ctx.profile_id);
      if (!repId) return reply.code(403).send({ error: 'Rep not provisioned' });
      query = query.eq('rep_id', repId);
    }

    const { data, error } = await query;
    if (error) return reply.code(400).send({ error: error.message });
    return reply.send({ followups: data });
  });

  app.post('/', async (req, reply) => {
    const ctx = requireAnyAuthed(req);
    const body = FollowupCreateSchema.parse(req.body ?? {});
    const service = createServiceClient();

    let rep_id: string | null = null;
    if (ctx.role === 'rep') rep_id = await getRepIdForProfile(service, ctx.org_id, ctx.profile_id);
    else rep_id = (req.body as any)?.rep_id || null;

    if (!rep_id) return reply.code(400).send({ error: 'rep_id required' });

    const { data, error } = await service
      .from('followups')
      .insert({ org_id: ctx.org_id, rep_id, property_id: body.property_id, due_at: body.due_at, notes: body.notes ?? null })
      .select('*')
      .single();
    if (error) return reply.code(400).send({ error: error.message });

    await audit(ctx.org_id, ctx.profile_id, 'followup.created', { type: 'followup', id: data.id }, {});
    return reply.send({ followup: data });
  });

  app.put('/:id', async (req, reply) => {
    const ctx = requireAnyAuthed(req);
    const { id } = req.params as any;
    const body: any = req.body || {};
    const service = createServiceClient();

    // access check for rep
    if (ctx.role === 'rep') {
      const repId = await getRepIdForProfile(service, ctx.org_id, ctx.profile_id);
      const { data: f } = await service.from('followups').select('id, rep_id').eq('id', id).eq('org_id', ctx.org_id).single();
      if (!f || f.rep_id !== repId) return reply.code(403).send({ error: 'Forbidden' });
    }

    const { data, error } = await service
      .from('followups')
      .update({ due_at: body.due_at, status: body.status, notes: body.notes })
      .eq('id', id)
      .eq('org_id', ctx.org_id)
      .select('*')
      .single();
    if (error) return reply.code(400).send({ error: error.message });

    await audit(ctx.org_id, ctx.profile_id, 'followup.updated', { type: 'followup', id }, {});
    return reply.send({ followup: data });
  });
}
