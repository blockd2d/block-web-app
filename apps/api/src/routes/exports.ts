import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { createServiceClient } from '../lib/supabase';
import { requireManager } from './_helpers';

const CreateExportSchema = z.object({
  type: z.enum(['assignments', 'sales']).default('assignments'),
  // Optional scoping
  cluster_set_id: z.string().uuid().optional(),
  format: z.enum(['csv','json']).default('csv')
});

export async function exportsRoutes(app: FastifyInstance) {
  app.get('/', async (req, reply) => {
    const ctx = requireManager(req);
    const service = createServiceClient();
    const { data, error } = await service
      .from('exports')
      .select('*')
      .eq('org_id', ctx.org_id)
      .order('created_at', { ascending: false })
      .limit(50);
    if (error) return reply.code(400).send({ error: error.message });
    return reply.send({ items: data || [] });
  });

  app.post('/', async (req, reply) => {
    const ctx = requireManager(req);
    const body = CreateExportSchema.parse(req.body ?? {});
    const service = createServiceClient();

    const { data: exp, error } = await service
      .from('exports')
      .insert({
        org_id: ctx.org_id,
        type: body.type,
        status: 'queued'})
      .select('*')
      .single();
    if (error || !exp) return reply.code(400).send({ error: error?.message || 'Failed' });

    const workerType = body.type === 'assignments' ? 'export_assignments' : 'export_sales';

    await service.from('jobs_queue').insert({
      org_id: ctx.org_id,
      type: workerType,
      status: 'queued',
      payload: {
        export_id: exp.id,
        cluster_set_id: body.cluster_set_id || null,
        format: body.format
      }
    });

    return reply.send({ export: exp });
  });

  app.get('/:id/download', async (req, reply) => {
    const ctx = requireManager(req);
    const { id } = req.params as any;
    const service = createServiceClient();
    const { data: exp, error } = await service
      .from('exports')
      .select('*')
      .eq('id', id)
      .eq('org_id', ctx.org_id)
      .single();
    if (error || !exp) return reply.code(404).send({ error: 'Not found' });
    if (exp.status !== 'complete' || !exp.storage_path) return reply.code(400).send({ error: 'Export not ready' });

    const { data: signed, error: sErr } = await service.storage.from('exports').createSignedUrl(exp.storage_path, 60 * 10);
    if (sErr) return reply.code(400).send({ error: sErr.message });
    return reply.send({ url: signed.signedUrl });
  });
}
