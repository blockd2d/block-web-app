import type { FastifyInstance } from 'fastify';
import { createServiceClient } from '../lib/supabase';
import { requireAnyAuthed, requireManager } from './_helpers';
import { audit } from '../lib/audit';
import { PosthogEvents } from '@blockd2d/shared';
import { capture } from '../lib/posthog';

function parseDataUrl(dataUrl: string) {
  const m = /^data:([^;]+);base64,(.+)$/i.exec(dataUrl || '');
  if (!m) return null;
  return { mime: m[1], b64: m[2] };
}

async function getLaborerIdForProfile(service: any, org_id: string, profile_id: string) {
  const { data } = await service.from('laborers').select('id').eq('org_id', org_id).eq('profile_id', profile_id).single();
  return data?.id as string | null;
}

export async function jobsRoutes(app: FastifyInstance) {
  // List jobs (labor sees assigned; manager sees all)
  app.get('/', async (req, reply) => {
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
    requireManager(req);
    const { data, error } = await service.from('jobs').select('*').eq('org_id', ctx.org_id).order('created_at', { ascending: false }).limit(200);
    if (error) return reply.code(400).send({ error: error.message });
    return reply.send({ jobs: data });
  });

  // Job detail (joins sale/property/attachments/payments)
  app.get('/:id', async (req, reply) => {
    const ctx = requireAnyAuthed(req);
    const { id } = req.params as any;
    const service = createServiceClient();

    const { data: job, error } = await service.from('jobs').select('*').eq('id', id).eq('org_id', ctx.org_id).single();
    if (error) return reply.code(400).send({ error: error.message });
    if (!job) return reply.code(404).send({ error: 'Not found' });

    if (ctx.role === 'labor') {
      const laborer_id = await getLaborerIdForProfile(service, ctx.org_id, ctx.profile_id);
      if (!laborer_id || job.laborer_id !== laborer_id) return reply.code(403).send({ error: 'Forbidden' });
    } else {
      requireManager(req);
    }

    const { data: sale } = await service
      .from('sales')
      .select('id, rep_id, property_id, status, value, customer_phone, notes, created_at')
      .eq('id', job.sale_id)
      .eq('org_id', ctx.org_id)
      .single();

    let property: any = null;
    if (sale?.property_id) {
      const { data: p } = await service
        .from('properties')
        .select('id, county_id, address1, city, state, zip, lat, lng, value_estimate')
        .eq('id', sale.property_id)
        .eq('org_id', ctx.org_id)
        .single();
      property = p || null;
    }

    let rep: any = null;
    if (sale?.rep_id) {
      const { data: r } = await service.from('reps').select('id, name').eq('id', sale.rep_id).eq('org_id', ctx.org_id).single();
      rep = r || null;
    }

    // Sale attachments (rep before photos etc)
    const attachments: any[] = [];
    if (sale?.id) {
      const { data: rows } = await service
        .from('sale_attachments')
        .select('id, type, storage_path, created_at')
        .eq('org_id', ctx.org_id)
        .eq('sale_id', sale.id)
        .order('created_at', { ascending: false })
        .limit(200);

      for (const a of rows || []) {
        let signed_url: string | null = null;
        try {
          const { data: s } = await service.storage.from('attachments').createSignedUrl(a.storage_path, 60 * 30);
          signed_url = s?.signedUrl || null;
        } catch {
          signed_url = null;
        }
        attachments.push({ ...a, signed_url });
      }
    }

    // Job photos (labor after photos + signature)
    const { data: jobPhotoRows } = await service
      .from('job_photos')
      .select('id, kind, storage_path, created_at')
      .eq('org_id', ctx.org_id)
      .eq('job_id', id)
      .order('created_at', { ascending: false })
      .limit(200);

    const job_photos: any[] = [];
    for (const p of jobPhotoRows || []) {
      let signed_url: string | null = null;
      try {
        const { data: s } = await service.storage.from('job-photos').createSignedUrl(p.storage_path, 60 * 30);
        signed_url = s?.signedUrl || null;
      } catch {
        signed_url = null;
      }
      job_photos.push({ ...p, signed_url });
    }

    // Payments
    const { data: payments } = await service
      .from('payments')
      .select('id, amount, currency, status, checkout_url, stripe_checkout_session_id, created_at')
      .eq('org_id', ctx.org_id)
      .eq('job_id', id)
      .order('created_at', { ascending: false })
      .limit(50);

    // Contract (optional)
    let contract: any = null;
    if (sale?.id) {
      const { data: c } = await service.from('contracts').select('id, pdf_path, status, created_at').eq('org_id', ctx.org_id).eq('sale_id', sale.id).single();
      if (c?.pdf_path) {
        try {
          const { data: s } = await service.storage.from('contracts').createSignedUrl(c.pdf_path, 60 * 10);
          contract = { ...c, signed_url: s?.signedUrl || null };
        } catch {
          contract = { ...c, signed_url: null };
        }
      }
    }

    return reply.send({ job, sale, property, rep, contract, attachments, job_photos, payments: payments || [] });
  });

  // Create job (manager)
  app.post('/', async (req, reply) => {
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

  // Start / complete
  app.post('/:id/start', async (req, reply) => {
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

  app.post('/:id/complete', async (req, reply) => {
    const ctx = requireAnyAuthed(req);
    const { id } = req.params as any;
    const service = createServiceClient();

    if (ctx.role === 'labor') {
      const laborer_id = await getLaborerIdForProfile(service, ctx.org_id, ctx.profile_id);
      const { data: job } = await service.from('jobs').select('*').eq('id', id).eq('org_id', ctx.org_id).single();
      if (!job || job.laborer_id !== laborer_id) return reply.code(403).send({ error: 'Forbidden' });
    } else requireManager(req);

    const body: any = req.body || {};
    const completion_notes = body.completion_notes ? String(body.completion_notes) : null;
    const upcharge_notes = body.upcharge_notes ? String(body.upcharge_notes) : null;
    const combinedNotes =
      completion_notes || upcharge_notes
        ? [completion_notes ? `Completion: ${completion_notes}` : null, upcharge_notes ? `Upcharge: ${upcharge_notes}` : null]
            .filter(Boolean)
            .join('\n')
        : null;

    const { data, error } = await service
      .from('jobs')
      .update({ status: 'complete', completed_at: new Date().toISOString(), completion_notes: combinedNotes })
      .eq('id', id)
      .eq('org_id', ctx.org_id)
      .select('*')
      .single();
    if (error) return reply.code(400).send({ error: error.message });

    await audit(ctx.org_id, ctx.profile_id, 'job.completed', { type: 'job', id }, {});
    await capture(PosthogEvents.JOB_COMPLETED, ctx.profile_id, { org_id: ctx.org_id, role: ctx.role, job_id: id });

    return reply.send({ job: data });
  });

  // Signed upload URL for job photos (before/after)
  app.post('/:id/photos', async (req, reply) => {
    const ctx = requireAnyAuthed(req);
    const { id } = req.params as any;
    const body: any = req.body || {};
    const filename = String(body.filename || 'photo.jpg');
    const kind = String(body.kind || 'after'); // before/after
    const dataUrl = body.data_url ? String(body.data_url) : body.dataUrl ? String(body.dataUrl) : '';

    const service = createServiceClient();

    if (ctx.role === 'labor') {
      const laborer_id = await getLaborerIdForProfile(service, ctx.org_id, ctx.profile_id);
      const { data: job } = await service.from('jobs').select('id,laborer_id').eq('id', id).eq('org_id', ctx.org_id).single();
      if (!job || job.laborer_id !== laborer_id) return reply.code(403).send({ error: 'Forbidden' });
    } else requireManager(req);

    // If client provides a data URL, upload server-side (simplifies mobile MVP)
    if (dataUrl) {
      const parsed = parseDataUrl(dataUrl);
      if (!parsed) return reply.code(400).send({ error: 'Invalid data URL' });
      const buf = Buffer.from(parsed.b64, 'base64');
      const ext = parsed.mime.includes('png') ? 'png' : parsed.mime.includes('jpeg') ? 'jpg' : 'bin';
      const path = `${ctx.org_id}/jobs/${id}/${kind}/${Date.now()}.${ext}`;
      const { error: upErr } = await service.storage.from('job-photos').upload(path, buf, {
        contentType: parsed.mime,
        upsert: true
      });
      if (upErr) return reply.code(400).send({ error: upErr.message });

      // Record metadata for audit / UI
      await service.from('job_photos').insert({ org_id: ctx.org_id, job_id: id, kind, storage_path: path });
      await audit(ctx.org_id, ctx.profile_id, 'job.photo.uploaded', { type: 'job', id }, { kind });

      return reply.send({ ok: true, storage_path: path });
    }

    // Otherwise, return a signed upload URL
    const path = `${ctx.org_id}/jobs/${id}/${kind}/${Date.now()}_${filename}`;
    const { data, error } = await service.storage.from('job-photos').createSignedUploadUrl(path);
    if (error) return reply.code(400).send({ error: error.message });

    // Track intent (actual upload can happen later)
    await service.from('job_photos').insert({ org_id: ctx.org_id, job_id: id, kind, storage_path: path });
    await audit(ctx.org_id, ctx.profile_id, 'job.photo.signed_url.created', { type: 'job', id }, { kind });

    return reply.send({ upload: data, storage_path: path });
  });

  // List job photos (manager + assigned labor)
  app.get('/:id/photos', async (req, reply) => {
    const ctx = requireAnyAuthed(req);
    const { id } = req.params as any;
    const service = createServiceClient();

    if (ctx.role === 'labor') {
      const laborer_id = await getLaborerIdForProfile(service, ctx.org_id, ctx.profile_id);
      const { data: job } = await service.from('jobs').select('id,laborer_id').eq('id', id).eq('org_id', ctx.org_id).single();
      if (!job || job.laborer_id !== laborer_id) return reply.code(403).send({ error: 'Forbidden' });
    } else requireManager(req);

    const { data, error } = await service
      .from('job_photos')
      .select('id,kind,storage_path,created_at')
      .eq('org_id', ctx.org_id)
      .eq('job_id', id)
      .order('created_at', { ascending: false })
      .limit(100);
    if (error) return reply.code(400).send({ error: error.message });

    // Attach short-lived signed URLs for preview
    const photos = [] as any[];
    for (const p of data || []) {
      let signed_url: string | null = null;
      try {
        const { data: s } = await service.storage.from('job-photos').createSignedUrl(p.storage_path, 60 * 30);
        signed_url = s?.signedUrl || null;
      } catch {
        signed_url = null;
      }
      photos.push({ ...p, signed_url });
    }

    return reply.send({ photos });
  });
}
