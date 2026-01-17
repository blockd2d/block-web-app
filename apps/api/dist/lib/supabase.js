import { createClient } from '@supabase/supabase-js';
import { env } from './env';
export function createServiceClient() {
    return createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
        auth: { autoRefreshToken: false, persistSession: false },
        global: { headers: { 'X-Client-Info': 'block-v7-api' } }
    });
}
export function createAnonClient() {
    return createClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY, {
        auth: { autoRefreshToken: false, persistSession: false },
        global: { headers: { 'X-Client-Info': 'block-v7-api-anon' } }
    });
}
//# sourceMappingURL=supabase.js.map