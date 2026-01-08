-- Block V7 initial schema (org-scoped, invite-only)
-- NOTE: run via Supabase migrations.

create extension if not exists "uuid-ossp";

-- Organizations
create table if not exists organizations (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  created_at timestamptz not null default now()
);

-- Profiles (one per auth user)
create table if not exists profiles (
  id uuid primary key, -- matches auth.users.id
  org_id uuid not null references organizations(id) on delete cascade,
  role text not null check (role in ('admin','manager','rep','labor')),
  name text not null,
  email text not null,
  created_at timestamptz not null default now()
);

create index if not exists profiles_org_idx on profiles(org_id);

-- Invites (admin/manager only)
create table if not exists invites (
  id uuid primary key default uuid_generate_v4(),
  org_id uuid not null references organizations(id) on delete cascade,
  email text not null,
  role text not null check (role in ('admin','manager')),
  token text not null unique,
  expires_at timestamptz not null,
  accepted_at timestamptz,
  created_at timestamptz not null default now()
);

-- Counties and properties
create table if not exists counties (
  id uuid primary key default uuid_generate_v4(),
  org_id uuid not null references organizations(id) on delete cascade,
  name text not null,
  fips text,
  bounds jsonb,
  created_at timestamptz not null default now()
);

create table if not exists properties (
  id uuid primary key default uuid_generate_v4(),
  org_id uuid not null references organizations(id) on delete cascade,
  county_id uuid not null references counties(id) on delete cascade,
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
create index if not exists properties_org_county_idx on properties(org_id, county_id);
create index if not exists properties_latlng_idx on properties(lat,lng);

-- Cluster sets + clusters
create table if not exists cluster_sets (
  id uuid primary key default uuid_generate_v4(),
  org_id uuid not null references organizations(id) on delete cascade,
  county_id uuid not null references counties(id) on delete cascade,
  filters_json jsonb not null,
  status text not null default 'queued' check (status in ('queued','running','complete','failed')),
  progress int not null default 0,
  error text,
  created_by uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists cluster_sets_org_idx on cluster_sets(org_id);

create table if not exists reps (
  id uuid primary key default uuid_generate_v4(),
  org_id uuid not null references organizations(id) on delete cascade,
  profile_id uuid references profiles(id) on delete set null,
  name text not null,
  home_lat double precision not null,
  home_lng double precision not null,
  active boolean not null default true,
  created_at timestamptz not null default now()
);
create index if not exists reps_org_idx on reps(org_id);

create table if not exists clusters (
  id uuid primary key default uuid_generate_v4(),
  org_id uuid not null references organizations(id) on delete cascade,
  cluster_set_id uuid not null references cluster_sets(id) on delete cascade,
  center_lat double precision not null,
  center_lng double precision not null,
  hull_geojson jsonb not null,
  stats_json jsonb not null default '{}'::jsonb,
  assigned_rep_id uuid references reps(id) on delete set null,
  color text,
  created_at timestamptz not null default now()
);
create index if not exists clusters_org_set_idx on clusters(org_id, cluster_set_id);
create index if not exists clusters_assigned_rep_idx on clusters(assigned_rep_id);

create table if not exists cluster_properties (
  org_id uuid not null references organizations(id) on delete cascade,
  cluster_id uuid not null references clusters(id) on delete cascade,
  property_id uuid not null references properties(id) on delete cascade,
  primary key (org_id, cluster_id, property_id)
);

-- Rep locations (for live tracking)
create table if not exists rep_locations (
  id uuid primary key default uuid_generate_v4(),
  org_id uuid not null references organizations(id) on delete cascade,
  rep_id uuid not null references reps(id) on delete cascade,
  lat double precision not null,
  lng double precision not null,
  speed double precision,
  heading double precision,
  clocked_in boolean not null default true,
  recorded_at timestamptz not null default now()
);
create index if not exists rep_locations_rep_time_idx on rep_locations(rep_id, recorded_at desc);

create or replace view rep_locations_latest as
select distinct on (rep_id)
  id, org_id, rep_id, lat, lng, speed, heading, clocked_in, recorded_at
from rep_locations
order by rep_id, recorded_at desc;

-- Interactions, sales, followups
create table if not exists interactions (
  id uuid primary key default uuid_generate_v4(),
  org_id uuid not null references organizations(id) on delete cascade,
  rep_id uuid not null references reps(id) on delete cascade,
  property_id uuid not null references properties(id) on delete cascade,
  outcome text not null,
  notes text,
  followup_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists interactions_org_rep_idx on interactions(org_id, rep_id);

create table if not exists sales (
  id uuid primary key default uuid_generate_v4(),
  org_id uuid not null references organizations(id) on delete cascade,
  rep_id uuid not null references reps(id) on delete cascade,
  property_id uuid not null references properties(id) on delete cascade,
  price numeric,
  service_type text,
  notes text,
  customer_phone text,
  customer_email text,
  status text not null default 'lead' check (status in ('lead','quote','sold','cancelled')),
  created_at timestamptz not null default now()
);
create index if not exists sales_org_rep_idx on sales(org_id, rep_id);

create table if not exists sale_attachments (
  id uuid primary key default uuid_generate_v4(),
  org_id uuid not null references organizations(id) on delete cascade,
  sale_id uuid not null references sales(id) on delete cascade,
  type text not null, -- photo_before, photo_after, signature
  storage_path text not null,
  created_at timestamptz not null default now()
);

create table if not exists contracts (
  id uuid primary key default uuid_generate_v4(),
  org_id uuid not null references organizations(id) on delete cascade,
  sale_id uuid not null unique references sales(id) on delete cascade,
  pdf_path text not null,
  signed_at timestamptz,
  signer_name text,
  signature_image_path text,
  terms_version text default 'v1',
  created_at timestamptz not null default now()
);

create table if not exists followups (
  id uuid primary key default uuid_generate_v4(),
  org_id uuid not null references organizations(id) on delete cascade,
  rep_id uuid not null references reps(id) on delete cascade,
  property_id uuid not null references properties(id) on delete cascade,
  due_at timestamptz not null,
  status text not null default 'open' check (status in ('open','done','cancelled')),
  notes text,
  created_at timestamptz not null default now()
);

-- Messaging
create table if not exists message_threads (
  id uuid primary key default uuid_generate_v4(),
  org_id uuid not null references organizations(id) on delete cascade,
  rep_id uuid references reps(id) on delete set null,
  customer_phone text not null,
  property_id uuid references properties(id) on delete set null,
  last_message_at timestamptz,
  created_at timestamptz not null default now(),
  unique(org_id, customer_phone)
);

create table if not exists messages (
  id uuid primary key default uuid_generate_v4(),
  org_id uuid not null references organizations(id) on delete cascade,
  thread_id uuid not null references message_threads(id) on delete cascade,
  direction text not null check (direction in ('inbound','outbound')),
  body text not null,
  twilio_sid text,
  sent_at timestamptz,
  status text,
  created_at timestamptz not null default now()
);

-- Labor
create table if not exists laborers (
  id uuid primary key default uuid_generate_v4(),
  org_id uuid not null references organizations(id) on delete cascade,
  profile_id uuid references profiles(id) on delete set null,
  name text not null,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists labor_availability (
  id uuid primary key default uuid_generate_v4(),
  org_id uuid not null references organizations(id) on delete cascade,
  laborer_id uuid not null references laborers(id) on delete cascade,
  day_of_week int not null check (day_of_week between 0 and 6),
  start_time time not null,
  end_time time not null,
  timezone text not null default 'America/Indiana/Indianapolis',
  created_at timestamptz not null default now()
);

create table if not exists labor_time_off (
  id uuid primary key default uuid_generate_v4(),
  org_id uuid not null references organizations(id) on delete cascade,
  laborer_id uuid not null references laborers(id) on delete cascade,
  start_at timestamptz not null,
  end_at timestamptz not null,
  reason text,
  created_at timestamptz not null default now()
);

create table if not exists jobs (
  id uuid primary key default uuid_generate_v4(),
  org_id uuid not null references organizations(id) on delete cascade,
  sale_id uuid not null references sales(id) on delete cascade,
  laborer_id uuid references laborers(id) on delete set null,
  scheduled_start timestamptz,
  scheduled_end timestamptz,
  status text not null default 'scheduled' check (status in ('scheduled','in_progress','complete','cancelled')),
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists payments (
  id uuid primary key default uuid_generate_v4(),
  org_id uuid not null references organizations(id) on delete cascade,
  job_id uuid not null references jobs(id) on delete cascade,
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
create table if not exists exports (
  id uuid primary key default uuid_generate_v4(),
  org_id uuid not null references organizations(id) on delete cascade,
  type text not null check (type in ('sales','assignments')),
  status text not null default 'queued' check (status in ('queued','running','complete','failed')),
  storage_path text,
  error text,
  created_at timestamptz not null default now()
);

-- Audit log
create table if not exists audit_log (
  id uuid primary key default uuid_generate_v4(),
  org_id uuid not null references organizations(id) on delete cascade,
  actor_profile_id uuid references profiles(id) on delete set null,
  action text not null,
  entity_type text,
  entity_id uuid,
  meta_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

-- Worker queue (background jobs)
create table if not exists jobs_queue (
  id uuid primary key default uuid_generate_v4(),
  org_id uuid references organizations(id) on delete cascade,
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
create index if not exists jobs_queue_status_idx on jobs_queue(status, created_at);

-- -----------------------------
-- RLS
-- -----------------------------
alter table organizations enable row level security;
alter table profiles enable row level security;
alter table invites enable row level security;
alter table counties enable row level security;
alter table properties enable row level security;
alter table cluster_sets enable row level security;
alter table clusters enable row level security;
alter table cluster_properties enable row level security;
alter table reps enable row level security;
alter table rep_locations enable row level security;
alter table interactions enable row level security;
alter table sales enable row level security;
alter table sale_attachments enable row level security;
alter table contracts enable row level security;
alter table followups enable row level security;
alter table message_threads enable row level security;
alter table messages enable row level security;
alter table laborers enable row level security;
alter table labor_availability enable row level security;
alter table labor_time_off enable row level security;
alter table jobs enable row level security;
alter table payments enable row level security;
alter table exports enable row level security;
alter table audit_log enable row level security;
alter table jobs_queue enable row level security;

-- helper: current org
create or replace function current_org() returns uuid language sql stable as $$
  select org_id from profiles where id = auth.uid()
$$;

-- Organizations: read own org
drop policy if exists org_select on organizations;
create policy org_select on organizations for select
using (id = current_org());

-- Profiles: user can read own profile; managers can read org profiles
drop policy if exists profiles_select_self on profiles;
create policy profiles_select_self on profiles for select
using (id = auth.uid() or org_id = current_org());

-- Writes to profiles are backend-only (service role), so lock down from clients:
drop policy if exists profiles_no_write on profiles;
create policy profiles_no_write on profiles for all using (false) with check (false);

-- Invites: backend-only
drop policy if exists invites_no_client on invites;
create policy invites_no_client on invites for all using (false) with check (false);

-- Generic org read policies (client-side reads are limited; backend uses service role anyway)
create or replace function is_manager() returns boolean language sql stable as $$
  select role in ('admin','manager') from profiles where id = auth.uid()
$$;

-- Counties & properties: managers can read; reps/labor read via backend proxy only
drop policy if exists counties_select on counties;
create policy counties_select on counties for select using (org_id = current_org() and is_manager());

drop policy if exists properties_select on properties;
create policy properties_select on properties for select using (org_id = current_org() and is_manager());

-- Reps: managers read; reps read own
create or replace function rep_profile_id() returns uuid language sql stable as $$
  select id from reps where profile_id = auth.uid() limit 1
$$;

drop policy if exists reps_select on reps;
create policy reps_select on reps for select using (
  org_id = current_org()
  and (is_manager() or profile_id = auth.uid())
);

-- Interactions/sales/followups: managers see all; reps see own rep_id
drop policy if exists interactions_select on interactions;
create policy interactions_select on interactions for select using (
  org_id = current_org() and (is_manager() or rep_id in (select id from reps where profile_id = auth.uid()))
);

drop policy if exists sales_select on sales;
create policy sales_select on sales for select using (
  org_id = current_org() and (is_manager() or rep_id in (select id from reps where profile_id = auth.uid()))
);

drop policy if exists followups_select on followups;
create policy followups_select on followups for select using (
  org_id = current_org() and (is_manager() or rep_id in (select id from reps where profile_id = auth.uid()))
);

-- Labor: labor reads own laborer, jobs
create or replace function labor_profile_id() returns uuid language sql stable as $$
  select id from laborers where profile_id = auth.uid() limit 1
$$;

drop policy if exists laborers_select on laborers;
create policy laborers_select on laborers for select using (org_id = current_org() and (is_manager() or profile_id = auth.uid()));

drop policy if exists jobs_select on jobs;
create policy jobs_select on jobs for select using (
  org_id = current_org()
  and (is_manager() or laborer_id in (select id from laborers where profile_id = auth.uid()))
);

drop policy if exists payments_select on payments;
create policy payments_select on payments for select using (
  org_id = current_org()
  and (is_manager() or job_id in (select id from jobs where laborer_id in (select id from laborers where profile_id = auth.uid())))
);

-- Everything else: backend-only (service role)
create policy no_client_write_generic on counties for all using (false) with check (false);
create policy no_client_write_generic2 on properties for all using (false) with check (false);
create policy no_client_write_generic3 on cluster_sets for all using (false) with check (false);
create policy no_client_write_generic4 on clusters for all using (false) with check (false);
create policy no_client_write_generic5 on cluster_properties for all using (false) with check (false);
create policy no_client_write_generic6 on rep_locations for all using (false) with check (false);
create policy no_client_write_generic7 on interactions for insert using (false) with check (false);
create policy no_client_write_generic8 on sales for insert using (false) with check (false);
create policy no_client_write_generic9 on followups for insert using (false) with check (false);
create policy no_client_write_generic10 on message_threads for all using (false) with check (false);
create policy no_client_write_generic11 on messages for all using (false) with check (false);
create policy no_client_write_generic12 on labor_availability for all using (false) with check (false);
create policy no_client_write_generic13 on labor_time_off for all using (false) with check (false);
create policy no_client_write_generic14 on jobs for all using (false) with check (false);
create policy no_client_write_generic15 on payments for all using (false) with check (false);
create policy no_client_write_generic16 on exports for all using (false) with check (false);
create policy no_client_write_generic17 on audit_log for all using (false) with check (false);
create policy no_client_write_generic18 on jobs_queue for all using (false) with check (false);

-- Storage buckets (idempotent)
insert into storage.buckets (id, name, public) values
  ('attachments','attachments',false),
  ('contracts','contracts',false),
  ('exports','exports',false),
  ('job-photos','job-photos',false)
on conflict (id) do nothing;
