-- Job photos (before/after) metadata
-- Stored in Storage bucket: job-photos

create table if not exists public.job_photos (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  job_id uuid not null references public.jobs(id) on delete cascade,
  kind text not null default 'after' check (kind in ('before','after')),
  storage_path text not null,
  created_at timestamptz not null default now()
);

create index if not exists job_photos_org_job_idx
  on public.job_photos(org_id, job_id, created_at);

alter table public.job_photos enable row level security;

-- Select: managers see all in org; labor sees photos for assigned jobs
drop policy if exists job_photos_select on public.job_photos;
create policy job_photos_select
on public.job_photos
for select
using (
  org_id = public.current_org()
  and (
    public.is_manager()
    or job_id in (
      select id
      from public.jobs
      where laborer_id in (
        select id from public.laborers where profile_id = auth.uid()
      )
    )
  )
);

-- No client writes; backend uses service role
drop policy if exists job_photos_no_client_write on public.job_photos;
create policy job_photos_no_client_write
on public.job_photos
for all
using (false)
with check (false);
