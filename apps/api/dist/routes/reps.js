import { RepUpsertSchema, PosthogEvents } from '@blockd2d/shared';
import { z } from 'zod';
import { createServiceClient } from '../lib/supabase';
import { requireAnyAuthed, requireManager, requireRoles } from './_helpers';
import { audit } from '../lib/audit';
import { capture } from '../lib/posthog';
async function getRepIdForProfile(service, org_id, profile_id) {
    const { data } = await service.from('reps').select('*').eq('org_id', org_id).eq('profile_id', profile_id).single();
    return data || null;
}
const RepLocationSchema = z.object({
    lat: z.number(),
    lng: z.number(),
    speed: z.number().optional().nullable(),
    heading: z.number().optional().nullable(),
    clocked_in: z.boolean().default(false),
    recorded_at: z.string().datetime().optional()
});
export async function repsRoutes(app) {
    // Rep/mobile helpers
    app.get('/me', async (req, reply) => {
        const ctx = requireAnyAuthed(req);
        const service = createServiceClient();
        const rep = await getRepIdForProfile(service, ctx.org_id, ctx.profile_id);
        return reply.send({ rep });
    });
    app.get('/me/clusters', async (req, reply) => {
        const ctx = requireRoles(req, ['rep']);
        const service = createServiceClient();
        const rep = await getRepIdForProfile(service, ctx.org_id, ctx.profile_id);
        if (!rep)
            return reply.code(404).send({ error: 'Rep profile not linked' });
        const { data, error } = await service
            .from('clusters')
            .select('id,cluster_set_id,center_lat,center_lng,hull_geojson,stats_json,color,assigned_rep_id,created_at')
            .eq('org_id', ctx.org_id)
            .eq('assigned_rep_id', rep.id)
            .order('created_at', { ascending: false })
            .limit(5000);
        if (error)
            return reply.code(400).send({ error: error.message });
        return reply.send({ clusters: data || [] });
    });
    app.post('/me/location', async (req, reply) => {
        const ctx = requireRoles(req, ['rep']);
        const service = createServiceClient();
        const rep = await getRepIdForProfile(service, ctx.org_id, ctx.profile_id);
        if (!rep)
            return reply.code(404).send({ error: 'Rep profile not linked' });
        const body = RepLocationSchema.parse(req.body ?? {});
        const at = body.recorded_at || new Date().toISOString();
        const { data, error } = await service
            .from('rep_locations')
            .insert({
            org_id: ctx.org_id,
            rep_id: rep.id,
            lat: body.lat,
            lng: body.lng,
            speed: body.speed ?? null,
            heading: body.heading ?? null,
            recorded_at: at,
            clocked_in: body.clocked_in
        })
            .select('*')
            .single();
        if (error)
            return reply.code(400).send({ error: error.message });
        return reply.send({ location: data });
    });
    // Manager: latest location per rep (for live tracking overlay)
    app.get('/locations', async (req, reply) => {
        // Alias for UI convenience
        req.url = '/locations/latest';
        return reply.redirect(302, '/v1/reps/locations/latest');
    });
    app.get('/locations/latest', async (req, reply) => {
        const ctx = requireManager(req);
        const service = createServiceClient();
        const { data, error } = await service
            .from('rep_locations_latest')
            .select('id, org_id, rep_id, lat, lng, speed, heading, clocked_in, recorded_at')
            .eq('org_id', ctx.org_id);
        if (error)
            return reply.code(400).send({ error: error.message });
        // Attach rep name
        const repIds = (data || []).map((d) => d.rep_id);
        const { data: reps } = await service.from('reps').select('id,name').eq('org_id', ctx.org_id).in('id', repIds);
        const nameById = new Map((reps || []).map((r) => [r.id, r.name]));
        const rows = (data || []).map((d) => ({ ...d, rep_name: nameById.get(d.rep_id) || null }));
        return reply.send({ locations: rows });
    });
    app.get('/', async (req, reply) => {
        const ctx = requireManager(req);
        const service = createServiceClient();
        const { data, error } = await service.from('reps').select('*').eq('org_id', ctx.org_id).order('name');
        if (error)
            return reply.code(400).send({ error: error.message });
        const items = (data || []).map((r) => ({
            ...r,
            // web back-compat
            home_base_lat: r.home_lat,
            home_base_lng: r.home_lng
        }));
        return reply.send({ items });
    });
    app.post('/', async (req, reply) => {
        const ctx = requireManager(req);
        const body = RepUpsertSchema.parse(req.body ?? {});
        const service = createServiceClient();
        const { data, error } = await service
            .from('reps')
            .insert({ org_id: ctx.org_id, name: body.name, home_lat: body.home_lat, home_lng: body.home_lng, active: body.active })
            .select('*')
            .single();
        if (error)
            return reply.code(400).send({ error: error.message });
        await audit(ctx.org_id, ctx.profile_id, 'rep.created', { type: 'rep', id: data.id }, { name: data.name });
        await capture(PosthogEvents.CLUSTER_ASSIGNED, ctx.profile_id, { org_id: ctx.org_id, role: ctx.role }); // reuse constant (fine)
        return reply.send({ rep: data });
    });
    app.put('/:id', async (req, reply) => {
        const ctx = requireManager(req);
        const { id } = req.params;
        const body = RepUpsertSchema.parse(req.body ?? {});
        const service = createServiceClient();
        const { data, error } = await service
            .from('reps')
            .update({ name: body.name, home_lat: body.home_lat, home_lng: body.home_lng, active: body.active })
            .eq('id', id)
            .eq('org_id', ctx.org_id)
            .select('*')
            .single();
        if (error)
            return reply.code(400).send({ error: error.message });
        await audit(ctx.org_id, ctx.profile_id, 'rep.updated', { type: 'rep', id }, {});
        return reply.send({ rep: data });
    });
    app.delete('/:id', async (req, reply) => {
        const ctx = requireManager(req);
        const { id } = req.params;
        const service = createServiceClient();
        const { error } = await service.from('reps').delete().eq('id', id).eq('org_id', ctx.org_id);
        if (error)
            return reply.code(400).send({ error: error.message });
        await audit(ctx.org_id, ctx.profile_id, 'rep.deleted', { type: 'rep', id }, {});
        return reply.send({ ok: true });
    });
}
//# sourceMappingURL=reps.js.map