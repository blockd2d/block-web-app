import { createServiceClient } from '../lib/supabase';
import { requireManager } from './_helpers';
export async function auditRoutes(app) {
    app.get('/', async (req, reply) => {
        const ctx = requireManager(req);
        const service = createServiceClient();
        const q = req.query;
        const limit = Math.min(200, Math.max(10, Number(q.limit || 100)));
        const { data, error } = await service
            .from('audit_log')
            .select('*')
            .eq('org_id', ctx.org_id)
            .order('created_at', { ascending: false })
            .limit(limit);
        if (error)
            return reply.code(400).send({ error: error.message });
        return reply.send({ audit: data });
    });
}
//# sourceMappingURL=audit.js.map