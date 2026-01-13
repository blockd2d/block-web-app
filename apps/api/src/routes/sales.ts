import type { FastifyInstance } from 'fastify';
import { PosthogEvents, SaleCreateSchema } from '@blockd2d/shared';
import { createServiceClient } from '../lib/supabase';
import { audit } from '../lib/audit';
import { capture } from '../lib/posthog';
import { requireAnyAuthed, requireManager } from './_helpers';
import { getRangeWindow } from './_range';

function parseDataUrl(dataUrl: string) {
  // data:image/png;base64,....
  const m = /^data:([^;]+);base64,(.+)$/i.exec(dataUrl || '');
  if (!m) return null;
  return { mime: m[1], b64: m[2] };
}

async function getRepIdForProfile(service: any, org_id: string, profile_id: string) {
  const { data } = await service.from('reps').select('id').eq('org_id', org_id).eq('profile_id', profile_id).single();
  return (data?.id as string) || null;
}

async function assertSaleAccess(service: any, ctx: any, saleId: string) {
  if (ctx.role !== 'rep') return { ok: true, repId: null };
  const repId = await getRepIdForProfile(service, ctx.org_id, ctx.profile_id);
  if (!repId) return { ok: false, repId: null, error: 'Rep not provisioned' };
  const { data: sale } = await service
    .from('sales')
    .select('id, rep_id')
    .eq('id', saleId)
    .eq('org_id', ctx.org_id)
    .single();
  if (!sale || sale.rep_id !== repId) return { ok: false, repId, error: 'Forbidden' };
  return { ok: true, repId };
}

function clampInt(v: any, def: number, min: number, max: number) {
  const n = Number(v);
  if (!Number.isFinite(n)) return def;
  return Math.max(min, Math.min(max, Math.floor(n)));
}

function sanitizeLike(input: string) {
  // Keep it simple: strip a few special chars that can break supabase filter strings.
  return input.replace(/[,%]/g, ' ').trim();
}

function parseDateMaybe(input?: string | null, endOfDay = false) {
  if (!input) return null;
  const s = String(input).trim();
  if (!s) return null;
  // Accept YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    return new Date(s + (endOfDay ? 'T23:59:59.999Z' : 'T00:00:00.000Z'));
  }
  const d = new Date(s);
  return Number.isFinite(d.getTime()) ? d : null;
}

export async function salesRoutes(app: FastifyInstance) {
  /**
   * GET /v1/sales
   * Paginated list for the web Sales module.
   *
   * Query params (all optional):
   * - page, limit
   * - range: week|month|all (uses server window)
   * - date_from, date_to (ISO or YYYY-MM-DD)
   * - rep_id (admin/manager only)
   * - status (single) or statuses (comma-separated)
   * - q (search across customer name/phone/email/address)
   */
  app.get('/', async (req, reply) => {
    const ctx = requireAnyAuthed(req);
    const q = (req.query as any) || {};
    const page = clampInt(q.page, 1, 1, 100000);
    const limit = clampInt(q.limit, 25, 10, 100);
    const offset = (page - 1) * limit;

    const service = createServiceClient();

    // Rep scoping
    let repId: string | null = null;
    if (ctx.role === 'rep') {
      repId = await getRepIdForProfile(service, ctx.org_id, ctx.profile_id);
      if (!repId) return reply.code(403).send({ error: 'Rep not provisioned' });
    }

    // Date window
    let since: Date | null = null;
    let until: Date | null = null;
    const customFrom = parseDateMaybe(q.date_from || q.since, false);
    const customTo = parseDateMaybe(q.date_to || q.until, true);
    if (customFrom || customTo) {
      since = customFrom;
      until = customTo;
    } else {
      const { since: sinceDt, until: untilDt } = getRangeWindow(q.range).range === 'all'
        ? { since: new Date(0), until: new Date() }
        : (getRangeWindow(q.range) as any);
      since = sinceDt;
      until = untilDt;
    }

    let query = service
      .from('sales_view')
      .select('*', { count: 'exact' })
      .eq('org_id', ctx.org_id)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (since) query = query.gte('created_at', since.toISOString());
    if (until) query = query.lte('created_at', until.toISOString());

    if (ctx.role === 'rep') {
      query = query.eq('rep_id', repId);
    } else {
      const repFilter = q.rep_id ? String(q.rep_id) : null;
      if (repFilter) query = query.eq('rep_id', repFilter);
    }

    // Status filters
    const statusesRaw = (q.statuses || q.status || '') as string;
    const statuses = String(statusesRaw)
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    if (statuses.length === 1) query = query.eq('pipeline_status', statuses[0]);
    if (statuses.length > 1) query = query.in('pipeline_status', statuses);

    // Search across common fields
    const search = q.q ? sanitizeLike(String(q.q)).slice(0, 120) : '';
    if (search) {
      // Supabase `.or()` expects a comma-delimited filter string.
      query = query.or(
        `customer_name.ilike.%${search}%,customer_phone.ilike.%${search}%,customer_email.ilike.%${search}%,address1.ilike.%${search}%`
      );
    }

    const { data, error, count } = await query;
    if (error) return reply.code(400).send({ error: error.message });

    return reply.send({
      items: data || [],
      // back-compat key used by some older clients
      sales: data || [],
      page,
      limit,
      total: count || 0
    });
  });

  /**
   * GET /v1/sales/:id (detail)
   * Includes: customer info, property address, status rollups (job/payment), attachments (signed URLs), contract link, audit timeline.
   */
  app.get('/:id', async (req, reply) => {
    const ctx = requireAnyAuthed(req);
    const { id } = req.params as any;
    const service = createServiceClient();

    // Fetch the denormalized row first (fast, and gives rep_id to enforce RBAC).
    const { data: sale, error } = await service
      .from('sales_view')
      .select('*')
      .eq('org_id', ctx.org_id)
      .eq('id', id)
      .single();
    if (error || !sale) return reply.code(404).send({ error: 'Not found' });

    if (ctx.role === 'rep') {
      const repId = await getRepIdForProfile(service, ctx.org_id, ctx.profile_id);
      if (!repId) return reply.code(403).send({ error: 'Rep not provisioned' });
      if (sale.rep_id !== repId) return reply.code(403).send({ error: 'Forbidden' });
    }
    if (ctx.role === 'labor') return reply.code(403).send({ error: 'Forbidden' });

    // Attachments (signed URLs)
    const { data: attRows } = await service
      .from('sale_attachments')
      .select('id,type,storage_path,created_at')
      .eq('org_id', ctx.org_id)
      .eq('sale_id', id)
      .order('created_at', { ascending: false })
      .limit(200);

    const attachments = [] as any[];
    for (const a of attRows || []) {
      const { data: signed, error: sErr } = await service.storage.from('attachments').createSignedUrl(a.storage_path, 60 * 10);
      attachments.push({
        id: a.id,
        type: a.type,
        storage_path: a.storage_path,
        created_at: a.created_at,
        url: sErr ? null : signed.signedUrl
      });
    }

    // Contract PDF (if generated)
    const { data: contractRow } = await service
      .from('contracts')
      .select('id,storage_path,created_at')
      .eq('org_id', ctx.org_id)
      .eq('sale_id', id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    let contract: any = null;
    if (contractRow?.storage_path) {
      const { data: signed, error: cErr } = await service.storage.from('contracts').createSignedUrl(contractRow.storage_path, 60 * 10);
      contract = {
        id: contractRow.id,
        storage_path: contractRow.storage_path,
        created_at: contractRow.created_at,
        url: cErr ? null : signed.signedUrl
      };
    }

    // Audit timeline
    const { data: auditRows } = await service
      .from('audit_log')
      .select('id,action,actor_profile_id,entity_type,entity_id,meta,created_at')
      .eq('org_id', ctx.org_id)
      .eq('entity_type', 'sale')
      .eq('entity_id', id)
      .order('created_at', { ascending: false })
      .limit(200);

    return reply.send({
      sale,
      customer: {
        name: sale.customer_name || null,
        phone: sale.customer_phone || null,
        email: sale.customer_email || null,
        address: [sale.address1, sale.city, sale.state, sale.zip].filter(Boolean).join(', ') || null
      },
      attachments,
      contract,
      audit: auditRows || []
    });
  });

  /**
   * GET /v1/sales/:id/attachments
   * Returns signed URLs for attachments.
   */
  app.get('/:id/attachments', async (req, reply) => {
    const ctx = requireAnyAuthed(req);
    const { id } = req.params as any;
    const service = createServiceClient();

    const access = await assertSaleAccess(service, ctx, id);
    if (!access.ok) return reply.code(access.error === 'Rep not provisioned' ? 403 : 403).send({ error: access.error });
    if (ctx.role === 'labor') return reply.code(403).send({ error: 'Forbidden' });

    const { data: rows, error } = await service
      .from('sale_attachments')
      .select('id,type,storage_path,created_at')
      .eq('org_id', ctx.org_id)
      .eq('sale_id', id)
      .order('created_at', { ascending: false })
      .limit(200);
    if (error) return reply.code(400).send({ error: error.message });

    const attachments = [] as any[];
    for (const a of rows || []) {
      const { data: signed, error: sErr } = await service.storage.from('attachments').createSignedUrl(a.storage_path, 60 * 10);
      attachments.push({
        id: a.id,
        type: a.type,
        storage_path: a.storage_path,
        created_at: a.created_at,
        url: sErr ? null : signed.signedUrl
      });
    }

    return reply.send({ attachments });
  });

  /**
   * POST /v1/sales
   */
  app.post('/', async (req, reply) => {
    const ctx = requireAnyAuthed(req);
    const body = SaleCreateSchema.parse(req.body ?? {});
    const service = createServiceClient();

    let rep_id: string | null = null;
    if (ctx.role === 'rep') rep_id = await getRepIdForProfile(service, ctx.org_id, ctx.profile_id);
    else rep_id = (req.body as any)?.rep_id || null;

    if (!rep_id) return reply.code(400).send({ error: 'rep_id required' });

    const { data, error } = await service
      .from('sales')
      .insert({
        org_id: ctx.org_id,
        rep_id,
        property_id: body.property_id,
        status: body.status,
        price: body.price ?? null,
        service_type: body.service_type ?? null,
        notes: body.notes ?? null,
        customer_name: body.customer_name ?? null,
        customer_phone: body.customer_phone ?? null,
        customer_email: body.customer_email ?? null
      })
      .select('*')
      .single();

    if (error) return reply.code(400).send({ error: error.message });

    await audit(ctx.org_id, ctx.profile_id, 'sale.created', { type: 'sale', id: data.id }, { status: data.status, rep_id });
    await capture(PosthogEvents.SALE_CREATED, ctx.profile_id, { org_id: ctx.org_id, role: ctx.role, sale_id: data.id, rep_id });

    return reply.send({ sale: data });
  });

  /**
   * PUT /v1/sales/:id
   */
  app.put('/:id', async (req, reply) => {
    const ctx = requireAnyAuthed(req);
    const { id } = req.params as any;
    const body = SaleCreateSchema.partial().parse(req.body ?? {});
    const service = createServiceClient();

    // enforce access for rep
    if (ctx.role === 'rep') {
      const access = await assertSaleAccess(service, ctx, id);
      if (!access.ok) return reply.code(403).send({ error: access.error });
    }
    if (ctx.role === 'labor') return reply.code(403).send({ error: 'Forbidden' });

    const { data: before } = await service
      .from('sales')
      .select('id,status,price,service_type,notes,customer_name,customer_phone,customer_email')
      .eq('id', id)
      .eq('org_id', ctx.org_id)
      .maybeSingle();
    if (!before) return reply.code(404).send({ error: 'Not found' });

    const updates: any = {};
    for (const k of ['status', 'price', 'service_type', 'notes', 'customer_name', 'customer_phone', 'customer_email']) {
      if ((body as any)[k] !== undefined) updates[k] = (body as any)[k];
    }

    const { data, error } = await service
      .from('sales')
      .update(updates)
      .eq('id', id)
      .eq('org_id', ctx.org_id)
      .select('*')
      .single();

    if (error) return reply.code(400).send({ error: error.message });

    // Audit diff (small, and safe for admin/manager analytics)
    const changed: Record<string, any> = {};
    for (const [k, v] of Object.entries(updates)) {
      const prev = (before as any)[k];
      if (prev !== v) changed[k] = { from: prev ?? null, to: v ?? null };
    }

    if (changed.status) {
      await audit(ctx.org_id, ctx.profile_id, 'sale.status.changed', { type: 'sale', id }, { from: changed.status.from, to: changed.status.to });
    }
    await audit(ctx.org_id, ctx.profile_id, 'sale.updated', { type: 'sale', id }, { changed });

    return reply.send({ sale: data });
  });

  /**
   * POST /v1/sales/:id/attachments
   * Returns a signed upload URL for Supabase Storage.
   */
  app.post('/:id/attachments', async (req, reply) => {
    const ctx = requireAnyAuthed(req);
    const { id } = req.params as any;
    const body: any = req.body || {};
    const type = String(body.type || 'photo');
    const filename = String(body.filename || 'file.jpg');

    const service = createServiceClient();
    const access = await assertSaleAccess(service, ctx, id);
    if (!access.ok) return reply.code(403).send({ error: access.error });
    if (ctx.role === 'labor') return reply.code(403).send({ error: 'Forbidden' });

    const path = `${ctx.org_id}/sales/${id}/${Date.now()}_${filename}`;
    const { data, error } = await service.storage.from('attachments').createSignedUploadUrl(path);
    if (error) return reply.code(400).send({ error: error.message });

    const { data: row, error: iErr } = await service
      .from('sale_attachments')
      .insert({
        org_id: ctx.org_id,
        sale_id: id,
        type,
        storage_path: path
      })
      .select('id,type,storage_path,created_at')
      .single();
    if (iErr) return reply.code(400).send({ error: iErr.message });

    await audit(ctx.org_id, ctx.profile_id, 'sale.attachment.created', { type: 'sale', id }, { attachment_id: row.id, type });

    return reply.send({ upload: data, attachment: row });
  });

  // Rep contract signature upload (server-side upload to storage)
  app.post('/:id/signature', async (req, reply) => {
    const ctx = requireAnyAuthed(req);
    const { id } = req.params as any;
    const body: any = req.body || {};
    const dataUrl = String(body.data_url || body.dataUrl || '');
    const signer_name = body.signer_name ? String(body.signer_name) : null;
    if (!dataUrl) return reply.code(400).send({ error: 'data_url required' });

    const parsed = parseDataUrl(dataUrl);
    if (!parsed) return reply.code(400).send({ error: 'Invalid data URL' });

    const service = createServiceClient();

    // verify sale access
    if (ctx.role === 'rep') {
      const access = await assertSaleAccess(service, ctx, id);
      if (!access.ok) return reply.code(403).send({ error: access.error });
    } else {
      // allow managers/admins to attach signature too
      requireManager(req);
    }

    const buf = Buffer.from(parsed.b64, 'base64');
    const ext = parsed.mime.includes('png') ? 'png' : parsed.mime.includes('jpeg') ? 'jpg' : 'bin';
    const path = `${ctx.org_id}/sales/${id}/signature_${Date.now()}.${ext}`;
    const { error: upErr } = await service.storage.from('attachments').upload(path, buf, {
      contentType: parsed.mime,
      upsert: true
    });
    if (upErr) return reply.code(400).send({ error: upErr.message });

    await service.from('sale_attachments').insert({
      org_id: ctx.org_id,
      sale_id: id,
      type: 'signature',
      storage_path: path
    });

    await audit(ctx.org_id, ctx.profile_id, 'sale.signature.uploaded', { type: 'sale', id }, { signer_name });
    await capture(PosthogEvents.CONTRACT_SIGNED, ctx.profile_id, {
      org_id: ctx.org_id,
      role: ctx.role,
      sale_id: id
    });

    return reply.send({ ok: true, storage_path: path });
  });
}
