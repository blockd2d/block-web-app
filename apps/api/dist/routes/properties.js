import { createServiceClient } from '../lib/supabase';
import { requireAnyAuthed, requireManager } from './_helpers';
export async function propertiesRoutes(app) {
    // Managers: can page large datasets with bbox and cursor
    app.get('/', async (req, reply) => {
        const ctx = requireManager(req);
        const q = req.query;
        const county_id = q.county_id ? String(q.county_id) : '';
        const bbox = q.bbox ? String(q.bbox) : null; // minLng,minLat,maxLng,maxLat
        const cursor = q.cursor ? String(q.cursor) : null;
        const limit = Math.min(5000, Math.max(50, Number(q.limit || 2000)));
        const service = createServiceClient();
        if (!county_id && !bbox) {
            return reply.code(400).send({ error: 'Provide county_id and/or bbox' });
        }
        let query = service
            .from('properties')
            .select('id,lat,lng,address1,city,state,zip,value_estimate')
            .eq('org_id', ctx.org_id)
            .order('id')
            .limit(limit);
        if (county_id)
            query = query.eq('county_id', county_id);
        if (cursor)
            query = query.gt('id', cursor);
        if (bbox) {
            const parts = bbox.split(',').map((v) => Number(v));
            if (parts.length === 4 && parts.every((n) => Number.isFinite(n))) {
                const [minLng, minLat, maxLng, maxLat] = parts;
                query = query.gte('lng', minLng).lte('lng', maxLng).gte('lat', minLat).lte('lat', maxLat);
            }
        }
        const { data, error } = await query;
        if (error)
            return reply.code(400).send({ error: error.message });
        const nextCursor = data && data.length === limit ? data[data.length - 1].id : null;
        return reply.send({ items: data || [], properties: data || [], nextCursor });
    });
    // Rep: fetch properties for a cluster (their assigned)
    app.get('/by-cluster/:clusterId', async (req, reply) => {
        const ctx = requireAnyAuthed(req);
        const { clusterId } = req.params;
        const service = createServiceClient();
        const { data: cluster } = await service
            .from('clusters')
            .select('id,assigned_rep_id,cluster_set_id')
            .eq('id', clusterId)
            .eq('org_id', ctx.org_id)
            .single();
        if (!cluster)
            return reply.code(404).send({ error: 'Not found' });
        // reps can only access assigned clusters; managers can access all
        if (ctx.role === 'rep') {
            const { data: rep } = await service.from('reps').select('id').eq('profile_id', ctx.profile_id).eq('org_id', ctx.org_id).single();
            if (!rep || rep.id !== cluster.assigned_rep_id)
                return reply.code(403).send({ error: 'Forbidden' });
        }
        const { data, error } = await service
            .from('cluster_properties')
            .select('property_id, properties:properties(id,lat,lng,address1,city,state,zip,value_estimate)')
            .eq('org_id', ctx.org_id)
            .eq('cluster_id', clusterId)
            .limit(5000);
        if (error)
            return reply.code(400).send({ error: error.message });
        const properties = (data || []).map((r) => r.properties);
        return reply.send({ properties });
    });
}
//# sourceMappingURL=properties.js.map