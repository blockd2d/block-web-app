import { z } from 'zod';
import { createServiceClient } from '../lib/supabase';
import { requireAnyAuthed, requireManager } from './_helpers';
import { audit } from '../lib/audit';
import { env } from '../lib/env';
const SendSchema = z.object({
    thread_id: z.string().uuid().optional(),
    to: z.string().min(5).optional(), // E.164 preferred
    body: z.string().min(1).max(2000),
    rep_id: z.string().uuid().optional(),
    property_id: z.string().uuid().optional(),
    intervene: z.boolean().optional()
});
const ThreadQuerySchema = z.object({
    q: z.string().optional(),
    status: z.string().optional(),
    rep_id: z.string().uuid().optional(),
    county_id: z.string().uuid().optional(),
    property_id: z.string().uuid().optional(),
    limit: z.coerce.number().min(1).max(200).default(50)
});
async function repForProfile(service, org_id, profile_id) {
    const { data } = await service
        .from('reps')
        .select('id,name')
        .eq('org_id', org_id)
        .eq('profile_id', profile_id)
        .single();
    return data || null;
}
function sanitizePreview(body) {
    return (body || '').replace(/\s+/g, ' ').trim().slice(0, 160);
}
function featureInterveneEnabled() {
    return String(process.env.FEATURE_MESSAGES_INTERVENE || 'false') === 'true';
}
function twimlOk() {
    return '<?xml version="1.0" encoding="UTF-8"?><Response></Response>';
}
export async function messagesRoutes(app) {
    // Thread list for managers/admins (reps only see their own assigned threads)
    app.get('/threads', async (req, reply) => {
        const ctx = requireAnyAuthed(req);
        const service = createServiceClient();
        const q = ThreadQuerySchema.parse(req.query || {});
        let query = service
            .from('message_threads')
            .select('id,org_id,customer_phone,rep_id,property_id,status,last_message_at,last_message_preview,created_at')
            .eq('org_id', ctx.org_id)
            .order('last_message_at', { ascending: false })
            .limit(q.limit);
        if (q.status)
            query = query.eq('status', q.status);
        if (q.property_id)
            query = query.eq('property_id', q.property_id);
        // Reps can only see threads assigned to them
        if (ctx.role === 'rep') {
            const rep = await repForProfile(service, ctx.org_id, ctx.profile_id);
            if (!rep)
                return reply.send({ items: [], threads: [] });
            query = query.eq('rep_id', rep.id);
        }
        else {
            if (q.rep_id)
                query = query.eq('rep_id', q.rep_id);
        }
        const { data: threads, error } = await query;
        if (error)
            return reply.code(400).send({ error: error.message });
        const threadRows = threads || [];
        // Hydrate reps + properties + counties for UI convenience
        const repIds = Array.from(new Set(threadRows.map((t) => t.rep_id).filter(Boolean)));
        const propIds = Array.from(new Set(threadRows.map((t) => t.property_id).filter(Boolean)));
        const repsPromise = repIds.length
            ? service.from('reps').select('id,name').eq('org_id', ctx.org_id).in('id', repIds)
            : Promise.resolve({ data: [] });
        const propsPromise = propIds.length
            ? service.from('properties').select('id,address1,city,state,zip,county_id').eq('org_id', ctx.org_id).in('id', propIds)
            : Promise.resolve({ data: [] });
        const [{ data: repsData }, { data: propsData }] = await Promise.all([repsPromise, propsPromise]);
        const reps = repsData || [];
        const props = propsData || [];
        const repById = new Map(reps.map((r) => [r.id, r.name]));
        const propById = new Map(props.map((p) => [p.id, p]));
        const countyIds = Array.from(new Set(props.map((p) => p.county_id).filter(Boolean)));
        const { data: countiesData } = countyIds.length
            ? await service.from('counties').select('id,name,state').eq('org_id', ctx.org_id).in('id', countyIds)
            : { data: [] };
        const counties = countiesData || [];
        const countyById = new Map(counties.map((c) => [c.id, `${c.name}, ${c.state}`]));
        let items = threadRows.map((t) => {
            const prop = t.property_id ? propById.get(t.property_id) : undefined;
            const countyName = prop?.county_id ? countyById.get(prop.county_id) : null;
            const propAddr = prop
                ? `${prop.address1 ?? ''}${prop.city ? `, ${prop.city}` : ''}${prop.state ? `, ${prop.state}` : ''}${prop.zip ? ` ${prop.zip}` : ''}`
                : null;
            return {
                id: t.id,
                customer_phone: t.customer_phone,
                status: t.status,
                rep_id: t.rep_id,
                rep_name: t.rep_id ? repById.get(t.rep_id) ?? null : null,
                property_id: t.property_id,
                property_address: propAddr,
                county_id: prop?.county_id ?? null,
                county_name: countyName ?? null,
                last_message_at: t.last_message_at,
                last_message_preview: t.last_message_preview,
                created_at: t.created_at
            };
        });
        if (q.county_id)
            items = items.filter((i) => i.county_id === q.county_id);
        if (q.q) {
            const needle = q.q.toLowerCase();
            items = items.filter((i) => (i.customer_phone || '').toLowerCase().includes(needle) ||
                (i.property_address || '').toLowerCase().includes(needle) ||
                (i.last_message_preview || '').toLowerCase().includes(needle) ||
                (i.rep_name || '').toLowerCase().includes(needle));
        }
        return reply.send({ items, threads: items });
    });
    // Messages list for a thread
    app.get('/threads/:id/messages', async (req, reply) => {
        const ctx = requireAnyAuthed(req);
        const { id } = req.params;
        const limit = Math.min(200, Math.max(1, Number(req.query?.limit || 200)));
        const service = createServiceClient();
        // Authorization: reps can only read their assigned threads
        if (ctx.role === 'rep') {
            const rep = await repForProfile(service, ctx.org_id, ctx.profile_id);
            if (!rep)
                return reply.code(404).send({ error: 'Thread not found' });
            const { data: thread } = await service
                .from('message_threads')
                .select('id,rep_id')
                .eq('org_id', ctx.org_id)
                .eq('id', id)
                .single();
            const threadRow = thread;
            if (!threadRow || threadRow.rep_id !== rep.id)
                return reply.code(404).send({ error: 'Thread not found' });
        }
        const { data, error } = await service
            .from('messages')
            .select('id,thread_id,direction,body,sent_at,from_phone,to_phone,sent_by_rep_id,sent_by_profile_id,twilio_sid,status,created_at')
            .eq('org_id', ctx.org_id)
            .eq('thread_id', id)
            .order('sent_at', { ascending: true })
            .order('created_at', { ascending: true })
            .limit(limit);
        if (error)
            return reply.code(400).send({ error: error.message });
        return reply.send({ items: data || [], messages: data || [] });
    });
    // Convenience endpoint (rep-mobile legacy): thread + messages
    app.get('/threads/:id', async (req, reply) => {
        const ctx = requireAnyAuthed(req);
        const { id } = req.params;
        const service = createServiceClient();
        const { data: thread } = await service
            .from('message_threads')
            .select('*')
            .eq('org_id', ctx.org_id)
            .eq('id', id)
            .single();
        if (!thread)
            return reply.code(404).send({ error: 'Thread not found' });
        if (ctx.role === 'rep') {
            const rep = await repForProfile(service, ctx.org_id, ctx.profile_id);
            if (!rep || thread.rep_id !== rep.id)
                return reply.code(404).send({ error: 'Thread not found' });
        }
        const { data: messages } = await service
            .from('messages')
            .select('id,thread_id,direction,body,sent_at,from_phone,to_phone,sent_by_rep_id,sent_by_profile_id,twilio_sid,status,created_at')
            .eq('org_id', ctx.org_id)
            .eq('thread_id', id)
            .order('sent_at', { ascending: true })
            .order('created_at', { ascending: true })
            .limit(200);
        return reply.send({ thread, messages: messages || [] });
    });
    // Send message (outbound). All Twilio work must happen in the backend worker/service layer.
    app.post('/send', async (req, reply) => {
        const ctx = requireAnyAuthed(req);
        // Reps can always send. Managers/admins can only send if feature flag is enabled.
        if (ctx.role !== 'rep') {
            if (!featureInterveneEnabled()) {
                return reply.code(403).send({ error: 'Manager sending disabled (FEATURE_MESSAGES_INTERVENE=false)' });
            }
            if (ctx.role !== 'admin' && ctx.role !== 'manager')
                return reply.code(403).send({ error: 'Forbidden' });
        }
        const body = SendSchema.parse(req.body ?? {});
        const service = createServiceClient();
        const senderRep = ctx.role === 'rep' ? await repForProfile(service, ctx.org_id, ctx.profile_id) : null;
        // Resolve / create thread
        let thread = null;
        if (body.thread_id) {
            const { data } = await service
                .from('message_threads')
                .select('id,customer_phone,rep_id,property_id,status')
                .eq('org_id', ctx.org_id)
                .eq('id', body.thread_id)
                .single();
            thread = data;
            if (!thread)
                return reply.code(404).send({ error: 'Thread not found' });
            // Reps can only send on their own assigned threads
            if (ctx.role === 'rep') {
                if (!senderRep || thread.rep_id !== senderRep.id)
                    return reply.code(403).send({ error: 'Not allowed' });
            }
        }
        else {
            if (!body.to)
                return reply.code(400).send({ error: 'to or thread_id is required' });
            let repId = body.rep_id || null;
            if (ctx.role === 'rep')
                repId = senderRep?.id || null;
            const now = new Date().toISOString();
            const { data, error } = await service
                .from('message_threads')
                .upsert({
                org_id: ctx.org_id,
                customer_phone: body.to,
                rep_id: repId,
                property_id: body.property_id || null,
                status: 'open',
                last_message_at: now,
                last_message_preview: sanitizePreview(body.body)
            }, { onConflict: 'org_id,customer_phone' })
                .select('*')
                .single();
            if (error)
                return reply.code(400).send({ error: error.message });
            thread = data;
        }
        // Determine outbound "from" number
        const { data: settings } = await service.from('org_settings').select('twilio_number').eq('org_id', ctx.org_id).maybeSingle();
        const fromNumber = settings?.twilio_number || env.TWILIO_NUMBER || null;
        const sentAt = new Date().toISOString();
        const { data: msg, error: msgErr } = await service
            .from('messages')
            .insert({
            org_id: ctx.org_id,
            thread_id: thread.id,
            direction: 'outbound',
            body: body.body,
            sent_at: sentAt,
            status: 'queued',
            from_phone: fromNumber,
            to_phone: thread.customer_phone,
            sent_by_profile_id: ctx.profile_id,
            sent_by_rep_id: senderRep?.id || null
        })
            .select('*')
            .single();
        if (msgErr)
            return reply.code(400).send({ error: msgErr.message });
        await service
            .from('message_threads')
            .update({ last_message_at: sentAt, last_message_preview: sanitizePreview(body.body) })
            .eq('org_id', ctx.org_id)
            .eq('id', thread.id);
        await audit(ctx.org_id, ctx.profile_id, 'message.sent', { type: 'message_thread', id: thread.id }, { direction: 'outbound' });
        await service.from('jobs_queue').insert({
            org_id: ctx.org_id,
            type: 'twilio_send_sms',
            status: 'queued',
            payload: { thread_id: thread.id, message_id: msg.id }
        });
        return reply.send({ ok: true, thread_id: thread.id, message: msg });
    });
    app.post('/threads/:id/reassign', async (req, reply) => {
        const ctx = requireManager(req);
        const { id } = req.params;
        const body = z.object({ rep_id: z.string().uuid().nullable() }).parse(req.body ?? {});
        const service = createServiceClient();
        const { data, error } = await service
            .from('message_threads')
            .update({ rep_id: body.rep_id })
            .eq('org_id', ctx.org_id)
            .eq('id', id)
            .select('*')
            .single();
        if (error)
            return reply.code(400).send({ error: error.message });
        await audit(ctx.org_id, ctx.profile_id, 'thread.reassigned', { type: 'message_thread', id }, { rep_id: body.rep_id });
        return reply.send({ thread: data });
    });
    app.post('/threads/:id/status', async (req, reply) => {
        const ctx = requireManager(req);
        const { id } = req.params;
        const body = z.object({ status: z.string().min(1) }).parse(req.body ?? {});
        const service = createServiceClient();
        const { data, error } = await service
            .from('message_threads')
            .update({ status: body.status })
            .eq('org_id', ctx.org_id)
            .eq('id', id)
            .select('*')
            .single();
        if (error)
            return reply.code(400).send({ error: error.message });
        await audit(ctx.org_id, ctx.profile_id, 'thread.status', { type: 'message_thread', id }, { status: body.status });
        return reply.send({ thread: data });
    });
    // Convenience thread actions for ops UI
    app.post('/threads/:id/resolve', async (req, reply) => {
        const ctx = requireManager(req);
        const { id } = req.params;
        const service = createServiceClient();
        const { data, error } = await service
            .from('message_threads')
            .update({ status: 'resolved' })
            .eq('org_id', ctx.org_id)
            .eq('id', id)
            .select('*')
            .single();
        if (error)
            return reply.code(400).send({ error: error.message });
        await audit(ctx.org_id, ctx.profile_id, 'thread.resolved', { type: 'message_thread', id }, {});
        return reply.send({ thread: data });
    });
    app.post('/threads/:id/dnk', async (req, reply) => {
        const ctx = requireManager(req);
        const { id } = req.params;
        const service = createServiceClient();
        const { data: thread, error: tErr } = await service
            .from('message_threads')
            .select('id, property_id')
            .eq('org_id', ctx.org_id)
            .eq('id', id)
            .single();
        const threadRow = thread;
        if (tErr || !threadRow)
            return reply.code(404).send({ error: 'Thread not found' });
        const { data, error } = await service
            .from('message_threads')
            .update({ status: 'dnk' })
            .eq('org_id', ctx.org_id)
            .eq('id', id)
            .select('*')
            .single();
        if (error)
            return reply.code(400).send({ error: error.message });
        // Best-effort: mark the underlying property as DNK so clustering/exports can respect it.
        if (threadRow.property_id) {
            const { data: prop } = await service
                .from('properties')
                .select('id,tags')
                .eq('org_id', ctx.org_id)
                .eq('id', threadRow.property_id)
                .maybeSingle();
            const propRow = prop;
            if (propRow) {
                const tags = { ...(propRow.tags || {}), dnk: true };
                await service.from('properties').update({ tags }).eq('org_id', ctx.org_id).eq('id', threadRow.property_id);
            }
        }
        await audit(ctx.org_id, ctx.profile_id, 'thread.dnk', { type: 'message_thread', id }, {});
        return reply.send({ thread: data });
    });
    // Twilio inbound webhook (kept under /v1/messages for convenience)
    app.post('/twilio/inbound', async (req, reply) => {
        // Twilio sends x-www-form-urlencoded
        const From = String(req.body?.From || '').trim();
        const To = String(req.body?.To || '').trim();
        const Body = String(req.body?.Body || '').trim();
        const MessageSid = String(req.body?.MessageSid || '').trim();
        if (!From || !To || !Body) {
            return reply.type('text/xml').send(twimlOk());
        }
        const service = createServiceClient();
        // Determine org from the To number
        const { data: orgRow } = await service
            .from('org_settings')
            .select('org_id,twilio_number')
            .eq('twilio_number', To)
            .maybeSingle();
        const org_id = orgRow?.org_id;
        if (!org_id) {
            // Unknown org/number — acknowledge but do nothing
            return reply.type('text/xml').send(twimlOk());
        }
        const now = new Date().toISOString();
        const { data: thread, error: tErr } = await service
            .from('message_threads')
            .upsert({
            org_id,
            customer_phone: From,
            status: 'open',
            last_message_at: now,
            last_message_preview: sanitizePreview(Body)
        }, { onConflict: 'org_id,customer_phone' })
            .select('*')
            .single();
        if (tErr || !thread)
            return reply.type('text/xml').send(twimlOk());
        await service.from('messages').insert({
            org_id,
            thread_id: thread.id,
            direction: 'inbound',
            body: Body,
            twilio_sid: MessageSid || null,
            sent_at: now,
            status: 'received',
            from_phone: From,
            to_phone: To
        });
        await service
            .from('message_threads')
            .update({ last_message_at: now, last_message_preview: sanitizePreview(Body) })
            .eq('org_id', org_id)
            .eq('id', thread.id);
        return reply.type('text/xml').send(twimlOk());
    });
}
//# sourceMappingURL=messages.js.map