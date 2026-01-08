-- Job photos (before/after) metadata
-- Stored in Storage bucket: job-photos

create table if not exists job_photos (
  id uuid primary key default uuid_generate_v4(),
  org_id uuid not null references organizations(id) on delete cascade,
  job_id uuid not null references jobs(id) on delete cascade,
  kind text not null default 'after' check (kind in ('before','after')),
  storage_path text not null,
  created_at timestamptz not null default now()
);

create index if not exists job_photos_org_job_idx on job_photos(org_id, job_id, created_at);

alter table job_photos enable row level security;

-- Select: managers see all in org; labor sees photos for assigned jobs
drop policy if exists job_photos_select on job_photos;
create policy job_photos_select on job_photos for select using (
  org_id = current_org() and (
    is_manager()
    or job_id in (select id from jobs where laborer_id in (select id from laborers where profile_id = auth.uid()))
  )
);

-- No client writes; backend uses service role
drop policy if exists job_photos_no_client_write on job_photos;
create policy job_photos_no_client_write on job_photos for all using (false) with check (false);
