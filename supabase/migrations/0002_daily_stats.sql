-- Daily rollups for quick mobile stats / dashboards

create table if not exists daily_stats (
  id uuid primary key default uuid_generate_v4(),
  org_id uuid not null references organizations(id) on delete cascade,
  profile_id uuid references profiles(id) on delete set null,
  rep_id uuid references reps(id) on delete set null,
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

create index if not exists daily_stats_org_day_idx on daily_stats(org_id, day);
create index if not exists daily_stats_rep_day_idx on daily_stats(rep_id, day);

alter table daily_stats enable row level security;

-- Admin/Manager can read/write all org stats
create policy if not exists daily_stats_admin_manager_all
  on daily_stats
  for all
  using (
    org_id = (select org_id from profiles where id = auth.uid())
    and (select role from profiles where id = auth.uid()) in ('admin','manager')
  )
  with check (
    org_id = (select org_id from profiles where id = auth.uid())
    and (select role from profiles where id = auth.uid()) in ('admin','manager')
  );

-- Rep can read their own stats
create policy if not exists daily_stats_rep_read_own
  on daily_stats
  for select
  using (
    org_id = (select org_id from profiles where id = auth.uid())
    and (select role from profiles where id = auth.uid()) = 'rep'
    and rep_id = (select id from reps where org_id = daily_stats.org_id and profile_id = auth.uid() limit 1)
  );

-- No inserts/updates by rep/labor directly (handled by backend)
