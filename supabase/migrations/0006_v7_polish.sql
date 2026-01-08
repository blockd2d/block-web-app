-- Block V7 polish + missing columns for web UX

-- cluster_sets.name
alter table if exists public.cluster_sets
  add column if not exists name text;

-- If the table already has rows, ensure existing rows are populated before NOT NULL
update public.cluster_sets
set name = 'Cluster Set'
where name is null;

alter table public.cluster_sets
  alter column name set default 'Cluster Set';

alter table public.cluster_sets
  alter column name set not null;

-- message_threads.status + last_message_preview
alter table if exists public.message_threads
  add column if not exists status text,
  add column if not exists last_message_preview text;

update public.message_threads
set status = 'open'
where status is null;

alter table public.message_threads
  alter column status set default 'open';

alter table public.message_threads
  alter column status set not null;

create index if not exists message_threads_org_last_activity_idx
  on public.message_threads (org_id, last_message_at desc);

-- jobs: web UX fields
alter table if exists public.jobs
  add column if not exists completion_notes text,
  add column if not exists upcharge_notes text,
  add column if not exists signature_data_url text;

-- NOTE: clusters_org_set_idx already exists in the initial schema migration.
-- Keeping indexes idempotent is good, but duplicating the exact same index name is redundant,
-- so we intentionally do not recreate it here.
