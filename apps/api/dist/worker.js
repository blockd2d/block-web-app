import { env } from './lib/env';
import { createServiceClient } from './lib/supabase';
import { processJob } from './worker/processors';
async function sleep(ms) {
    return new Promise((r) => setTimeout(r, ms));
}
async function main() {
    const service = createServiceClient();
    console.log('Worker started', { env: env.NODE_ENV });
    while (true) {
        try {
            const { data: job } = await service
                .from('jobs_queue')
                .select('*')
                .eq('status', 'queued')
                .order('created_at', { ascending: true })
                .limit(1)
                .single();
            if (!job) {
                await sleep(2000);
                continue;
            }
            await service
                .from('jobs_queue')
                .update({ status: 'running', started_at: new Date().toISOString(), progress: 1 })
                .eq('id', job.id);
            try {
                const result = await processJob(service, job);
                await service
                    .from('jobs_queue')
                    .update({ status: 'complete', progress: 100, finished_at: new Date().toISOString(), result })
                    .eq('id', job.id);
            }
            catch (err) {
                console.error('Job failed', job.id, err);
                await service
                    .from('jobs_queue')
                    .update({ status: 'failed', finished_at: new Date().toISOString(), error: err?.message || String(err) })
                    .eq('id', job.id);
            }
        }
        catch (err) {
            console.error('Worker loop error', err);
            await sleep(2000);
        }
    }
}
main();
//# sourceMappingURL=worker.js.map