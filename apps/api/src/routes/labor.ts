import type { FastifyInstance } from 'fastify';
import { createServiceClient } from '../lib/supabase.js';
import { requireAnyAuthed, requireManager } from './_helpers.js';
import { audit } from '../lib/audit.js';
import { PosthogEvents } from '@blockd2d/shared';
import { capture } from '../lib/posthog.js';

async function getLaborerIdForProfile(service: any, org_id: string, profile_id: string) {
  const { data } = await service.from('laborers').select('id').eq('org_id', org_id).eq('profile_id', profile_id).single();
  return data?.id as string | null;
}

export async function laborRoutes(app: FastifyInstance) {
  // labor self
  app.get('/me', async (req, reply) => {
    const ctx = requireAnyAuthed(req);
    if (ctx.role !== 'labor' && ctx.role !== 'admin' && ctx.role !== 'manager') return reply.code(403).send({ error: 'Forbidden' });
    const service = createServiceClient();
    const laborer_id = await getLaborerIdForProfile(service, ctx.org_id, ctx.profile_id);
    if (!laborer_id) return reply.send({ laborer: null });
    const { data } = await service.from('laborers').select('*').eq('id', laborer_id).eq('org_id', ctx.org_id).single();
    return reply.send({ laborer: data });
  });

  app.get('/jobs', async (req, reply) => {
    const ctx = requireAnyAuthed(req);
    const service = createServiceClient();
    if (ctx.role === 'labor') {
      const laborer_id = await getLaborerIdForProfile(service, ctx.org_id, ctx.profile_id);
      if (!laborer_id) return reply.code(403).send({ error: 'Laborer not provisioned' });
      const { data, error } = await service
        .from('jobs')
        .select('*')
        .eq('org_id', ctx.org_id)
        .eq('laborer_id', laborer_id)
        .order('scheduled_start', { ascending: true })
        .limit(50);
      if (error) return reply.code(400).send({ error: error.message });
      return reply.send({ jobs: data });
    }
    // managers can query all
    requireManager(req);
    const { data, error } = await service.from('jobs').select('*').eq('org_id', ctx.org_id).order('created_at', { ascending: false }).limit(200);
    if (error) return reply.code(400).send({ error: error.message });
    return reply.send({ jobs: data });
  });


  // Availability blocks (labor can manage their own availability; managers can view)
  app.get('/availability', async (req, reply) => {
    const ctx = requireAnyAuthed(req);
    const service = createServiceClient();

    let laborer_id: string | null = null;

    if (ctx.role === 'labor') {
      laborer_id = await getLaborerIdForProfile(service, ctx.org_id, ctx.profile_id);
      if (!laborer_id) return reply.code(403).send({ error: 'Laborer not provisioned' });
    } else {
      requireManager(req);
      laborer_id = String((req.query as any)?.laborer_id || '');
      if (!laborer_id) return reply.code(400).send({ error: 'laborer_id required' });
    }

    const { data, error } = await service
      .from('labor_availability')
      .select('*')
      .eq('org_id', ctx.org_id)
      .eq('laborer_id', laborer_id)
      .order('day_of_week');
    if (error) return reply.code(400).send({ error: error.message });
    return reply.send({ laborer_id, availability: data || [] });
  });

  // Replace availability for a laborer (labor self only for MVP)
  app.put('/availability', async (req, reply) => {
    const ctx = requireAnyAuthed(req);
    const service = createServiceClient();
    if (ctx.role !== 'labor') return reply.code(403).send({ error: 'Forbidden' });

    const laborer_id = await getLaborerIdForProfile(service, ctx.org_id, ctx.profile_id);
    if (!laborer_id) return reply.code(403).send({ error: 'Laborer not provisioned' });

    const blocks: Array<any> = Array.isArray((req.body as any)?.blocks) ? (req.body as any).blocks : [];
    // clear then insert
    await service.from('labor_availability').delete().eq('org_id', ctx.org_id).eq('laborer_id', laborer_id);
    if (blocks.length > 0) {
      const rows = blocks.map((b) => ({
        org_id: ctx.org_id,
        laborer_id,
        day_of_week: Number(b.day_of_week),
        start_time: String(b.start_time),
        end_time: String(b.end_time),
        timezone: String(b.timezone || 'America/Indiana/Indianapolis')
      }));
      const { error } = await service.from('labor_availability').insert(rows);
      if (error) return reply.code(400).send({ error: error.message });
    }

    await audit(ctx.org_id, ctx.profile_id, 'labor.availability_updated', { type: 'laborer', id: laborer_id }, { count: blocks.length });
    return reply.send({ ok: true });
  });

  // Time off
  app.get('/time-off', async (req, reply) => {
    const ctx = requireAnyAuthed(req);
    const service = createServiceClient();

    let laborer_id: string | null = null;

    if (ctx.role === 'labor') {
      laborer_id = await getLaborerIdForProfile(service, ctx.org_id, ctx.profile_id);
      if (!laborer_id) return reply.code(403).send({ error: 'Laborer not provisioned' });
    } else {
      requireManager(req);
      laborer_id = String((req.query as any)?.laborer_id || '');
      if (!laborer_id) return reply.code(400).send({ error: 'laborer_id required' });
    }

    const { data, error } = await service
      .from('labor_time_off')
      .select('*')
      .eq('org_id', ctx.org_id)
      .eq('laborer_id', laborer_id)
      .order('start_at', { ascending: false })
      .limit(200);
    if (error) return reply.code(400).send({ error: error.message });
    return reply.send({ laborer_id, time_off: data || [] });
  });

  app.post('/time-off', async (req, reply) => {
    const ctx = requireAnyAuthed(req);
    const service = createServiceClient();
    if (ctx.role !== 'labor') return reply.code(403).send({ error: 'Forbidden' });

    const laborer_id = await getLaborerIdForProfile(service, ctx.org_id, ctx.profile_id);
    if (!laborer_id) return reply.code(403).send({ error: 'Laborer not provisioned' });

    const body: any = req.body || {};
    const start_at = String(body.start_at || '');
    const end_at = String(body.end_at || '');
    const reason = body.reason ? String(body.reason) : null;
    if (!start_at || !end_at) return reply.code(400).send({ error: 'start_at and end_at required' });

    const { data, error } = await service
      .from('labor_time_off')
      .insert({ org_id: ctx.org_id, laborer_id, start_at, end_at, reason })
      .select('*')
      .single();
    if (error) return reply.code(400).send({ error: error.message });

    await audit(ctx.org_id, ctx.profile_id, 'labor.timeoff_created', { type: 'time_off', id: data.id }, {});
    return reply.send({ time_off: data });
  });

  app.delete('/time-off/:id', async (req, reply) => {
    const ctx = requireAnyAuthed(req);
    const service = createServiceClient();
    if (ctx.role !== 'labor') return reply.code(403).send({ error: 'Forbidden' });

    const laborer_id = await getLaborerIdForProfile(service, ctx.org_id, ctx.profile_id);
    if (!laborer_id) return reply.code(403).send({ error: 'Laborer not provisioned' });

    const { id } = req.params as any;
    const { error } = await service.from('labor_time_off').delete().eq('org_id', ctx.org_id).eq('laborer_id', laborer_id).eq('id', id);
    if (error) return reply.code(400).send({ error: error.message });

    await audit(ctx.org_id, ctx.profile_id, 'labor.timeoff_deleted', { type: 'time_off', id }, {});
    return reply.send({ ok: true });
  });

  app.post('/jobs/:id/start', async (req, reply) => {
    const ctx = requireAnyAuthed(req);
    const { id } = req.params as any;
    const service = createServiceClient();

    if (ctx.role === 'labor') {
      const laborer_id = await getLaborerIdForProfile(service, ctx.org_id, ctx.profile_id);
      const { data: job } = await service.from('jobs').select('*').eq('id', id).eq('org_id', ctx.org_id).single();
      if (!job || job.laborer_id !== laborer_id) return reply.code(403).send({ error: 'Forbidden' });
    } else requireManager(req);

    const { data, error } = await service
      .from('jobs')
      .update({ status: 'in_progress', started_at: new Date().toISOString() })
      .eq('id', id)
      .eq('org_id', ctx.org_id)
      .select('*')
      .single();
    if (error) return reply.code(400).send({ error: error.message });

    await audit(ctx.org_id, ctx.profile_id, 'job.started', { type: 'job', id }, {});
    await capture(PosthogEvents.JOB_STARTED, ctx.profile_id, { org_id: ctx.org_id, role: ctx.role, job_id: id });

    return reply.send({ job: data });
  });

  app.post('/jobs/:id/complete', async (req, reply) => {
    const ctx = requireAnyAuthed(req);
    const { id } = req.params as any;
    const service = createServiceClient();

    if (ctx.role === 'labor') {
      const laborer_id = await getLaborerIdForProfile(service, ctx.org_id, ctx.profile_id);
      const { data: job } = await service.from('jobs').select('*').eq('id', id).eq('org_id', ctx.org_id).single();
      if (!job || job.laborer_id !== laborer_id) return reply.code(403).send({ error: 'Forbidden' });
    } else requireManager(req);

    const { data, error } = await service
      .from('jobs')
      .update({ status: 'complete', completed_at: new Date().toISOString() })
      .eq('id', id)
      .eq('org_id', ctx.org_id)
      .select('*')
      .single();
    if (error) return reply.code(400).send({ error: error.message });

    await audit(ctx.org_id, ctx.profile_id, 'job.completed', { type: 'job', id }, {});
    await capture(PosthogEvents.JOB_COMPLETED, ctx.profile_id, { org_id: ctx.org_id, role: ctx.role, job_id: id });

    return reply.send({ job: data });
  });

  app.post('/jobs/:id/photo', async (req, reply) => {
    const ctx = requireAnyAuthed(req);
    const { id } = req.params as any;
    const body: any = req.body || {};
    const filename = String(body.filename || 'photo.jpg');
    const kind = String(body.kind || 'before'); // before/after

    const service = createServiceClient();

    // access check
    if (ctx.role === 'labor') {
      const laborer_id = await getLaborerIdForProfile(service, ctx.org_id, ctx.profile_id);
      const { data: job } = await service.from('jobs').select('id,laborer_id').eq('id', id).eq('org_id', ctx.org_id).single();
      if (!job || job.laborer_id !== laborer_id) return reply.code(403).send({ error: 'Forbidden' });
    } else requireManager(req);

    const path = `${ctx.org_id}/jobs/${id}/${kind}/${Date.now()}_${filename}`;
    const { data, error } = await service.storage.from('job-photos').createSignedUploadUrl(path);
    if (error) return reply.code(400).send({ error: error.message });
    return reply.send({ upload: data, storage_path: path });
  });

  // manager endpoints
  app.get('/laborers', async (req, reply) => {
    const ctx = requireManager(req);
    const service = createServiceClient();
    const { data, error } = await service.from('laborers').select('*').eq('org_id', ctx.org_id).order('name');
    if (error) return reply.code(400).send({ error: error.message });
    return reply.send({ laborers: data });
  });

  app.post('/jobs', async (req, reply) => {
    const ctx = requireManager(req);
    const body: any = req.body || {};
    const sale_id = String(body.sale_id || '');
    if (!sale_id) return reply.code(400).send({ error: 'sale_id required' });

    const service = createServiceClient();
    const { data, error } = await service
      .from('jobs')
      .insert({
        org_id: ctx.org_id,
        sale_id,
        laborer_id: body.laborer_id ?? null,
        scheduled_start: body.scheduled_start ?? null,
        scheduled_end: body.scheduled_end ?? null,
        status: 'scheduled'
      })
      .select('*')
      .single();
    if (error) return reply.code(400).send({ error: error.message });

    await audit(ctx.org_id, ctx.profile_id, 'job.created', { type: 'job', id: data.id }, { sale_id });
    return reply.send({ job: data });
  });
}
