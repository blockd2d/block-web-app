import type { FastifyInstance } from 'fastify';
import { InteractionCreateSchema, PosthogEvents } from '@blockd2d/shared';
import { createServiceClient } from '../lib/supabase.js';
import { requireAnyAuthed } from './_helpers.js';
import { audit } from '../lib/audit.js';
import { capture } from '../lib/posthog.js';

async function getRepIdForProfile(service: any, org_id: string, profile_id: string) {
  const { data } = await service.from('reps').select('id').eq('org_id', org_id).eq('profile_id', profile_id).single();
  return (data?.id as string) || null;
}

export async function interactionsRoutes(app: FastifyInstance) {
  app.post('/', async (req, reply) => {
    const ctx = requireAnyAuthed(req);
    if (ctx.role === 'labor') return reply.code(403).send({ error: 'Forbidden' });

    const body = InteractionCreateSchema.parse(req.body ?? {});
    const service = createServiceClient();

    let rep_id: string | null = null;
    if (ctx.role === 'rep') rep_id = await getRepIdForProfile(service, ctx.org_id, ctx.profile_id);
    else rep_id = (req.body as any)?.rep_id || null;

    const { data, error } = await service
      .from('interactions')
      .insert({
        org_id: ctx.org_id,
        rep_id,
        property_id: body.property_id,
        outcome: body.outcome,
        notes: body.notes ?? null,
        followup_at: body.followup_at ?? null
      })
      .select('*')
      .single();

    if (error) return reply.code(400).send({ error: error.message });

    await audit(ctx.org_id, ctx.profile_id, 'interaction.created', { type: 'interaction', id: data.id }, { outcome: body.outcome, property_id: body.property_id });
    await capture(PosthogEvents.INTERACTION_LOGGED, ctx.profile_id, {
      org_id: ctx.org_id,
      role: ctx.role,
      rep_id: rep_id,
      property_id: body.property_id,
      outcome: body.outcome
    });

    return reply.send({ interaction: data });
  });

  app.get('/', async (req, reply) => {
    const ctx = requireAnyAuthed(req);
    const service = createServiceClient();

    let query = service.from('interactions').select('*').eq('org_id', ctx.org_id).order('created_at', { ascending: false }).limit(200);

    if (ctx.role === 'rep') {
      const repId = await getRepIdForProfile(service, ctx.org_id, ctx.profile_id);
      query = query.eq('rep_id', repId);
    }

    if (ctx.role === 'labor') return reply.code(403).send({ error: 'Forbidden' });

    const { data, error } = await query;
    if (error) return reply.code(400).send({ error: error.message });
    return reply.send({ interactions: data });
  });
}
