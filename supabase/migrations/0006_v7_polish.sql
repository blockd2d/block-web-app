-- Block V7 polish + missing columns for web UX

alter table if exists public.cluster_sets
  add column if not exists name text not null default 'Cluster Set';

alter table if exists public.message_threads
  add column if not exists status text not null default 'open',
  add column if not exists last_message_preview text;

create index if not exists message_threads_org_last_activity_idx
  on public.message_threads (org_id, last_message_at desc);

alter table if exists public.jobs
  add column if not exists completion_notes text,
  add column if not exists upcharge_notes text,
  add column if not exists signature_data_url text;

-- Helpful materialized-ish summary for clusters list
create index if not exists clusters_org_set_idx on public.clusters (org_id, cluster_set_id);
