-- Nova Sales Mobile - example Supabase schema for MVP alignment
-- This is an EXAMPLE contract, not a mandatory final schema.
-- If your backend already exists, map src/lib/api.ts to your real names instead.

create extension if not exists pgcrypto;

-- =========================
-- Core org + user tables
-- =========================
create table if not exists public.orgs (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.app_users (
  user_id uuid primary key references auth.users(id) on delete cascade,
  org_id uuid not null references public.orgs(id) on delete cascade,
  role text not null check (role in ('admin', 'manager', 'rep', 'crew')),
  full_name text,
  created_at timestamptz not null default now()
);

create index if not exists idx_app_users_org_id on public.app_users(org_id);
create index if not exists idx_app_users_role on public.app_users(role);

-- =========================
-- Cluster assignment model
-- =========================
create table if not exists public.sales_clusters (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.orgs(id) on delete cascade,
  name text not null,
  status text not null default 'assigned' check (status in ('assigned', 'active', 'completed', 'archived')),
  walking_distance_miles numeric(8,2),
  est_duration_mins integer,
  start_lat double precision,
  start_lng double precision,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_sales_clusters_org_id on public.sales_clusters(org_id);
create index if not exists idx_sales_clusters_status on public.sales_clusters(status);

create table if not exists public.cluster_assignments (
  cluster_id uuid not null references public.sales_clusters(id) on delete cascade,
  assigned_user_id uuid not null references auth.users(id) on delete cascade,
  assigned_at timestamptz not null default now(),
  primary key (cluster_id, assigned_user_id)
);

create index if not exists idx_cluster_assignments_user on public.cluster_assignments(assigned_user_id);

create table if not exists public.cluster_stops (
  id uuid primary key default gen_random_uuid(),
  cluster_id uuid not null references public.sales_clusters(id) on delete cascade,
  sequence integer not null,
  address1 text not null,
  city text not null,
  state text not null,
  zip text,
  lat double precision,
  lng double precision,
  lead_name text,
  property_notes text,
  completed boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (cluster_id, sequence)
);

create index if not exists idx_cluster_stops_cluster_sequence on public.cluster_stops(cluster_id, sequence);
create index if not exists idx_cluster_stops_cluster_completed on public.cluster_stops(cluster_id, completed);

-- Optional overlays used by the map UI.
create table if not exists public.cluster_boundaries (
  cluster_id uuid primary key references public.sales_clusters(id) on delete cascade,
  points_json jsonb not null,
  updated_at timestamptz not null default now()
);

create table if not exists public.cluster_route_points (
  cluster_id uuid not null references public.sales_clusters(id) on delete cascade,
  sequence integer not null,
  lat double precision not null,
  lng double precision not null,
  primary key (cluster_id, sequence)
);

create index if not exists idx_cluster_route_points_cluster_sequence on public.cluster_route_points(cluster_id, sequence);

-- =========================
-- Sales activity
-- =========================
create table if not exists public.knock_logs (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.orgs(id) on delete cascade,
  cluster_id uuid not null references public.sales_clusters(id) on delete cascade,
  stop_id uuid not null references public.cluster_stops(id) on delete cascade,
  created_by uuid not null references auth.users(id) on delete cascade,
  client_event_id text not null unique,
  outcome text not null check (outcome in ('no answer', 'not interested', 'interested', 'estimated', 'booked')),
  notes text,
  created_at timestamptz not null default now()
);

create index if not exists idx_knock_logs_stop_created_at on public.knock_logs(stop_id, created_at desc);
create index if not exists idx_knock_logs_cluster_created_at on public.knock_logs(cluster_id, created_at desc);

create table if not exists public.quotes (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.orgs(id) on delete cascade,
  cluster_id uuid not null references public.sales_clusters(id) on delete cascade,
  stop_id uuid not null references public.cluster_stops(id) on delete cascade,
  updated_by uuid not null references auth.users(id) on delete cascade,
  client_write_id text not null unique,
  status text not null check (status in ('draft', 'estimated', 'booked')),
  base_price_cents integer not null default 0,
  line_items_json jsonb not null default '[]'::jsonb,
  notes text,
  total_cents integer not null default 0,
  updated_at timestamptz not null default now()
);

create index if not exists idx_quotes_stop_updated_at on public.quotes(stop_id, updated_at desc);
create index if not exists idx_quotes_cluster_updated_at on public.quotes(cluster_id, updated_at desc);

-- =========================
-- Helper view consumed by mobile
-- =========================
create or replace view public.v_sales_assigned_clusters as
select
  ca.assigned_user_id,
  sc.id,
  sc.name,
  sc.status,
  count(cs.id)::int as stop_count,
  count(cs.id) filter (where cs.completed)::int as completed_count,
  sc.walking_distance_miles,
  sc.est_duration_mins,
  sc.start_lat,
  sc.start_lng
from public.sales_clusters sc
join public.cluster_assignments ca on ca.cluster_id = sc.id
left join public.cluster_stops cs on cs.cluster_id = sc.id
group by ca.assigned_user_id, sc.id, sc.name, sc.status, sc.walking_distance_miles, sc.est_duration_mins, sc.start_lat, sc.start_lng;

-- =========================
-- Optional helper: keep stop completion in sync
-- =========================
create or replace function public.mark_stop_completed_from_knock()
returns trigger
language plpgsql
security definer
as $$
begin
  update public.cluster_stops
  set completed = true,
      updated_at = now()
  where id = new.stop_id;
  return new;
end;
$$;

drop trigger if exists trg_mark_stop_completed_from_knock on public.knock_logs;
create trigger trg_mark_stop_completed_from_knock
after insert on public.knock_logs
for each row execute function public.mark_stop_completed_from_knock();

-- =========================
-- Row Level Security
-- =========================
alter table public.orgs enable row level security;
alter table public.app_users enable row level security;
alter table public.sales_clusters enable row level security;
alter table public.cluster_assignments enable row level security;
alter table public.cluster_stops enable row level security;
alter table public.cluster_boundaries enable row level security;
alter table public.cluster_route_points enable row level security;
alter table public.knock_logs enable row level security;
alter table public.quotes enable row level security;

-- Read own org.
drop policy if exists orgs_select_own on public.orgs;
create policy orgs_select_own on public.orgs
for select using (
  exists (
    select 1 from public.app_users au
    where au.user_id = auth.uid()
      and au.org_id = orgs.id
  )
);

-- Read own profile.
drop policy if exists app_users_select_own on public.app_users;
create policy app_users_select_own on public.app_users
for select using (user_id = auth.uid());

-- Read clusters assigned to the current user inside their org.
drop policy if exists sales_clusters_select_assigned on public.sales_clusters;
create policy sales_clusters_select_assigned on public.sales_clusters
for select using (
  exists (
    select 1
    from public.cluster_assignments ca
    where ca.cluster_id = sales_clusters.id
      and ca.assigned_user_id = auth.uid()
  )
);

-- Read only your own assignments.
drop policy if exists cluster_assignments_select_own on public.cluster_assignments;
create policy cluster_assignments_select_own on public.cluster_assignments
for select using (assigned_user_id = auth.uid());

-- Read ordered stops only for clusters assigned to you.
drop policy if exists cluster_stops_select_assigned on public.cluster_stops;
create policy cluster_stops_select_assigned on public.cluster_stops
for select using (
  exists (
    select 1 from public.cluster_assignments ca
    where ca.cluster_id = cluster_stops.cluster_id
      and ca.assigned_user_id = auth.uid()
  )
);

-- Read optional map overlays only for clusters assigned to you.
drop policy if exists cluster_boundaries_select_assigned on public.cluster_boundaries;
create policy cluster_boundaries_select_assigned on public.cluster_boundaries
for select using (
  exists (
    select 1 from public.cluster_assignments ca
    where ca.cluster_id = cluster_boundaries.cluster_id
      and ca.assigned_user_id = auth.uid()
  )
);

drop policy if exists cluster_route_points_select_assigned on public.cluster_route_points;
create policy cluster_route_points_select_assigned on public.cluster_route_points
for select using (
  exists (
    select 1 from public.cluster_assignments ca
    where ca.cluster_id = cluster_route_points.cluster_id
      and ca.assigned_user_id = auth.uid()
  )
);

-- Insert knock logs only for assigned stops/clusters in your org.
drop policy if exists knock_logs_insert_assigned on public.knock_logs;
create policy knock_logs_insert_assigned on public.knock_logs
for insert with check (
  created_by = auth.uid()
  and exists (
    select 1
    from public.cluster_assignments ca
    join public.cluster_stops cs on cs.cluster_id = ca.cluster_id
    join public.app_users au on au.user_id = auth.uid()
    where ca.cluster_id = knock_logs.cluster_id
      and cs.id = knock_logs.stop_id
      and ca.assigned_user_id = auth.uid()
      and au.org_id = knock_logs.org_id
  )
);

-- Read own-org knock logs on assigned clusters.
drop policy if exists knock_logs_select_assigned on public.knock_logs;
create policy knock_logs_select_assigned on public.knock_logs
for select using (
  exists (
    select 1
    from public.cluster_assignments ca
    join public.app_users au on au.user_id = auth.uid()
    where ca.cluster_id = knock_logs.cluster_id
      and ca.assigned_user_id = auth.uid()
      and au.org_id = knock_logs.org_id
  )
);

-- Insert/update quotes only for assigned stops/clusters in your org.
drop policy if exists quotes_insert_assigned on public.quotes;
create policy quotes_insert_assigned on public.quotes
for insert with check (
  updated_by = auth.uid()
  and exists (
    select 1
    from public.cluster_assignments ca
    join public.cluster_stops cs on cs.cluster_id = ca.cluster_id
    join public.app_users au on au.user_id = auth.uid()
    where ca.cluster_id = quotes.cluster_id
      and cs.id = quotes.stop_id
      and ca.assigned_user_id = auth.uid()
      and au.org_id = quotes.org_id
  )
);

drop policy if exists quotes_update_assigned on public.quotes;
create policy quotes_update_assigned on public.quotes
for update using (
  updated_by = auth.uid()
  and exists (
    select 1
    from public.cluster_assignments ca
    join public.app_users au on au.user_id = auth.uid()
    where ca.cluster_id = quotes.cluster_id
      and ca.assigned_user_id = auth.uid()
      and au.org_id = quotes.org_id
  )
) with check (
  updated_by = auth.uid()
  and exists (
    select 1
    from public.cluster_assignments ca
    join public.app_users au on au.user_id = auth.uid()
    where ca.cluster_id = quotes.cluster_id
      and ca.assigned_user_id = auth.uid()
      and au.org_id = quotes.org_id
  )
);

drop policy if exists quotes_select_assigned on public.quotes;
create policy quotes_select_assigned on public.quotes
for select using (
  exists (
    select 1
    from public.cluster_assignments ca
    join public.app_users au on au.user_id = auth.uid()
    where ca.cluster_id = quotes.cluster_id
      and ca.assigned_user_id = auth.uid()
      and au.org_id = quotes.org_id
  )
);

-- Note:
-- Postgres RLS policies on base tables do not automatically make a view queryable.
-- In Supabase, either:
--   1) grant select on the view and ensure it only exposes rows built from RLS-safe base tables, or
--   2) replace the view with an RPC or direct table query if preferred.
