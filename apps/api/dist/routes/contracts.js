import { createServiceClient } from '../lib/supabase';
import { requireAnyAuthed, requireManager } from './_helpers';
import { audit } from '../lib/audit';
import { capture } from '../lib/posthog';
import { PosthogEvents } from '@blockd2d/shared';
async function getRepIdForProfile(service, org_id, profile_id) {
    const { data } = await service.from('reps').select('id').eq('org_id', org_id).eq('profile_id', profile_id).single();
    return data?.id;
}
export async function contractsRoutes(app) {
    app.post('/generate', async (req, reply) => {
        const ctx = requireAnyAuthed(req);
        const body = req.body || {};
        const sale_id = String(body.sale_id || '');
        if (!sale_id)
            return reply.code(400).send({ error: 'sale_id required' });
        const service = createServiceClient();
        const { data: sale } = await service.from('sales').select('id,rep_id').eq('id', sale_id).eq('org_id', ctx.org_id).single();
        if (!sale)
            return reply.code(404).send({ error: 'Sale not found' });
        if (ctx.role === 'rep') {
            const repId = await getRepIdForProfile(service, ctx.org_id, ctx.profile_id);
            if (!repId || sale.rep_id !== repId)
                return reply.code(403).send({ error: 'Forbidden' });
        }
        else {
            requireManager(req);
        }
        // Queue job
        await service.from('jobs_queue').insert({ org_id: ctx.org_id, type: 'contract_generate', status: 'queued', payload: { sale_id } });
        await audit(ctx.org_id, ctx.profile_id, 'contract.generate.queued', { type: 'sale', id: sale_id }, {});
        await capture(PosthogEvents.CONTRACT_GENERATED, ctx.profile_id, { org_id: ctx.org_id, role: ctx.role, sale_id });
        return reply.send({ ok: true });
    });
    app.get('/by-sale/:saleId', async (req, reply) => {
        const ctx = requireAnyAuthed(req);
        const { saleId } = req.params;
        const service = createServiceClient();
        const { data: contract } = await service.from('contracts').select('*').eq('sale_id', saleId).eq('org_id', ctx.org_id).single();
        if (!contract)
            return reply.code(404).send({ error: 'Not found' });
        // Rep access check
        if (ctx.role === 'rep') {
            const repId = await getRepIdForProfile(service, ctx.org_id, ctx.profile_id);
            const { data: sale } = await service.from('sales').select('rep_id').eq('id', saleId).eq('org_id', ctx.org_id).single();
            if (!sale || sale.rep_id !== repId)
                return reply.code(403).send({ error: 'Forbidden' });
        }
        const { data, error } = await service.storage.from('contracts').createSignedUrl(contract.pdf_path, 60 * 10);
        if (error)
            return reply.code(400).send({ error: error.message });
        return reply.send({ url: data.signedUrl, contract });
    });
}
//# sourceMappingURL=contracts.js.map