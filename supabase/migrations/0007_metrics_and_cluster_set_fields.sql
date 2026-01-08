-- Block V7: additional fields for analytics + territories

-- -----------------------------
-- cluster_sets convenience columns
-- -----------------------------
alter table if exists public.cluster_sets
  add column if not exists name text,
  add column if not exists radius_m int,
  add column if not exists min_houses int;

-- Backfill from filters_json when possible (do not overwrite existing values)
update public.cluster_sets
set
  radius_m = coalesce(public.cluster_sets.radius_m, nullif((public.cluster_sets.filters_json->>'radius_m')::int, 0)),
  min_houses = coalesce(public.cluster_sets.min_houses, nullif((public.cluster_sets.filters_json->>'min_houses')::int, 0)),
  name = coalesce(public.cluster_sets.name, nullif(public.cluster_sets.filters_json->>'name', ''), 'Cluster Set')
where
  public.cluster_sets.radius_m is null
  or public.cluster_sets.min_houses is null
  or public.cluster_sets.name is null;

-- If name exists but is still nullable from older migrations, enforce a safe default and NOT NULL.
-- (If it is already NOT NULL, these are harmless.)
update public.cluster_sets
set name = 'Cluster Set'
where name is null;

alter table public.cluster_sets
  alter column name set default 'Cluster Set';

-- Setting NOT NULL will succeed because we backfilled nulls above.
alter table public.cluster_sets
  alter column name set not null;

-- -----------------------------
-- daily_stats analytics fields
-- -----------------------------
alter table if exists public.daily_stats
  add column if not exists hours_worked numeric;

-- Backfill existing rows before enforcing NOT NULL
update public.daily_stats
set hours_worked = 0
where hours_worked is null;

alter table public.daily_stats
  alter column hours_worked set default 0;

alter table public.daily_stats
  alter column hours_worked set not null;

create index if not exists daily_stats_org_rep_day_idx
  on public.daily_stats(org_id, rep_id, day);

-- -----------------------------
-- message_threads list performance
-- -----------------------------
create index if not exists message_threads_org_status_last_idx
  on public.message_threads(org_id, status, last_message_at desc);
