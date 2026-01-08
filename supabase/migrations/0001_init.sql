-- Block V7 initial schema (org-scoped, invite-only)
-- NOTE: run via Supabase migrations.

-- Extensions (idempotent)
create extension if not exists pgcrypto;
create extension if not exists "uuid-ossp";

-- -----------------------------
-- TABLES
-- -----------------------------

-- Organizations
create table if not exists public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now()
);

-- Profiles (one per auth user)
create table if not exists public.profiles (
  id uuid primary key, -- matches auth.users.id
  org_id uuid not null references public.organizations(id) on delete cascade,
  role text not null check (role in ('admin','manager','rep','labor')),
  name text not null,
  email text not null,
  created_at timestamptz not null default now()
);

create index if not exists profiles_org_idx on public.profiles(org_id);

-- Invites (admin/manager only)
create table if not exists public.invites (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  email text not null,
  role text not null check (role in ('admin','manager')),
  token text not null unique,
  expires_at timestamptz not null,
  accepted_at timestamptz,
  created_at timestamptz not null default now()
);

-- Counties and properties
create table if not exists public.counties (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  fips text,
  bounds jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.properties (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  county_id uuid not null references public.counties(id) on delete cascade,
  lat double precision not null,
  lng double precision not null,
  address1 text,
  city text,
  state text,
  zip text,
  value_estimate numeric,
  tags jsonb,
  created_at timestamptz not null default now()
);

create index if not exists properties_org_county_idx on public.properties(org_id, county_id);
create index if not exists properties_latlng_idx on public.properties(lat, lng);

-- Cluster sets + clusters
create table if not exists public.cluster_sets (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  county_id uuid not null references public.counties(id) on delete cascade,
  filters_json jsonb not null,
  status text not null default 'queued' check (status in ('queued','running','complete','failed')),
  progress int not null default 0,
  error text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists cluster_sets_org_idx on public.cluster_sets(org_id);

create table if not exists public.reps (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  profile_id uuid references public.profiles(id) on delete set null,
  name text not null,
  home_lat double precision not null,
  home_lng double precision not null,
  active boolean not null default true,
  created_at timestamptz not null default now()
);
create index if not exists reps_org_idx on public.reps(org_id);

create table if not exists public.clusters (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  cluster_set_id uuid not null references public.cluster_sets(id) on delete cascade,
  center_lat double precision not null,
  center_lng double precision not null,
  hull_geojson jsonb not null,
  stats_json jsonb not null default '{}'::jsonb,
  assigned_rep_id uuid references public.reps(id) on delete set null,
  color text,
  created_at timestamptz not null default now()
);
create index if not exists clusters_org_set_idx on public.clusters(org_id, cluster_set_id);
create index if not exists clusters_assigned_rep_idx on public.clusters(assigned_rep_id);

create table if not exists public.cluster_properties (
  org_id uuid not null references public.organizations(id) on delete cascade,
  cluster_id uuid not null references public.clusters(id) on delete cascade,
  property_id uuid not null references public.properties(id) on delete cascade,
  primary key (org_id, cluster_id, property_id)
);

-- Rep locations (for live tracking)
create table if not exists public.rep_locations (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  rep_id uuid not null references public.reps(id) on delete cascade,
  lat double precision not null,
  lng double precision not null,
  speed double precision,
  heading double precision,
  clocked_in boolean not null default true,
  recorded_at timestamptz not null default now()
);
create index if not exists rep_locations_rep_time_idx on public.rep_locations(rep_id, recorded_at desc);

create or replace view public.rep_locations_latest as
select distinct on (rep_id)
  id, org_id, rep_id, lat, lng, speed, heading, clocked_in, recorded_at
from public.rep_locations
order by rep_id, recorded_at desc;

-- Interactions, sales, followups
create table if not exists public.interactions (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  rep_id uuid not null references public.reps(id) on delete cascade,
  property_id uuid not null references public.properties(id) on delete cascade,
  outcome text not null,
  notes text,
  followup_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists interactions_org_rep_idx on public.interactions(org_id, rep_id);

create table if not exists public.sales (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  rep_id uuid not null references public.reps(id) on delete cascade,
  property_id uuid not null references public.properties(id) on delete cascade,
  price numeric,
  service_type text,
  notes text,
  customer_phone text,
  customer_email text,
  status text not null default 'lead' check (status in ('lead','quote','sold','cancelled')),
  created_at timestamptz not null default now()
);
create index if not exists sales_org_rep_idx on public.sales(org_id, rep_id);

create table if not exists public.sale_attachments (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  sale_id uuid not null references public.sales(id) on delete cascade,
  type text not null, -- photo_before, photo_after, signature
  storage_path text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.contracts (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  sale_id uuid not null unique references public.sales(id) on delete cascade,
  pdf_path text not null,
  signed_at timestamptz,
  signer_name text,
  signature_image_path text,
  terms_version text default 'v1',
  created_at timestamptz not null default now()
);

create table if not exists public.followups (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  rep_id uuid not null references public.reps(id) on delete cascade,
  property_id uuid not null references public.properties(id) on delete cascade,
  due_at timestamptz not null,
  status text not null default 'open' check (status in ('open','done','cancelled')),
  notes text,
  created_at timestamptz not null default now()
);

-- Messaging
create table if not exists public.message_threads (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  rep_id uuid references public.reps(id) on delete set null,
  customer_phone text not null,
  property_id uuid references public.properties(id) on delete set null,
  last_message_at timestamptz,
  created_at timestamptz not null default now(),
  unique(org_id, customer_phone)
);

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  thread_id uuid not null references public.message_threads(id) on delete cascade,
  direction text not null check (direction in ('inbound','outbound')),
  body text not null,
  twilio_sid text,
  sent_at timestamptz,
  status text,
  created_at timestamptz not null default now()
);

-- Labor
create table if not exists public.laborers (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  profile_id uuid references public.profiles(id) on delete set null,
  name text not null,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.labor_availability (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  laborer_id uuid not null references public.laborers(id) on delete cascade,
  day_of_week int not null check (day_of_week between 0 and 6),
  start_time time not null,
  end_time time not null,
  timezone text not null default 'America/Indiana/Indianapolis',
  created_at timestamptz not null default now()
);

create table if not exists public.labor_time_off (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  laborer_id uuid not null references public.laborers(id) on delete cascade,
  start_at timestamptz not null,
  end_at timestamptz not null,
  reason text,
  created_at timestamptz not null default now()
);

create table if not exists public.jobs (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  sale_id uuid not null references public.sales(id) on delete cascade,
  laborer_id uuid references public.laborers(id) on delete set null,
  scheduled_start timestamptz,
  scheduled_end timestamptz,
  status text not null default 'scheduled' check (status in ('scheduled','in_progress','complete','cancelled')),
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  job_id uuid not null references public.jobs(id) on delete cascade,
  provider text not null default 'stripe',
  amount int not null,
  currency text not null default 'usd',
  status text not null default 'pending' check (status in ('pending','paid','failed','cancelled')),
  stripe_payment_intent_id text,
  stripe_checkout_session_id text,
  checkout_url text,
  created_at timestamptz not null default now()
);

-- Exports
create table if not exists public.exports (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  type text not null check (type in ('sales','assignments')),
  status text not null default 'queued' check (status in ('queued','running','complete','failed')),
  storage_path text,
  error text,
  created_at timestamptz not null default now()
);

-- Audit log
create table if not exists public.audit_log (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  actor_profile_id uuid references public.profiles(id) on delete set null,
  action text not null,
  entity_type text,
  entity_id uuid,
  meta_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

-- Worker queue (background jobs)
create table if not exists public.jobs_queue (
  id uuid primary key default gen_random_uuid(),
  org_id uuid references public.organizations(id) on delete cascade,
  type text not null, -- cluster_generate, export_sales, export_assignments, contract_generate, nightly_rollup
  status text not null default 'queued' check (status in ('queued','running','complete','failed')),
  progress int not null default 0,
  payload jsonb not null default '{}'::jsonb,
  result jsonb,
  error text,
  created_at timestamptz not null default now(),
  started_at timestamptz,
  finished_at timestamptz
);
create index if not exists jobs_queue_status_idx on public.jobs_queue(status, created_at);

-- -----------------------------
-- RLS ENABLE
-- -----------------------------
alter table public.organizations enable row level security;
alter table public.profiles enable row level security;
alter table public.invites enable row level security;
alter table public.counties enable row level security;
alter table public.properties enable row level security;
alter table public.cluster_sets enable row level security;
alter table public.clusters enable row level security;
alter table public.cluster_properties enable row level security;
alter table public.reps enable row level security;
alter table public.rep_locations enable row level security;
alter table public.interactions enable row level security;
alter table public.sales enable row level security;
alter table public.sale_attachments enable row level security;
alter table public.contracts enable row level security;
alter table public.followups enable row level security;
alter table public.message_threads enable row level security;
alter table public.messages enable row level security;
alter table public.laborers enable row level security;
alter table public.labor_availability enable row level security;
alter table public.labor_time_off enable row level security;
alter table public.jobs enable row level security;
alter table public.payments enable row level security;
alter table public.exports enable row level security;
alter table public.audit_log enable row level security;
alter table public.jobs_queue enable row level security;

-- -----------------------------
-- HELPER FUNCTIONS (SECURITY DEFINER to avoid RLS recursion)
-- -----------------------------

drop function if exists public.current_org();
create function public.current_org()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select org_id from public.profiles where id = auth.uid()
$$;

drop function if exists public.is_manager();
create function public.is_manager()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((select role in ('admin','manager') from public.profiles where id = auth.uid()), false)
$$;

drop function if exists public.rep_profile_id();
create function public.rep_profile_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select id from public.reps where profile_id = auth.uid() limit 1
$$;

drop function if exists public.labor_profile_id();
create function public.labor_profile_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select id from public.laborers where profile_id = auth.uid() limit 1
$$;

-- -----------------------------
-- POLICIES (all safe-drop first)
-- -----------------------------

-- Organizations: read own org
drop policy if exists org_select on public.organizations;
create policy org_select on public.organizations
for select
using (id = public.current_org());

-- Profiles: user can read own profile; managers can read org profiles
drop policy if exists profiles_select_self on public.profiles;
create policy profiles_select_self on public.profiles
for select
using (id = auth.uid() or (org_id = public.current_org() and public.is_manager()));

-- Writes to profiles are backend-only (service role), so lock down from clients
drop policy if exists profiles_no_write on public.profiles;
create policy profiles_no_write on public.profiles
for all
using (false)
with check (false);

-- Invites: backend-only
drop policy if exists invites_no_client on public.invites;
create policy invites_no_client on public.invites
for all
using (false)
with check (false);

-- Counties & properties: managers can read; reps/labor via backend proxy only
drop policy if exists counties_select on public.counties;
create policy counties_select on public.counties
for select
using (org_id = public.current_org() and public.is_manager());

drop policy if exists properties_select on public.properties;
create policy properties_select on public.properties
for select
using (org_id = public.current_org() and public.is_manager());

-- Reps: managers read; reps read own
drop policy if exists reps_select on public.reps;
create policy reps_select on public.reps
for select
using (
  org_id = public.current_org()
  and (public.is_manager() or profile_id = auth.uid())
);

-- Interactions/sales/followups: managers see all; reps see own rep_id
drop policy if exists interactions_select on public.interactions;
create policy interactions_select on public.interactions
for select
using (
  org_id = public.current_org()
  and (public.is_manager() or rep_id in (select id from public.reps where profile_id = auth.uid()))
);

drop policy if exists sales_select on public.sales;
create policy sales_select on public.sales
for select
using (
  org_id = public.current_org()
  and (public.is_manager() or rep_id in (select id from public.reps where profile_id = auth.uid()))
);

drop policy if exists followups_select on public.followups;
create policy followups_select on public.followups
for select
using (
  org_id = public.current_org()
  and (public.is_manager() or rep_id in (select id from public.reps where profile_id = auth.uid()))
);

-- Labor: labor reads own laborer, jobs
drop policy if exists laborers_select on public.laborers;
create policy laborers_select on public.laborers
for select
using (org_id = public.current_org() and (public.is_manager() or profile_id = auth.uid()));

drop policy if exists jobs_select on public.jobs;
create policy jobs_select on public.jobs
for select
using (
  org_id = public.current_org()
  and (public.is_manager() or laborer_id in (select id from public.laborers where profile_id = auth.uid()))
);

drop policy if exists payments_select on public.payments;
create policy payments_select on public.payments
for select
using (
  org_id = public.current_org()
  and (
    public.is_manager()
    or job_id in (
      select id from public.jobs
      where laborer_id in (select id from public.laborers where profile_id = auth.uid())
    )
  )
);

-- Everything else: backend-only (service role)
-- Add drops so reruns never fail.

drop policy if exists no_client_write_generic on public.counties;
create policy no_client_write_generic on public.counties
for all using (false) with check (false);

drop policy if exists no_client_write_generic2 on public.properties;
create policy no_client_write_generic2 on public.properties
for all using (false) with check (false);

drop policy if exists no_client_write_generic3 on public.cluster_sets;
create policy no_client_write_generic3 on public.cluster_sets
for all using (false) with check (false);

drop policy if exists no_client_write_generic4 on public.clusters;
create policy no_client_write_generic4 on public.clusters
for all using (false) with check (false);

drop policy if exists no_client_write_generic5 on public.cluster_properties;
create policy no_client_write_generic5 on public.cluster_properties
for all using (false) with check (false);

drop policy if exists no_client_write_generic6 on public.rep_locations;
create policy no_client_write_generic6 on public.rep_locations
for all using (false) with check (false);

drop policy if exists no_client_write_generic7 on public.interactions;
create policy no_client_write_generic7 on public.interactions
for all using (false) with check (false);

drop policy if exists no_client_write_generic8 on public.sales;
create policy no_client_write_generic8 on public.sales
for all using (false) with check (false);

drop policy if exists no_client_write_generic9 on public.followups;
create policy no_client_write_generic9 on public.followups
for all using (false) with check (false);

drop policy if exists no_client_write_generic10 on public.message_threads;
create policy no_client_write_generic10 on public.message_threads
for all using (false) with check (false);

drop policy if exists no_client_write_generic11 on public.messages;
create policy no_client_write_generic11 on public.messages
for all using (false) with check (false);

drop policy if exists no_client_write_generic12 on public.labor_availability;
create policy no_client_write_generic12 on public.labor_availability
for all using (false) with check (false);

drop policy if exists no_client_write_generic13 on public.labor_time_off;
create policy no_client_write_generic13 on public.labor_time_off
for all using (false) with check (false);

drop policy if exists no_client_write_generic14 on public.jobs;
create policy no_client_write_generic14 on public.jobs
for all using (false) with check (false);

drop policy if exists no_client_write_generic15 on public.payments;
create policy no_client_write_generic15 on public.payments
for all using (false) with check (false);

drop policy if exists no_client_write_generic16 on public.exports;
create policy no_client_write_generic16 on public.exports
for all using (false) with check (false);

drop policy if exists no_client_write_generic17 on public.audit_log;
create policy no_client_write_generic17 on public.audit_log
for all using (false) with check (false);

drop policy if exists no_client_write_generic18 on public.jobs_queue;
create policy no_client_write_generic18 on public.jobs_queue
for all using (false) with check (false);

-- -----------------------------
-- STORAGE BUCKETS (idempotent)
-- -----------------------------
insert into storage.buckets (id, name, public) values
  ('attachments','attachments',false),
  ('contracts','contracts',false),
  ('exports','exports',false),
  ('job-photos','job-photos',false)
on conflict (id) do nothing;
