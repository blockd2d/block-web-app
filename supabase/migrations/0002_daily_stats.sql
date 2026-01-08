-- Daily rollups for quick mobile stats / dashboards

-- Table
create table if not exists public.daily_stats (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  profile_id uuid references public.profiles(id) on delete set null,
  rep_id uuid references public.reps(id) on delete set null,
  day date not null,
  doors_knocked int not null default 0,
  talked int not null default 0,
  leads int not null default 0,
  quotes int not null default 0,
  sold int not null default 0,
  revenue numeric not null default 0,
  xp int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (org_id, rep_id, day)
);

create index if not exists daily_stats_org_day_idx on public.daily_stats(org_id, day);
create index if not exists daily_stats_rep_day_idx on public.daily_stats(rep_id, day);

-- RLS
alter table public.daily_stats enable row level security;

-- -----------------------------
-- POLICIES (idempotent)
-- -----------------------------

-- Admin/Manager can read/write all org stats
drop policy if exists daily_stats_admin_manager_all on public.daily_stats;
create policy daily_stats_admin_manager_all
  on public.daily_stats
  for all
  using (
    org_id = public.current_org()
    and public.is_manager()
  )
  with check (
    org_id = public.current_org()
    and public.is_manager()
  );

-- Rep can read their own stats
drop policy if exists daily_stats_rep_read_own on public.daily_stats;
create policy daily_stats_rep_read_own
  on public.daily_stats
  for select
  using (
    org_id = public.current_org()
    and rep_id in (select id from public.reps where profile_id = auth.uid())
  );

-- No inserts/updates/deletes by clients directly (handled by backend/service role)
-- Note: managers are already allowed by daily_stats_admin_manager_all
drop policy if exists daily_stats_no_client_write on public.daily_stats;
create policy daily_stats_no_client_write
  on public.daily_stats
  for insert
  with check (false);

drop policy if exists daily_stats_no_client_update on public.daily_stats;
create policy daily_stats_no_client_update
  on public.daily_stats
  for update
  using (false)
  with check (false);

drop policy if exists daily_stats_no_client_delete on public.daily_stats;
create policy daily_stats_no_client_delete
  on public.daily_stats
  for delete
  using (false);
