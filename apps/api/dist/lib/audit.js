import { createServiceClient } from './supabase';
export async function audit(org_id, actor_profile_id, action, entity = {}, meta = {}) {
    const service = createServiceClient();
    await service.from('audit_log').insert({
        org_id,
        actor_profile_id,
        action,
        entity_type: entity.type || null,
        entity_id: entity.id || null,
        meta_json: meta || {}
    });
}
//# sourceMappingURL=audit.js.map