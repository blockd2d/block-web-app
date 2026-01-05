-- Block V6: minimal schema scaffold (optional)
-- This does NOT change the local-first behavior; it exists to make Supabase adoption easy.

create table if not exists organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now()
);

create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  organization_id uuid references organizations(id) on delete set null,
  role text not null default 'rep', -- 'rep' | 'manager'
  full_name text,
  created_at timestamptz not null default now()
);

-- Example: persist reps/sales later
create table if not exists reps (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references organizations(id) on delete cascade,
  name text not null,
  home_lat double precision,
  home_lng double precision,
  created_at timestamptz not null default now()
);

create table if not exists sales (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references organizations(id) on delete cascade,
  rep_id uuid references reps(id) on delete set null,
  amount numeric,
  service_type text,
  notes text,
  customer_phone text,
  customer_email text,
  created_at timestamptz not null default now()
);

alter table organizations enable row level security;
alter table profiles enable row level security;
alter table reps enable row level security;
alter table sales enable row level security;

-- RLS scaffolding: deny by default; tighten as you implement sync
create policy "profiles_read_own" on profiles
  for select using (auth.uid() = id);

create policy "profiles_update_own" on profiles
  for update using (auth.uid() = id);

-- Managers can add org-wide policies later (recommended).
