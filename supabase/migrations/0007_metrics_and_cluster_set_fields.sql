-- Block V7: additional fields for analytics + territories

-- Cluster set convenience columns (keeps web list fast and type-safe)
alter table if exists cluster_sets
  add column if not exists name text,
  add column if not exists radius_m int,
  add column if not exists min_houses int;

-- Backfill from filters_json when possible
update cluster_sets
set
  radius_m = coalesce(radius_m, nullif((filters_json->>'radius_m')::int, 0)),
  min_houses = coalesce(min_houses, nullif((filters_json->>'min_houses')::int, 0)),
  name = coalesce(name, (filters_json->>'name'), 'Cluster Set');

-- Analytics: hours_worked supports doors/hour KPIs
alter table if exists daily_stats
  add column if not exists hours_worked numeric not null default 0;

create index if not exists daily_stats_org_rep_day_idx on daily_stats(org_id, rep_id, day);

-- Messages list performance
create index if not exists message_threads_org_status_last_idx on message_threads(org_id, status, last_message_at desc);
