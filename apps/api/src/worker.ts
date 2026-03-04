import { env } from './lib/env.js';
import { createServiceClient } from './lib/supabase.js';
import { processJob } from './worker/processors.js';

async function sleep(ms: number) {
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
        console.log('Job complete', { job_id: job.id, type: job.type, result });
        await service
          .from('jobs_queue')
          .update({ status: 'complete', progress: 100, finished_at: new Date().toISOString(), result })
          .eq('id', job.id);
      } catch (err: any) {
        console.error('Job failed', job.id, job.type, err?.message, err?.stack, {
          details: err?.details,
          hint: err?.hint,
          code: err?.code
        });
        const errMsg = err?.message || String(err);
        await service
          .from('jobs_queue')
          .update({ status: 'failed', finished_at: new Date().toISOString(), error: errMsg })
          .eq('id', job.id);
        if (job.type === 'cluster_generate' && job.org_id && job.payload?.cluster_set_id) {
          await service
            .from('cluster_sets')
            .update({ status: 'failed', error: errMsg })
            .eq('org_id', job.org_id)
            .eq('id', job.payload.cluster_set_id);
        }
      }
    } catch (err) {
      console.error('Worker loop error', err);
      await sleep(2000);
    }
  }
}

main();
