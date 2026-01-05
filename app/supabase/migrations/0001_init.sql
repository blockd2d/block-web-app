\
-- 0001_init.sql
-- Block V7 core schema + RLS
create extension if not exists "uuid-ossp";
create extension if not exists postgis;

-- Helpers
create or replace function public.jwt_sub() returns uuid
language sql stable as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
$$;

create or replace function public.jwt_email() returns text
language sql stable as $$
  select nullif(current_setting('request.jwt.claim.email', true), '')
$$;

create or replace function public.is_org_member(p_org uuid) returns boolean
language sql stable as $$
  select exists (
    select 1 from public.org_memberships m
    where m.org_id = p_org and m.user_id = public.jwt_sub()
  )
$$;

create or replace function public.my_role(p_org uuid) returns text
language sql stable as $$
  select m.role from public.org_memberships m
  where m.org_id = p_org and m.user_id = public.jwt_sub()
$$;

create or replace function public.is_admin_or_manager(p_org uuid) returns boolean
language sql stable as $$
  select public.my_role(p_org) in ('admin','manager')
$$;

-- Core tables
create table if not exists public.organizations (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  phone_e164 text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.org_memberships (
  org_id uuid references public.organizations(id) on delete cascade,
  user_id uuid references auth.users(id) on delete cascade,
  role text not null check (role in ('admin','manager','rep','labor')),
  created_at timestamptz not null default now(),
  primary key (org_id, user_id)
);

create table if not exists public.invites (
  id uuid primary key default uuid_generate_v4(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  email text not null,
  role text not null check (role in ('admin','manager','rep','labor')),
  token text not null unique,
  expires_at timestamptz not null,
  accepted_at timestamptz,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id)
);

create table if not exists public.reps (
  org_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  home_base_lat double precision,
  home_base_lng double precision,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (org_id, user_id)
);

create table if not exists public.laborers (
  org_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  home_base_lat double precision,
  home_base_lng double precision,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (org_id, user_id)
);

-- Properties master library
create table if not exists public.properties (
  org_id uuid not null references public.organizations(id) on delete cascade,
  property_id text not null,
  county text not null,
  lat double precision not null,
  lng double precision not null,
  geom geography(point, 4326) generated always as (st_setsrid(st_makepoint(lng, lat), 4326)::geography) stored,
  address1 text,
  address2 text,
  city text,
  state text,
  zip text,
  value_score numeric,
  price_estimate numeric,
  tags jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  primary key (org_id, property_id)
);
create index if not exists idx_properties_org_county on public.properties(org_id, county);
create index if not exists idx_properties_geom on public.properties using gist(geom);

-- Territory sets + clusters
create table if not exists public.territory_sets (
  id uuid primary key default uuid_generate_v4(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  county text not null,
  name text,
  filters jsonb not null default '{}'::jsonb,
  status text not null default 'pending' check (status in ('pending','running','ready','failed')),
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_territory_sets_org_county on public.territory_sets(org_id, county);

create table if not exists public.clusters (
  id uuid primary key default uuid_generate_v4(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  territory_set_id uuid not null references public.territory_sets(id) on delete cascade,
  cluster_key text not null,
  center_lat double precision not null,
  center_lng double precision not null,
  polygon_geojson jsonb,
  stats jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists idx_clusters_org_ts on public.clusters(org_id, territory_set_id);

create table if not exists public.cluster_properties (
  org_id uuid not null references public.organizations(id) on delete cascade,
  cluster_id uuid not null references public.clusters(id) on delete cascade,
  property_id text not null,
  created_at timestamptz not null default now(),
  primary key (org_id, cluster_id, property_id),
  foreign key (org_id, property_id) references public.properties(org_id, property_id) on delete cascade
);

create table if not exists public.cluster_assignments (
  id uuid primary key default uuid_generate_v4(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  cluster_id uuid not null references public.clusters(id) on delete cascade,
  rep_user_id uuid not null references auth.users(id),
  assigned_by uuid references auth.users(id),
  assigned_at timestamptz not null default now(),
  status text not null default 'active' check (status in ('active','paused','archived'))
);
create index if not exists idx_cluster_assignments_org_rep on public.cluster_assignments(org_id, rep_user_id);

-- Interactions / Followups / Sales / Contracts
create table if not exists public.interactions (
  id uuid primary key default uuid_generate_v4(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  property_id text not null,
  rep_user_id uuid not null references auth.users(id),
  outcome text not null,
  notes text,
  photos jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  foreign key (org_id, property_id) references public.properties(org_id, property_id) on delete cascade
);

create table if not exists public.followups (
  id uuid primary key default uuid_generate_v4(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  property_id text not null,
  rep_user_id uuid not null references auth.users(id),
  due_at timestamptz not null,
  status text not null default 'open' check (status in ('open','done','snoozed','canceled')),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (org_id, property_id) references public.properties(org_id, property_id) on delete cascade
);
create index if not exists idx_followups_org_rep_due on public.followups(org_id, rep_user_id, due_at);

create table if not exists public.sales (
  id uuid primary key default uuid_generate_v4(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  property_id text not null,
  rep_user_id uuid not null references auth.users(id),
  price numeric,
  service_type text,
  notes text,
  status text not null default 'open' check (status in ('open','won','lost','canceled')),
  attachments jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (org_id, property_id) references public.properties(org_id, property_id) on delete cascade
);

create table if not exists public.contracts (
  id uuid primary key default uuid_generate_v4(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  sale_id uuid not null references public.sales(id) on delete cascade,
  pdf_path text,
  signed_pdf_path text,
  signature_path text,
  signed_at timestamptz,
  created_at timestamptz not null default now()
);

-- Messaging
create table if not exists public.messages (
  id uuid primary key default uuid_generate_v4(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  property_id text,
  phone_e164 text not null,
  direction text not null check (direction in ('inbound','outbound')),
  body text not null,
  twilio_sid text,
  sent_by_user_id uuid references auth.users(id),
  status text not null default 'queued',
  created_at timestamptz not null default now()
);

-- Rep live location
create table if not exists public.rep_locations (
  id uuid primary key default uuid_generate_v4(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  rep_user_id uuid not null references auth.users(id),
  lat double precision not null,
  lng double precision not null,
  accuracy double precision,
  recorded_at timestamptz not null default now(),
  source text,
  cluster_id uuid,
  created_at timestamptz not null default now()
);
create index if not exists idx_rep_locations_org_rep_time on public.rep_locations(org_id, rep_user_id, recorded_at desc);

-- Jobs + payments
create table if not exists public.jobs (
  id uuid primary key default uuid_generate_v4(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  sale_id uuid references public.sales(id) on delete set null,
  scheduled_start timestamptz,
  scheduled_end timestamptz,
  assigned_labor_user_id uuid references auth.users(id),
  status text not null default 'scheduled' check (status in ('scheduled','en_route','started','completed','paid','canceled')),
  price_final numeric,
  balance_due numeric,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_jobs_org_labor on public.jobs(org_id, assigned_labor_user_id);

create table if not exists public.job_media (
  id uuid primary key default uuid_generate_v4(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  job_id uuid not null references public.jobs(id) on delete cascade,
  media_type text not null check (media_type in ('before','after','other')),
  storage_path text not null,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);

create table if not exists public.job_payments (
  id uuid primary key default uuid_generate_v4(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  job_id uuid not null references public.jobs(id) on delete cascade,
  stripe_customer_id text,
  stripe_payment_intent_id text,
  status text not null default 'created' check (status in ('created','requires_payment_method','requires_confirmation','processing','succeeded','canceled','failed')),
  amount numeric not null,
  currency text not null default 'usd',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_job_payments_job on public.job_payments(job_id);

-- Time clock + availability
create table if not exists public.time_clock (
  id uuid primary key default uuid_generate_v4(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id),
  role text not null check (role in ('rep','labor')),
  clock_in_at timestamptz not null,
  clock_out_at timestamptz,
  lat double precision,
  lng double precision,
  created_at timestamptz not null default now()
);

create table if not exists public.availability (
  id uuid primary key default uuid_generate_v4(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  labor_user_id uuid not null references auth.users(id),
  day_of_week int not null check (day_of_week between 0 and 6),
  start_time time not null,
  end_time time not null,
  timezone text not null default 'America/Indiana/Indianapolis',
  created_at timestamptz not null default now()
);

-- Exports + audit log
create table if not exists public.exports (
  id uuid primary key default uuid_generate_v4(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  type text not null,
  params jsonb not null default '{}'::jsonb,
  status text not null default 'queued' check (status in ('queued','running','ready','failed')),
  file_path text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.audit_log (
  id uuid primary key default uuid_generate_v4(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  actor_user_id uuid references auth.users(id),
  action_type text not null,
  entity_type text not null,
  entity_id text,
  before jsonb,
  after jsonb,
  created_at timestamptz not null default now()
);

-- Job queue for worker
create table if not exists public.jobs_queue (
  id uuid primary key default uuid_generate_v4(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  kind text not null,
  params jsonb not null default '{}'::jsonb,
  status text not null default 'queued' check (status in ('queued','running','done','failed')),
  progress int not null default 0,
  message text,
  result jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Views
create or replace view public.v_my_membership as
select m.org_id, m.role, o.name as org_name
from public.org_memberships m
join public.organizations o on o.id = m.org_id
where m.user_id = public.jwt_sub();

create or replace view public.rep_locations_latest as
select distinct on (org_id, rep_user_id)
  org_id, rep_user_id, lat, lng, accuracy, recorded_at
from public.rep_locations
order by org_id, rep_user_id, recorded_at desc;

-- RPC for viewport LOD
create or replace function public.rpc_get_properties_in_bbox(
  p_org uuid,
  p_min_lng double precision,
  p_min_lat double precision,
  p_max_lng double precision,
  p_max_lat double precision,
  p_limit int default 2000
)
returns table(property_id text, lat double precision, lng double precision, value_score numeric, price_estimate numeric) 
language sql stable as $$
  select pr.property_id, pr.lat, pr.lng, pr.value_score, pr.price_estimate
  from public.properties pr
  where pr.org_id = p_org
    and st_intersects(
      pr.geom,
      st_makeenvelope(p_min_lng, p_min_lat, p_max_lng, p_max_lat, 4326)::geography
    )
  limit p_limit
$$;

-- Enable RLS
alter table public.organizations enable row level security;
alter table public.profiles enable row level security;
alter table public.org_memberships enable row level security;
alter table public.invites enable row level security;
alter table public.reps enable row level security;
alter table public.laborers enable row level security;
alter table public.properties enable row level security;
alter table public.territory_sets enable row level security;
alter table public.clusters enable row level security;
alter table public.cluster_properties enable row level security;
alter table public.cluster_assignments enable row level security;
alter table public.interactions enable row level security;
alter table public.followups enable row level security;
alter table public.sales enable row level security;
alter table public.contracts enable row level security;
alter table public.messages enable row level security;
alter table public.rep_locations enable row level security;
alter table public.jobs enable row level security;
alter table public.job_media enable row level security;
alter table public.job_payments enable row level security;
alter table public.time_clock enable row level security;
alter table public.availability enable row level security;
alter table public.exports enable row level security;
alter table public.audit_log enable row level security;
alter table public.jobs_queue enable row level security;

-- Policies (org isolation)
-- organizations: members can read their org
create policy org_read on public.organizations
for select using (exists(select 1 from public.org_memberships m where m.org_id = id and m.user_id = public.jwt_sub()));

-- profiles: users can read/update own profile; managers/admin can read profiles of org
create policy profile_self_read on public.profiles for select using (user_id = public.jwt_sub());
create policy profile_self_upd on public.profiles for update using (user_id = public.jwt_sub()) with check (user_id = public.jwt_sub());

-- org_memberships: members can read their org memberships; only admin can manage (via API/service role typically)
create policy memberships_read on public.org_memberships
for select using (user_id = public.jwt_sub() or public.is_admin_or_manager(org_id));

-- invites: admin/manager can manage invites
create policy invites_manage on public.invites
for all using (public.is_admin_or_manager(org_id)) with check (public.is_admin_or_manager(org_id));

-- reps/laborers: admin/manager read; self read
create policy reps_read on public.reps for select using (public.is_admin_or_manager(org_id) or user_id = public.jwt_sub());
create policy laborers_read on public.laborers for select using (public.is_admin_or_manager(org_id) or user_id = public.jwt_sub());

-- properties: admin/manager read; rep reads only those in assigned clusters (via join)
create policy props_admin_read on public.properties for select using (public.is_admin_or_manager(org_id));
create policy props_rep_read on public.properties
for select using (
  public.my_role(org_id)='rep' and exists (
    select 1 from public.cluster_properties cp
    join public.cluster_assignments ca on ca.cluster_id = cp.cluster_id and ca.org_id = cp.org_id
    where cp.org_id = properties.org_id
      and cp.property_id = properties.property_id
      and ca.rep_user_id = public.jwt_sub()
      and ca.status='active'
  )
);

-- territory_sets/clusters: admin/manager read; reps read only those with assigned clusters
create policy ts_admin_read on public.territory_sets for select using (public.is_admin_or_manager(org_id));
create policy clusters_admin_read on public.clusters for select using (public.is_admin_or_manager(org_id));

create policy clusters_rep_read on public.clusters
for select using (
  public.my_role(org_id)='rep' and exists(
    select 1 from public.cluster_assignments ca
    where ca.org_id = clusters.org_id
      and ca.cluster_id = clusters.id
      and ca.rep_user_id = public.jwt_sub()
      and ca.status='active'
  )
);

create policy cp_admin_read on public.cluster_properties for select using (public.is_admin_or_manager(org_id));
create policy cp_rep_read on public.cluster_properties
for select using (
  public.my_role(org_id)='rep' and exists(
    select 1 from public.cluster_assignments ca
    where ca.org_id = cluster_properties.org_id
      and ca.cluster_id = cluster_properties.cluster_id
      and ca.rep_user_id = public.jwt_sub()
      and ca.status='active'
  )
);

-- cluster_assignments: admin/manager full; rep read own
create policy ca_admin_all on public.cluster_assignments
for all using (public.is_admin_or_manager(org_id)) with check (public.is_admin_or_manager(org_id));
create policy ca_rep_read on public.cluster_assignments
for select using (public.my_role(org_id)='rep' and rep_user_id = public.jwt_sub());

-- interactions/followups/sales/contracts/messages: reps write own; admin/manager read
create policy interactions_rep_write on public.interactions
for insert with check (public.my_role(org_id)='rep' and rep_user_id = public.jwt_sub());
create policy interactions_read on public.interactions
for select using (public.is_admin_or_manager(org_id) or rep_user_id = public.jwt_sub());

create policy followups_rep_write on public.followups
for all using (public.is_admin_or_manager(org_id) or (public.my_role(org_id)='rep' and rep_user_id=public.jwt_sub()))
with check (public.is_admin_or_manager(org_id) or (public.my_role(org_id)='rep' and rep_user_id=public.jwt_sub()));

create policy sales_rep_write on public.sales
for all using (public.is_admin_or_manager(org_id) or (public.my_role(org_id)='rep' and rep_user_id=public.jwt_sub()))
with check (public.is_admin_or_manager(org_id) or (public.my_role(org_id)='rep' and rep_user_id=public.jwt_sub()));

create policy contracts_read on public.contracts
for select using (public.is_admin_or_manager(org_id) or exists(select 1 from public.sales s where s.id = contracts.sale_id and s.rep_user_id = public.jwt_sub()));

create policy messages_read on public.messages
for select using (public.is_admin_or_manager(org_id) or sent_by_user_id = public.jwt_sub());
create policy messages_insert on public.messages
for insert with check (public.is_org_member(org_id));

-- rep_locations: rep insert own; admin/manager read
create policy rep_loc_insert on public.rep_locations
for insert with check (public.my_role(org_id)='rep' and rep_user_id=public.jwt_sub());
create policy rep_loc_read on public.rep_locations
for select using (public.is_admin_or_manager(org_id) or rep_user_id=public.jwt_sub());

-- jobs/media/payments: labor read/update own assignments; admin/manager full
create policy jobs_admin_all on public.jobs
for all using (public.is_admin_or_manager(org_id)) with check (public.is_admin_or_manager(org_id));
create policy jobs_labor_read on public.jobs
for select using (public.my_role(org_id)='labor' and assigned_labor_user_id=public.jwt_sub());
create policy jobs_labor_update on public.jobs
for update using (public.my_role(org_id)='labor' and assigned_labor_user_id=public.jwt_sub())
with check (public.my_role(org_id)='labor' and assigned_labor_user_id=public.jwt_sub());

create policy job_media_admin_all on public.job_media
for all using (public.is_admin_or_manager(org_id)) with check (public.is_admin_or_manager(org_id));
create policy job_media_labor_ins on public.job_media
for insert with check (
  public.my_role(org_id)='labor'
  and exists(select 1 from public.jobs j where j.id=job_media.job_id and j.assigned_labor_user_id=public.jwt_sub())
);
create policy job_media_labor_read on public.job_media
for select using (
  public.is_admin_or_manager(org_id)
  or exists(select 1 from public.jobs j where j.id=job_media.job_id and j.assigned_labor_user_id=public.jwt_sub())
);

create policy job_pay_admin_all on public.job_payments
for all using (public.is_admin_or_manager(org_id)) with check (public.is_admin_or_manager(org_id));
create policy job_pay_labor_read on public.job_payments
for select using (
  public.my_role(org_id)='labor'
  and exists(select 1 from public.jobs j where j.id=job_payments.job_id and j.assigned_labor_user_id=public.jwt_sub())
);
create policy job_pay_labor_ins on public.job_payments
for insert with check (
  public.my_role(org_id)='labor'
  and exists(select 1 from public.jobs j where j.id=job_payments.job_id and j.assigned_labor_user_id=public.jwt_sub())
);

-- time_clock: rep/labor insert self; admin/manager read
create policy time_clock_insert on public.time_clock
for insert with check (user_id = public.jwt_sub() and public.is_org_member(org_id));
create policy time_clock_read on public.time_clock
for select using (public.is_admin_or_manager(org_id) or user_id = public.jwt_sub());

-- availability: labor manage own; admin/manager read
create policy availability_manage on public.availability
for all using (public.is_admin_or_manager(org_id) or labor_user_id = public.jwt_sub())
with check (public.is_admin_or_manager(org_id) or labor_user_id = public.jwt_sub());

-- exports/jobs_queue/audit_log: admin/manager
create policy exports_admin on public.exports
for all using (public.is_admin_or_manager(org_id)) with check (public.is_admin_or_manager(org_id));
create policy audit_admin on public.audit_log
for select using (public.is_admin_or_manager(org_id));
create policy jobsq_admin on public.jobs_queue
for all using (public.is_admin_or_manager(org_id)) with check (public.is_admin_or_manager(org_id));

